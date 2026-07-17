/*
 * content.js — runs in every page/frame (see manifest content_scripts).
 *
 * Two roles, decided at runtime from stored config:
 *
 *   1. DESKTOP BRIDGE  — when the page URL matches `desktopUrlPattern`.
 *      Receives INITIATE_CONTACT messages from the background service worker
 *      and re-emits them into the page's main world via window.postMessage so
 *      the Webex CC widget bridge (crmContactBridge.js) can dispatch the
 *      matching Desktop SDK action. Does NOT scan or inject buttons.
 *
 *   2. CRM SCANNER     — every other (non-desktop, enabled) page.
 *      Scans text + tel:/mailto: links for phone/email contacts and injects
 *      call / SMS / email buttons. Clicks are forwarded to the background
 *      worker, which routes them to the Desktop tab.
 *
 * Config (chrome.storage.sync, key "crmC2C"):
 *   {
 *     enabled: boolean,
 *     desktopUrlPattern: string,   // substring or "*"-glob matched against href
 *     allowlist: string[],         // CRM URL substrings; empty = all non-desktop
 *     channels: { call: bool, sms: bool, email: bool }
 *   }
 */
(function () {
  'use strict';

  var SCAN = self.CrmContactScan;
  var DEFAULTS = {
    enabled: true,
    desktopUrlPattern: 'desktop.wxcc',
    allowlist: [],
    channels: { call: true, sms: true, email: true },
  };

  var MARK = 'data-crm-c2c';           // marks processed text hosts
  var cfg = DEFAULTS;
  var role = null;                     // 'desktop' | 'crm'
  var observer = null;
  var rescanTimer = null;

  /* ── config ──────────────────────────────────────────────────────────── */

  function loadConfig(cb) {
    try {
      chrome.storage.sync.get('crmC2C', function (res) {
        var stored = (res && res.crmC2C) || {};
        cfg = Object.assign({}, DEFAULTS, stored, {
          channels: Object.assign({}, DEFAULTS.channels, stored.channels || {}),
        });
        cb();
      });
    } catch (e) {
      cfg = DEFAULTS;
      cb();
    }
  }

  function matchesPattern(href, pattern) {
    if (!pattern) return false;
    if (pattern === '*') return true;
    if (pattern.indexOf('*') !== -1) {
      var re = new RegExp('^' + pattern.split('*').map(function (s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('.*'));
      return re.test(href);
    }
    return href.indexOf(pattern) !== -1;
  }

  function isDesktopPage() {
    return matchesPattern(location.href, cfg.desktopUrlPattern);
  }

  // True when THIS frame is part of the Webex CC Desktop — either its own URL
  // matches the desktop pattern (the shell), OR one of its ancestor frames does
  // (the Task Management widget runs in a nested iframe whose own origin is the
  // relay / journey-widget, which does NOT match the desktop pattern). Detecting
  // the ancestor is what lets the bridge fire inside the widget iframe, so the
  // widget's crmContactBridge actually receives the same-window postMessage.
  function isDesktopContext() {
    if (isDesktopPage()) return true;
    try {
      var ao = window.location.ancestorOrigins;
      if (ao && ao.length) {
        for (var i = 0; i < ao.length; i++) {
          if (matchesPattern(ao[i], cfg.desktopUrlPattern)) return true;
        }
      }
    } catch (e) { /* ancestorOrigins unavailable (non-Chromium) */ }
    return false;
  }

  function isAllowedCrmPage() {
    if (!cfg.allowlist || cfg.allowlist.length === 0) return true;
    for (var i = 0; i < cfg.allowlist.length; i++) {
      if (cfg.allowlist[i] && location.href.indexOf(cfg.allowlist[i]) !== -1) return true;
    }
    return false;
  }

  /* ── DESKTOP BRIDGE role ─────────────────────────────────────────────── */

  function initDesktopBridge() {
    role = 'desktop';
    chrome.runtime.onMessage.addListener(function (msg) {
      if (!msg || msg.type !== 'INITIATE_CONTACT') return;
      // Hand off to the widget's main-world listener. Same-origin postMessage.
      window.postMessage({
        __crmC2C: true,
        type: 'INITIATE_CONTACT',
        channel: msg.channel,
        destination: msg.destination,
        ts: Date.now(),
      }, window.location.origin);
    });
    console.log('[crm-c2c] desktop bridge active on', location.host);
  }

  /* ── CRM SCANNER role ────────────────────────────────────────────────── */

  // Momentum-style inline SVG glyphs (handset / chat / email) so the injected
  // pills match Webex CC Desktop iconography without pulling in the icon font.
  var CHANNEL_META = {
    call: {
      title: 'Call',
      svg: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M5.16 2.28a.9.9 0 0 1 1.35.24l1.1 1.86a.9.9 0 0 1-.14 1.1l-.86.83c.5 1 1.32 1.82 2.32 2.32l.83-.86a.9.9 0 0 1 1.1-.14l1.86 1.1a.9.9 0 0 1 .24 1.35l-.94 1.05c-.42.47-1.1.63-1.7.38C7.7 12.7 4.3 9.3 2.85 5.79c-.25-.6-.09-1.28.38-1.7l1.05-.94z"/></svg>',
    },
    sms: {
      title: 'SMS',
      svg: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M2 4.2C2 3.26 2.76 2.5 3.7 2.5h8.6c.94 0 1.7.76 1.7 1.7v4.6c0 .94-.76 1.7-1.7 1.7H6.9l-3.1 2.4a.4.4 0 0 1-.64-.32v-2.09C2.5 10.32 2 9.5 2 8.8V4.2z"/></svg>',
    },
    email: {
      title: 'Email',
      svg: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M2 4.5C2 3.9 2.4 3.5 3 3.5h10c.6 0 1 .4 1 1v7c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1v-7zm1.6.2L8 7.9l4.4-3.2H3.6z"/></svg>',
    },
  };

  function makeButtonGroup(contact /* {kind,value} */) {
    var group = document.createElement('span');
    group.className = 'crm-c2c-group';
    group.setAttribute('contenteditable', 'false');

    var channels = contact.kind === 'email'
      ? ['email']                     // an email address → email only
      : ['call', 'sms', 'email'];     // a phone → call/sms (email disabled unless enabled)

    channels.forEach(function (ch) {
      if (!cfg.channels[ch]) return;
      // For a phone contact we cannot email it, so skip email on phones.
      if (ch === 'email' && contact.kind !== 'email') return;
      var meta = CHANNEL_META[ch];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crm-c2c-btn crm-c2c-btn--' + ch;
      btn.title = meta.title + ' ' + contact.value;
      var ico = document.createElement('span');
      ico.className = 'crm-c2c-ico';
      ico.innerHTML = meta.svg;          // static, extension-authored markup only
      var lbl = document.createElement('span');
      lbl.className = 'crm-c2c-label';
      lbl.textContent = meta.title;
      btn.appendChild(ico);
      btn.appendChild(lbl);
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        sendContact(ch, contact.value);
        flash(btn);
      });
      group.appendChild(btn);
    });

    return group.childNodes.length ? group : null;
  }

  function flash(btn) {
    btn.classList.add('crm-c2c-btn--sent');
    setTimeout(function () { btn.classList.remove('crm-c2c-btn--sent'); }, 900);
  }

  function sendContact(channel, destination) {
    try {
      chrome.runtime.sendMessage({ type: 'INITIATE_CONTACT', channel: channel, destination: destination });
      console.log('[crm-c2c] →', channel, destination);
    } catch (e) {
      console.warn('[crm-c2c] sendMessage failed', e);
    }
  }

  // Inject buttons for explicit tel:/mailto: anchors.
  function scanLinks(rootEl) {
    var anchors = rootEl.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      if (a.hasAttribute(MARK)) continue;
      a.setAttribute(MARK, '1');
      var href = a.getAttribute('href') || '';
      var contact = href.indexOf('mailto:') === 0
        ? { kind: 'email', value: decodeURIComponent(href.slice(7).split('?')[0]).trim() }
        : { kind: 'phone', value: SCAN.normalizePhone(decodeURIComponent(href.slice(4))) };
      if (!contact.value) continue;
      var group = makeButtonGroup(contact);
      if (group && a.parentNode) a.insertAdjacentElement('afterend', group);
    }
  }

  // Inject buttons for contacts found in visible text nodes.
  function scanText(rootEl) {
    var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT') {
          return NodeFilter.FILTER_REJECT;
        }
        if (p.closest && p.closest('.crm-c2c-group')) return NodeFilter.FILTER_REJECT;
        if (p.hasAttribute && p.hasAttribute(MARK)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !/@|\d/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var pending = [];
    var n;
    while ((n = walker.nextNode())) pending.push(n);

    pending.forEach(function (node) {
      var host = node.parentNode;
      if (!host || host.hasAttribute(MARK)) return;
      var found = SCAN.extractContacts(node.nodeValue);
      if (found.emails.length === 0 && found.phones.length === 0) return;

      host.setAttribute(MARK, '1');
      var groups = [];
      found.emails.forEach(function (addr) {
        var g = makeButtonGroup({ kind: 'email', value: addr });
        if (g) groups.push(g);
      });
      found.phones.forEach(function (p) {
        var g = makeButtonGroup({ kind: 'phone', value: p.value });
        if (g) groups.push(g);
      });
      // Append the button groups right after the text's host element.
      groups.forEach(function (g) {
        if (host.parentNode) host.insertAdjacentElement
          ? host.insertAdjacentElement('afterend', g)
          : host.parentNode.appendChild(g);
      });
    });
  }

  function scan() {
    if (!cfg.enabled || !isAllowedCrmPage()) return;
    try {
      scanLinks(document.body);
      scanText(document.body);
    } catch (e) {
      console.warn('[crm-c2c] scan error', e);
    }
  }

  function scheduleRescan() {
    if (rescanTimer) return;
    rescanTimer = setTimeout(function () { rescanTimer = null; scan(); }, 400);
  }

  function initCrmScanner() {
    if (!cfg.enabled) return;
    if (!isAllowedCrmPage()) {
      console.log('[crm-c2c] page not in allowlist — scanner idle');
      return;
    }
    role = 'crm';
    scan();
    observer = new MutationObserver(function () { scheduleRescan(); });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    console.log('[crm-c2c] CRM scanner active on', location.host);
  }

  /* ── bootstrap ───────────────────────────────────────────────────────── */

  function start() {
    if (isDesktopContext()) {
      initDesktopBridge();
    } else {
      initCrmScanner();
    }
  }

  // React to config changes without a reload.
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'sync' || !changes.crmC2C) return;
      loadConfig(function () {
        // Cheap approach: re-scan if we are a CRM page; role rarely flips live.
        if (role === 'crm') scan();
      });
    });
  } catch (e) { /* storage API unavailable */ }

  loadConfig(start);
})();

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
    desktopUrlPattern: 'desktop.wxcc-us1.cisco.com',
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

  var CHANNEL_META = {
    call:  { label: '📞', title: 'Call' },
    sms:   { label: '💬', title: 'SMS' },
    email: { label: '✉',  title: 'Email' },
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
      btn.textContent = meta.label;
      btn.title = meta.title + ' ' + contact.value;
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
    if (isDesktopPage()) {
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

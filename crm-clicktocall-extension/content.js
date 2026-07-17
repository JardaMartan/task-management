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
      var payload = {
        __crmC2C: true,
        type: 'INITIATE_CONTACT',
        channel: msg.channel,
        destination: msg.destination,
        id: msg.id || (Date.now() + '-' + Math.random().toString(36).slice(2)),
        ts: Date.now(),
      };
      // 1) A widget bridge living in THIS frame (crmContactBridge, same window).
      try { window.postMessage(payload, '*'); } catch (e) { /* ignore */ }
      // 2) Forward down into any child iframes — covers widgets hosted in a
      //    sandboxed / blob: frame where the content script cannot be injected,
      //    so the shell frame relays the request into the widget frame.
      try {
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
          try { if (frames[i].contentWindow) frames[i].contentWindow.postMessage(payload, '*'); } catch (e) { /* cross-origin */ }
        }
      } catch (e) { /* ignore */ }
      console.log('[crm-c2c] bridge re-emitted', msg.channel, msg.destination, 'on', location.host);
    });
    console.log('[crm-c2c] desktop bridge active on', location.host);
  }

  /* ── CRM SCANNER role ────────────────────────────────────────────────── */

  // Genuine Momentum UI icon glyphs (handset_16 / sms_16 / email_16), taken from
  // @momentum-ui/icons, drawn with currentColor so they take the pill's channel
  // colour. sms_16 is the exact glyph the task-management widget uses.
  var CHANNEL_META = {
    call: {
      title: 'Call',
      svg: '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M2.65186929 2c-.203 0-.392.092-.517.252-.121.157-.163000004.356-.115.546.552 2.173 2.125 4.676 4.317 6.867 2.192 2.19 4.69200001 3.763 6.86500001 4.315.191.047.39.006.547-.116.16-.124.252-.312.252-.515l0-1.5c0-.412-.245-.783-.622-.945l-1.318-.567c-.382-.164-.817-.152-1.18900001.035l-.75.375c-.442.219-.978.162-1.363-.149-1.295-1.039-2.525-2.262-3.375-3.354-.299-.385-.354-.915-.137-1.35l.383-.766c.186-.372.199-.805.034-1.188l-.567-1.318c-.163-.378-.534-.622-.945-.622l-1.5 0zM13.3598693 15c-.135 0-.27-.017-.404-.05-2.34300001-.596-5.01300001-2.264-7.32600001-4.578-2.316-2.315-3.984000004-4.985-4.5790000042-7.328-.125-.491-.017-1.003.2950000002-1.405.316-.406.792000004-.639 1.306000004-.639l1.5 0c.812 0 1.543.482 1.863 1.228l.567 1.317c.282.654.26 1.394-.058 2.031l-.383.765c-.046.093-.034.203.032.288.792 1.019 1.994 2.211 3.212 3.189.085.069.197.081.289.034l.75-.375c.63700001-.317 1.37600001-.339 2.03200001-.059l1.317.567c.746.32 1.228 1.052 1.228 1.864l0 1.5c0 .514-.233.989-.638 1.305-.293.227-.644.346-1.003.346z"/></svg>',
    },
    sms: {
      title: 'SMS',
      svg: '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true"><path fill-rule="nonzero" d="M14.061,9.403 C13.741,9.634 13.296,9.751 12.729,9.751 C12.149,9.751 11.691,9.611 11.355,9.331 C11.071,9.094 10.901,8.781 10.844,8.388 L11.798,8.388 C11.834,8.601 11.939,8.765 12.111,8.881 C12.275,8.993 12.485,9.049 12.741,9.049 C13.277,9.049 13.544,8.882 13.544,8.55 C13.544,8.339 13.428,8.176 13.197,8.065 C13.065,8.001 12.821,7.926 12.464,7.842 C11.976,7.731 11.624,7.587 11.409,7.411 C11.136,7.187 11,6.882 11,6.499 C11,6.083 11.166,5.765 11.498,5.544 C11.798,5.349 12.21,5.25 12.735,5.25 C13.266,5.25 13.682,5.37 13.983,5.611 C14.243,5.819 14.399,6.099 14.451,6.451 L13.508,6.451 C13.485,6.279 13.39,6.147 13.226,6.054 C13.086,5.979 12.915,5.941 12.71,5.941 C12.247,5.941 12.014,6.087 12.014,6.379 C12.014,6.539 12.075,6.659 12.195,6.739 C12.315,6.819 12.546,6.897 12.89,6.972 C13.43,7.089 13.832,7.253 14.096,7.465 C14.405,7.709 14.558,8.033 14.558,8.437 C14.558,8.841 14.392,9.163 14.061,9.403 L14.061,9.403 Z M10.304,9.661 L9.392,9.661 L9.392,6.685 L8.378,9.661 L7.556,9.661 L6.518,6.691 L6.518,9.661 L5.666,9.661 L5.666,5.34 L6.818,5.34 L7.988,8.713 L9.123,5.34 L10.304,5.34 L10.304,9.661 Z M4.659,9.403 C4.338,9.634 3.894,9.751 3.327,9.751 C2.747,9.751 2.289,9.611 1.953,9.331 C1.668,9.094 1.498,8.781 1.443,8.388 L2.396,8.388 C2.432,8.601 2.537,8.765 2.708,8.881 C2.873,8.993 3.082,9.049 3.338,9.049 C3.874,9.049 4.142,8.882 4.142,8.55 C4.142,8.339 4.027,8.176 3.794,8.065 C3.663,8.001 3.418,7.926 3.062,7.842 C2.575,7.731 2.222,7.587 2.006,7.411 C1.735,7.187 1.598,6.882 1.598,6.499 C1.598,6.083 1.764,5.765 2.096,5.544 C2.396,5.349 2.808,5.25 3.332,5.25 C3.865,5.25 4.28,5.37 4.581,5.611 C4.84,5.819 4.997,6.099 5.048,6.451 L4.107,6.451 C4.082,6.279 3.989,6.147 3.825,6.054 C3.684,5.979 3.512,5.941 3.308,5.941 C2.844,5.941 2.613,6.087 2.613,6.379 C2.613,6.539 2.672,6.659 2.792,6.739 C2.913,6.819 3.144,6.897 3.489,6.972 C4.029,7.089 4.43,7.253 4.694,7.465 C5.002,7.709 5.156,8.033 5.156,8.437 C5.156,8.841 4.99,9.163 4.659,9.403 L4.659,9.403 Z M14.5,1 L1.5,1 C0.673,1 0,1.673 0,2.5 L0,12 C0,12.827 0.673,13.5 1.5,13.5 L1.5,15.5 C1.5,15.694 1.613,15.871 1.789,15.953 C1.856,15.984 1.928,16 2,16 C2.116,16 2.229,15.96 2.321,15.883 L5.182,13.5 L14.5,13.5 C15.328,13.5 16,12.827 16,12 L16,2.5 C16,1.673 15.328,1 14.5,1 L14.5,1 Z"/></svg>',
    },
    email: {
      title: 'Email',
      svg: '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M14 13L2 13c-.551 0-1-.449-1-1l0-7.762 5.616 4.294C7.023 8.844 7.512 9 8 9c.488 0 .977-.156 1.384-.468L15 4.238 15 12c0 .551-.449 1-1 1zm0-10c.249 0 .469.101.645.251L8.776 7.738c-.457.35-1.095.35-1.552 0L1.355 3.251C1.531 3.101 1.751 3 2 3l12 0zm0-1L2 2C.897 2 0 2.897 0 4l0 8c0 1.103.897 2 2 2l12 0c1.103 0 2-.897 2-2l0-8c0-1.103-.897-2-2-2z"/></svg>',
    },
  };

  function makeButtonGroup(contact /* {kind,value} */) {
    var group = document.createElement('span');
    group.className = 'crm-c2c-group';
    group.setAttribute('contenteditable', 'false');

    // Mirror the Customer 360 card: one pill per action, labelled with the
    // contact value. An email → Email pill; a phone → Call pill (+ SMS pill).
    var channels = contact.kind === 'email' ? ['email'] : ['call', 'sms'];

    channels.forEach(function (ch) {
      if (!cfg.channels[ch]) return;
      var meta = CHANNEL_META[ch];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crm-c2c-btn crm-c2c-btn--' + ch;
      btn.title = meta.title + ' ' + contact.value;
      btn.setAttribute('aria-label', meta.title + ' ' + contact.value);
      var ico = document.createElement('span');
      ico.className = 'crm-c2c-ico';
      ico.innerHTML = meta.svg;          // static, extension-authored markup only
      btn.appendChild(ico);
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

  // Reveal a button group only while its contact host (or the group itself) is
  // hovered. A short grace period lets the pointer travel from the text to the
  // pill without it disappearing.
  function attachHover(host, group) {
    if (!host || !group) return;
    var hideTimer = null;
    function show() {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      group.classList.add('crm-c2c-group--visible');
    }
    function hide() {
      hideTimer = setTimeout(function () {
        group.classList.remove('crm-c2c-group--visible');
        hideTimer = null;
      }, 200);
    }
    host.addEventListener('mouseenter', show);
    host.addEventListener('mouseleave', hide);
    group.addEventListener('mouseenter', show);
    group.addEventListener('mouseleave', hide);
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
      // Phone links must still be a valid E.164 number (leading +).
      if (contact.kind === 'phone' && !SCAN.isE164(contact.value)) continue;
      var group = makeButtonGroup(contact);
      if (group && a.parentNode) {
        a.insertAdjacentElement('afterend', group);
        attachHover(a, group);
      }
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
      // Insert each button group right after the text's host element and reveal
      // it only while the contact (or the pill) is hovered.
      groups.forEach(function (g) {
        if (host.insertAdjacentElement) host.insertAdjacentElement('afterend', g);
        else if (host.parentNode) host.parentNode.appendChild(g);
        attachHover(host, g);
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
    // Every frame installs the bridge listener so a routed INITIATE_CONTACT is
    // re-emitted into whichever frame actually hosts the widget (and forwarded
    // to child frames). Scanning stays limited to non-Desktop pages so we never
    // inject buttons into the Desktop UI itself.
    initDesktopBridge();
    if (!isDesktopContext()) {
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

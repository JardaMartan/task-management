/*
 * field-transfer.js — runs in every page/frame (see manifest content_scripts).
 *
 * Wrap-up → CRM field transfer. Complements content.js (click-to-contact) with a
 * second, independent concern: copying the agent's wrap-up notes into a chosen
 * text field of the CRM that is loaded inside the crm-tab-manager iframes.
 *
 * Two roles, decided at runtime:
 *
 *   1. DESKTOP FORWARDER — when this frame is part of the Webex CC Desktop.
 *      Bridges the headless widget (panel-layout-headless.js) and the background
 *      worker: window.postMessage({__crmWrap}) → chrome.runtime → background, and
 *      background WRAP_PUSH events → window.postMessage({__crmWrapPush}) so the
 *      widget can refresh its status / glow.
 *
 *   2. CRM PARTICIPANT — every other (non-desktop, non tab-manager-chrome) frame.
 *      Handles the element picker (frame + glow candidate fields, remember the
 *      chosen one), the persistent target glow, and writing the wrap-up text into
 *      the target field. Only frames whose origin matches the remembered target
 *      ever glow / write, so unrelated pages are never touched.
 *
 * Storage (chrome.storage.sync):
 *   crmC2C          — shared config (enabled, desktopUrlPattern, crmManagerUrlPattern)
 *   crmWrapTransfer — { mode: 'manual'|'auto', target: { origin, selector } | null }
 */
(function () {
  'use strict';

  var DEFAULTS = {
    enabled: true,
    desktopUrlPattern: 'desktop.wxcc',
    crmManagerUrlPattern: 'crm-tab-manager',
  };

  var cfg = DEFAULTS;
  var wrap = { mode: 'manual', target: null };
  var role = null; // 'desktop' | 'crm'

  /* ── config ──────────────────────────────────────────────────────────── */

  function loadConfig(cb) {
    try {
      chrome.storage.sync.get(['crmC2C', 'crmWrapTransfer'], function (res) {
        var stored = (res && res.crmC2C) || {};
        cfg = {
          enabled: stored.enabled !== false,
          desktopUrlPattern: stored.desktopUrlPattern || DEFAULTS.desktopUrlPattern,
          crmManagerUrlPattern: stored.crmManagerUrlPattern || DEFAULTS.crmManagerUrlPattern,
        };
        wrap = (res && res.crmWrapTransfer) || { mode: 'manual', target: null, targets: [] };
        if (wrap && !Array.isArray(wrap.targets)) wrap.targets = wrap.target ? [wrap.target] : [];
        cb();
      });
    } catch (e) {
      cfg = DEFAULTS;
      cb();
    }
  }

  function matchesPattern(href, pattern) {
    if (!pattern || !href) return false;
    if (pattern === '*') return true;
    if (pattern.indexOf('*') !== -1) {
      var re = new RegExp('^' + pattern.split('*').map(function (s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('.*'));
      return re.test(href);
    }
    return href.indexOf(pattern) !== -1;
  }

  function isDesktopContext() {
    if (matchesPattern(location.href, cfg.desktopUrlPattern)) return true;
    try {
      var ao = window.location.ancestorOrigins;
      if (ao && ao.length) {
        for (var i = 0; i < ao.length; i++) {
          if (matchesPattern(ao[i], cfg.desktopUrlPattern)) return true;
        }
      }
    } catch (e) { /* ancestorOrigins unavailable */ }
    return false;
  }

  // The tab-manager shell / crm-proxy chrome must NOT participate as a CRM field
  // frame — only the actual embedded CRM (a nested cross-origin frame) does.
  function isManagerChrome() {
    return matchesPattern(location.href, cfg.crmManagerUrlPattern) ||
      location.href.indexOf('crm-proxy.html') !== -1;
  }

  /* ── selector build / resolve / write ────────────────────────────────── */

  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  // Build a reasonably robust CSS selector: prefer a unique id anchor, otherwise
  // walk up composing tag + [name] or :nth-of-type until a unique id is reached.
  function buildSelector(el) {
    if (!el || el === document.body) return 'body';
    if (el.id && document.querySelectorAll('#' + cssEscape(el.id)).length === 1) {
      return '#' + cssEscape(el.id);
    }
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      if (node.id && document.querySelectorAll('#' + cssEscape(node.id)).length === 1) {
        parts.unshift('#' + cssEscape(node.id));
        break;
      }
      var part = node.nodeName.toLowerCase();
      var name = node.getAttribute && node.getAttribute('name');
      if (name) {
        part += '[name="' + name.replace(/"/g, '\\"') + '"]';
      } else {
        var parent = node.parentNode;
        if (parent && parent.children) {
          var same = Array.prototype.filter.call(parent.children, function (c) {
            return c.nodeName === node.nodeName;
          });
          if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
        }
      }
      parts.unshift(part);
      node = node.parentNode;
    }
    return parts.join(' > ');
  }

  function cssAttr(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

  function isFieldVisible(el) {
    if (!el) return false;
    try {
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkVisibilityCSS: true })) return false;
      var r = el.getBoundingClientRect();
      return r.width > 10 && r.height > 6;
    } catch (e) { return false; }
  }

  function labelTextFor(el) {
    try {
      var al = el.getAttribute && el.getAttribute('aria-label');
      if (al) return al.trim();
      if (el.id) { var l = document.querySelector('label[for="' + cssEscape(el.id) + '"]'); if (l) return (l.textContent || '').replace(/\s+/g, ' ').trim(); }
      var lab = el.closest && el.closest('label');
      if (lab) { var t = (lab.textContent || '').replace(/\s+/g, ' ').trim(); if (t && t.length < 80) return t; }
      var p = el.previousElementSibling, hop = 0;
      while (p && hop < 3) {
        if (/^(label|span|div|p|strong|b)$/i.test(p.tagName)) {
          var tx = (p.textContent || '').replace(/\s+/g, ' ').trim();
          if (tx && tx.length < 60) return tx;
        }
        p = p.previousElementSibling; hop++;
      }
    } catch (e) { /* ignore */ }
    return '';
  }

  // Stable, card-independent fingerprint of a field so we can re-find "the same
  // field" after the CRM shows a different customer card or changes its markup.
  var _DATA_ATTRS = ['data-testid', 'data-test', 'data-field', 'data-name', 'data-qa'];
  function fieldSignature(el) {
    var dataAttr = '', dataName = '';
    for (var i = 0; i < _DATA_ATTRS.length; i++) {
      var v = el.getAttribute && el.getAttribute(_DATA_ATTRS[i]);
      if (v) { dataAttr = _DATA_ATTRS[i]; dataName = v; break; }
    }
    return {
      tag: el.tagName.toLowerCase(),
      type: ((el.getAttribute && el.getAttribute('type')) || '').toLowerCase(),
      name: (el.getAttribute && el.getAttribute('name')) || '',
      placeholder: (el.getAttribute && el.getAttribute('placeholder')) || '',
      ariaLabel: (el.getAttribute && el.getAttribute('aria-label')) || '',
      id: el.id || '',
      idStem: (el.id || '').replace(/[-_]?\d+$/, ''),   // note-13 → note
      labelText: labelTextFor(el),
      dataAttr: dataAttr, dataName: dataName,
    };
  }

  function selectorsFromSignature(sig) {
    var tag = sig.tag || '*', out = [];
    if (sig.name) out.push(tag + '[name="' + cssAttr(sig.name) + '"]');
    if (sig.dataAttr && sig.dataName) out.push(tag + '[' + sig.dataAttr + '="' + cssAttr(sig.dataName) + '"]');
    if (sig.ariaLabel) out.push(tag + '[aria-label="' + cssAttr(sig.ariaLabel) + '"]');
    if (sig.placeholder) out.push(tag + '[placeholder="' + cssAttr(sig.placeholder) + '"]');
    if (sig.id) out.push('#' + cssEscape(sig.id));
    if (sig.idStem && sig.idStem !== sig.id) out.push(tag + '[id^="' + cssAttr(sig.idStem) + '"]');
    return out;
  }

  function buildTargetDescriptor(el) {
    var sig = fieldSignature(el);
    var selectors = selectorsFromSignature(sig);
    var path = buildSelector(el);
    if (path && selectors.indexOf(path) < 0) selectors.push(path);
    return { origin: location.origin, selectors: selectors, selector: selectors[0] || path, signature: sig, addedAt: Date.now() };
  }

  function sameSignature(a, b) {
    if (!a || !b) return false;
    return a.tag === b.tag && a.name === b.name && a.placeholder === b.placeholder &&
      a.ariaLabel === b.ariaLabel && a.labelText === b.labelText && a.idStem === b.idStem &&
      a.dataName === b.dataName;
  }

  function matchScore(el, sig) {
    if (!el || !sig) return 0;
    if (sig.tag && el.tagName.toLowerCase() !== sig.tag) return 0;
    var s = 0, g = function (a) { return (el.getAttribute && el.getAttribute(a)) || ''; };
    if (sig.name && g('name') === sig.name) s += 5;
    if (sig.dataAttr && sig.dataName && g(sig.dataAttr) === sig.dataName) s += 5;
    if (sig.ariaLabel && g('aria-label') === sig.ariaLabel) s += 4;
    if (sig.placeholder && g('placeholder') === sig.placeholder) s += 4;
    if (sig.labelText && labelTextFor(el) === sig.labelText) s += 3;
    if (sig.idStem && (el.id || '').replace(/[-_]?\d+$/, '') === sig.idStem) s += 2;
    if (sig.type && g('type') === sig.type) s += 1;
    return s;
  }

  function targetDescriptors(explicit) {
    var list = [];
    if (explicit) list.push(explicit);
    if (wrap) {
      if (wrap.targets && wrap.targets.length) list = list.concat(wrap.targets);
      if (wrap.target) list.push(wrap.target);
    }
    return list.filter(function (d) { return d && (!d.origin || d.origin === location.origin); });
  }

  // Resolve a live target field, tolerating page/card changes: try each
  // remembered descriptor's selectors, then fall back to matching a currently
  // present field by signature (so the same field on a different customer card
  // still resolves without re-selection).
  function resolveTarget(explicit) {
    var list = targetDescriptors(explicit);
    if (!list.length) return null;
    // 1) Exact selectors — prefer a VISIBLE match (several customer cards may
    //    share the same markup, only one of which is on screen).
    for (var i = 0; i < list.length; i++) {
      var sels = list[i].selectors || (list[i].selector ? [list[i].selector] : []);
      for (var j = 0; j < sels.length; j++) {
        var nodes = [];
        try { nodes = document.querySelectorAll(sels[j]); } catch (e) { nodes = []; }
        var firstAny = null;
        for (var x = 0; x < nodes.length; x++) {
          if (!firstAny) firstAny = nodes[x];
          if (isFieldVisible(nodes[x])) return nodes[x];
        }
        if (firstAny && nodes.length === 1 && isFieldVisible(firstAny)) return firstAny;
      }
    }
    // 2) Signature match across the fields currently present.
    var cands = candidateFields();
    var best = null, bestScore = 0;
    for (var k = 0; k < list.length; k++) {
      var sig = list[k].signature;
      if (!sig) continue;
      for (var c = 0; c < cands.length; c++) {
        var sc = matchScore(cands[c], sig);
        if (sc > bestScore) { bestScore = sc; best = cands[c]; }
      }
    }
    return bestScore >= 3 ? best : null;
  }

  // React/Angular controlled inputs ignore a plain `.value =`; use the native
  // prototype setter then dispatch input/change so the framework registers it.
  function setNativeValue(el, value) {
    try {
      var proto = (el.tagName === 'TEXTAREA')
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) { desc.set.call(el, value); return; }
    } catch (e) { /* fall through */ }
    el.value = value;
  }

  function appendText(el, text) {
    if (!el || !text) return false;
    if (el.isContentEditable) {
      var existingCe = el.textContent || '';
      var sepCe = existingCe && !/\n$/.test(existingCe) ? '\n' : '';
      el.textContent = existingCe + sepCe + text;
      try { el.dispatchEvent(new InputEvent('input', { bubbles: true })); } catch (e) { /* ignore */ }
      return true;
    }
    var existing = el.value || '';
    var sep = existing && !/\n$/.test(existing) ? '\n' : '';
    setNativeValue(el, existing + sep + text);
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { /* ignore */ }
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* ignore */ }
    return true;
  }

  /* ── caret-aware insert ──────────────────────────────────────────────── */

  // Remember where the agent last put the cursor in a CRM text field, so a
  // transfer inserts at that spot even though focus has since moved to the
  // Desktop widget. { el, start, end } for input/textarea; { el, range } for CE.
  var _lastCaret = null;

  function trackCaret(ev) {
    var el;
    try {
      if (ev && ev.composedPath) { var p = ev.composedPath(); el = (p && p.length) ? p[0] : ev.target; }
      else el = (ev && ev.target) || document.activeElement;
    } catch (e) { el = ev && ev.target; }
    if (!el || el.nodeType !== 1) return;
    if (el.closest && el.closest('.crm-wrap-ignore')) return;
    try {
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && typeof el.selectionStart === 'number') {
        _lastCaret = { el: el, start: el.selectionStart, end: el.selectionEnd };
      } else if (el.isContentEditable) {
        var sel = window.getSelection && window.getSelection();
        if (sel && sel.rangeCount && el.contains(sel.anchorNode)) _lastCaret = { el: el, range: sel.getRangeAt(0).cloneRange() };
      }
    } catch (e) { /* ignore */ }
  }

  function insertAtCaret(el, text) {
    if (!el || !text) return false;
    try {
      if (el.isContentEditable) {
        el.focus();
        var sel = window.getSelection && window.getSelection();
        if (sel && _lastCaret && _lastCaret.el === el && _lastCaret.range) {
          try { sel.removeAllRanges(); sel.addRange(_lastCaret.range); } catch (e) { /* ignore */ }
        }
        if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
          var ok = false;
          try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
          if (!ok) {
            var rg = sel.getRangeAt(0); rg.deleteContents();
            var node = document.createTextNode(text); rg.insertNode(node);
            rg.setStartAfter(node); rg.collapse(true); sel.removeAllRanges(); sel.addRange(rg);
          }
          try { el.dispatchEvent(new InputEvent('input', { bubbles: true })); } catch (e) { /* ignore */ }
          _lastCaret = null;
          return true;
        }
        return appendText(el, text);
      }
      if (typeof el.value !== 'string') return appendText(el, text);
      var start, end;
      if (document.activeElement === el && typeof el.selectionStart === 'number') {
        start = el.selectionStart; end = el.selectionEnd;
      } else if (_lastCaret && _lastCaret.el === el && _lastCaret.start != null) {
        start = _lastCaret.start; end = _lastCaret.end;
      } else {
        return appendText(el, text);   // no known cursor → append at the end
      }
      var v = el.value || '';
      start = Math.max(0, Math.min(start, v.length));
      end = Math.max(start, Math.min(end == null ? start : end, v.length));
      setNativeValue(el, v.slice(0, start) + text + v.slice(end));
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { /* ignore */ }
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* ignore */ }
      var caret = start + text.length;
      try { el.focus(); el.setSelectionRange(caret, caret); } catch (e) { /* ignore */ }
      _lastCaret = { el: el, start: caret, end: caret };
      return true;
    } catch (e) { return appendText(el, text); }
  }

  /* ── persistent target glow ──────────────────────────────────────────── */

  var glowObserver = null;
  var glowTimer = null;
  var glowActive = false;   // true only while the Desktop is in wrap-up (HIGHLIGHT..UNHIGHLIGHT)

  function clearGlow() {
    var prev = document.querySelectorAll('.crm-wrap-target-glow');
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove('crm-wrap-target-glow');
  }

  function applyGlow() {
    if (glowObserver) glowObserver.disconnect();
    clearGlow();
    var el = resolveTarget();
    if (el) {
      try { el.style.setProperty('--crm-wrap-glow', (wrap && wrap.glowColor) || '#0e7fc1'); } catch (e) { /* ignore */ }
      el.classList.add('crm-wrap-target-glow');
    }
    if (glowActive && glowObserver && document.body) {
      glowObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function scheduleGlow() {
    if (glowTimer || !glowActive) return;
    glowTimer = setTimeout(function () { glowTimer = null; applyGlow(); }, 500);
  }

  function startGlowWatch() {
    if (!document.body) return;
    glowActive = true;
    applyGlow();
    if (!glowObserver && window.MutationObserver) {
      glowObserver = new MutationObserver(function () { scheduleGlow(); });
      glowObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function stopGlowWatch() {
    glowActive = false;
    if (glowTimer) { clearTimeout(glowTimer); glowTimer = null; }
    if (glowObserver) glowObserver.disconnect();
    clearGlow();
  }

  /* ── element picker ──────────────────────────────────────────────────── */

  var CANDIDATE_SEL = 'textarea, input[type="text"], input[type="search"], input:not([type]), [contenteditable=""], [contenteditable="true"], [role="textbox"]';
  var pickerActive = false;
  var pickerBanner = null;

  function deepQueryAll(root, sel) {
    var out = [];
    if (!root || !root.querySelectorAll) return out;
    try { Array.prototype.push.apply(out, root.querySelectorAll(sel)); } catch (e) { /* ignore */ }
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) { if (all[i].shadowRoot) out = out.concat(deepQueryAll(all[i].shadowRoot, sel)); }
    return out;
  }

  function candidateFields() {
    return deepQueryAll(document, CANDIDATE_SEL).filter(function (el) {
      if (el.closest && el.closest('.crm-wrap-ignore')) return false;
      return isFieldVisible(el);
    });
  }

  function candidateAt(evTarget, ev) {
    var path = (ev && ev.composedPath) ? ev.composedPath() : null;
    if (path) {
      for (var i = 0; i < path.length; i++) {
        var n = path[i];
        if (n && n.nodeType === 1 && n.matches && n.matches(CANDIDATE_SEL)) {
          if (n.closest && n.closest('.crm-wrap-ignore')) return null;
          return n;
        }
      }
    }
    if (evTarget && evTarget.closest) {
      var el = evTarget.closest(CANDIDATE_SEL);
      if (el && !(el.closest && el.closest('.crm-wrap-ignore'))) return el;
    }
    return null;
  }

  // Inline framing so candidates are visible even inside shadow roots (page CSS
  // does not pierce shadow boundaries).
  function frameCandidate(el, on) {
    if (!el || !el.style) return;
    if (on) {
      el.style.setProperty('outline', '2px dashed #1a73e8', 'important');
      el.style.setProperty('outline-offset', '2px', 'important');
      el.style.setProperty('cursor', 'pointer', 'important');
    } else {
      el.style.removeProperty('outline');
      el.style.removeProperty('outline-offset');
      el.style.removeProperty('cursor');
      el.style.removeProperty('background-color');
    }
  }
  function frameHover(el, on) {
    if (!el || !el.style) return;
    if (on) {
      el.style.setProperty('outline', '3px solid #1a73e8', 'important');
      el.style.setProperty('background-color', 'rgba(26,115,232,0.10)', 'important');
    } else {
      el.style.setProperty('outline', '2px dashed #1a73e8', 'important');
      el.style.removeProperty('background-color');
    }
  }

  var pickHover = null;
  var pickList = [];

  function onPickOver(ev) {
    var el = candidateAt(ev.target, ev);
    if (el === pickHover) return;
    if (pickHover) frameHover(pickHover, false);
    pickHover = el;
    if (el) frameHover(el, true);
  }

  function onPickClick(ev) {
    var el = candidateAt(ev.target, ev);
    if (!el) return;
    ev.preventDefault();
    ev.stopPropagation();
    chooseTarget(el);
  }

  function onPickKey(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); stopPicker(); }
  }

  function showPickerBanner() {
    if (pickerBanner) return;
    pickerBanner = document.createElement('div');
    pickerBanner.className = 'crm-wrap-picker-banner crm-wrap-ignore';
    pickerBanner.textContent = 'Click a field to receive wrap-up notes — Esc to cancel';
    document.body.appendChild(pickerBanner);
  }

  function startPicker() {
    if (pickerActive || isManagerChrome()) {
      console.log('[crm-wrap] picker: skipped (active=' + pickerActive + ', managerChrome=' + isManagerChrome() + ') on', location.host);
      return;
    }
    pickerActive = true;
    pickList = candidateFields();
    console.log('[crm-wrap] picker: ' + pickList.length + ' candidate field(s) on', location.host);
    if (pickList.length === 0) { pickerActive = false; console.warn('[crm-wrap] picker: no fields found on', location.host, '— is the CRM field in this frame?'); return; }
    for (var i = 0; i < pickList.length; i++) { pickList[i].classList.add('crm-wrap-candidate'); frameCandidate(pickList[i], true); }
    document.addEventListener('mouseover', onPickOver, true);
    document.addEventListener('click', onPickClick, true);
    document.addEventListener('keydown', onPickKey, true);
    showPickerBanner();
  }

  function stopPicker() {
    if (!pickerActive) return;
    pickerActive = false;
    document.removeEventListener('mouseover', onPickOver, true);
    document.removeEventListener('click', onPickClick, true);
    document.removeEventListener('keydown', onPickKey, true);
    for (var i = 0; i < pickList.length; i++) {
      pickList[i].classList.remove('crm-wrap-candidate');
      pickList[i].classList.remove('crm-wrap-candidate--hover');
      frameCandidate(pickList[i], false);
    }
    pickList = [];
    pickHover = null;
    if (pickerBanner) { try { pickerBanner.remove(); } catch (e) { /* ignore */ } pickerBanner = null; }
  }

  function chooseTarget(el) {
    var descriptor = buildTargetDescriptor(el);
    wrap = wrap || { mode: 'manual', target: null, targets: [] };
    wrap.targets = (Array.isArray(wrap.targets) ? wrap.targets : []).filter(function (t) {
      return !sameSignature(t.signature, descriptor.signature);
    });
    wrap.targets.unshift(descriptor);
    if (wrap.targets.length > 8) wrap.targets.length = 8;
    wrap.target = descriptor;
    try {
      chrome.runtime.sendMessage({ type: 'WRAP_PICKER_RESULT', descriptor: descriptor });
    } catch (e) { /* ignore */ }
    stopPicker();
    startGlowWatch();
    console.log('[crm-wrap] target remembered', descriptor.selector, '(' + wrap.targets.length + ' total) on', location.origin);
  }

  /* ── CRM PARTICIPANT role ────────────────────────────────────────────── */

  function initCrmParticipant() {
    role = 'crm';
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg) return;
      if (msg.type === 'WRAP_PICKER_START') {
        console.log('[crm-wrap] received WRAP_PICKER_START on', location.host);
        startPicker();
        return;
      }
      if (msg.type === 'WRAP_WRITE') {
        if (msg.targets) wrap.targets = msg.targets;
        if (msg.target) wrap.target = msg.target;
        var el = resolveTarget();
        if (el) {
          insertAtCaret(el, msg.text || '');
          if (glowActive) applyGlow();
          try { sendResponse({ ok: true }); } catch (e) { /* ignore */ }
        }
        return;
      }
      if (msg.type === 'WRAP_HIGHLIGHT') {
        if (msg.color) { wrap = wrap || { mode: 'manual', target: null }; wrap.glowColor = msg.color; }
        startGlowWatch();
        return;
      }
      if (msg.type === 'WRAP_UNHIGHLIGHT') {
        stopGlowWatch();
        return;
      }
      if (msg.type === 'WRAP_CLEAR_TARGET') {
        stopPicker();
        clearGlow();
        return;
      }
    });
    // Remember the cursor position in CRM text fields for caret-aware transfer.
    ['focusin', 'keyup', 'mouseup', 'select'].forEach(function (t) {
      document.addEventListener(t, trackCaret, true);
    });
  }

  /* ── DESKTOP FORWARDER role ──────────────────────────────────────────── */

  function initDesktopForwarder() {
    role = 'desktop';
    // Widget → background (request/response bridged back over postMessage).
    window.addEventListener('message', function (ev) {
      var d = ev.data;
      if (!d || d.__crmWrap !== true || ev.source !== window) return;
      var reqId = d.reqId;
      try {
        chrome.runtime.sendMessage({ type: 'WRAP_REQ', payload: d.payload }, function (resp) {
          var err = chrome.runtime.lastError;
          try { window.postMessage({ __crmWrapReply: true, reqId: reqId, resp: resp || { ok: false, error: err && err.message } }, '*'); } catch (e) { /* ignore */ }
        });
      } catch (e) {
        // Extension context invalidated (e.g. extension reloaded, tab not) — reply
        // with an error so the widget stops timing out and can prompt a reload.
        try { window.postMessage({ __crmWrapReply: true, reqId: reqId, resp: { ok: false, error: String((e && e.message) || e) } }, '*'); } catch (e2) { /* ignore */ }
      }
    });
    // background → widget (async pushes: target picked / cleared).
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === 'WRAP_PUSH') {
        try { window.postMessage({ __crmWrapPush: true, event: msg.event }, '*'); } catch (e) { /* ignore */ }
      }
    });
  }

  /* ── bootstrap ───────────────────────────────────────────────────────── */

  function start() {
    if (!cfg.enabled) { console.log('[crm-wrap] disabled'); return; }
    if (isManagerChrome()) {
      console.log('[crm-wrap] tab-manager chrome — idle on', location.host);
      return;
    }
    // Run BOTH roles in every non-manager frame. The widget→background forwarder
    // must run wherever the widget posts __crmWrap (the Webex CC Desktop frame,
    // which may be desktop.wxcc*, web.webex.com, …) so we no longer gate it on a
    // URL pattern. The CRM participant lets this frame be a pick/write target;
    // the background excludes the widget's own tab, so the Desktop never frames
    // its own fields.
    initDesktopForwarder();
    initCrmParticipant();
    console.log('[crm-wrap] active (forwarder + participant) on', location.host);
  }

  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'sync') return;
      if (changes.crmWrapTransfer) {
        wrap = changes.crmWrapTransfer.newValue || { mode: 'manual', target: null };
        if (role === 'crm' && glowActive) applyGlow();
      }
    });
  } catch (e) { /* storage API unavailable */ }

  loadConfig(start);
})();

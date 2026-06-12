/**
 * panel-layout-headless.js
 * Headless widget loaded by Webex CC Desktop via layout JSON area.headless.
 * Narrows the digital-channel left panel by patching grid-template-columns
 * directly on <router-view>, which is the known grid container.
 * Uses polling + shadow DOM traversal because router-view lives inside a
 * shadow root and is invisible to document.querySelector and MutationObserver.
 */
(function () {
  'use strict';

  var COLUMNS       = 'var(--nav-bar-width) auto minmax(auto, 0.6fr) 1.5fr auto';
  var EMAIL_COLUMNS  = 'var(--nav-bar-width) auto 0 1.5fr auto';  // col3 collapsed; col4 gets full remaining width
  var styleObserver = null;
  var pollInterval  = null;
  var _observerPaused = false;  // set true during email layout to suppress re-patch

  /**
   * Recursively search for <router-view> inside shadow roots.
   */
  function findInShadow(root) {
    var el = root.querySelector('router-view');
    if (el) return el;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        el = findInShadow(all[i].shadowRoot);
        if (el) return el;
      }
    }
    return null;
  }

  function findRouterView() {
    return document.querySelector('router-view') || findInShadow(document.body);
  }

  function patchRouterView(el) {
    var current = el.style.gridTemplateColumns;
    console.log('[panel-layout] <router-view> found | current grid-template-columns:', current || '(none)');
    if (current === COLUMNS) {
      console.log('[panel-layout] already patched, skipping');
      return;
    }
    el.style.setProperty('grid-template-columns', COLUMNS, 'important');
    console.log('[panel-layout] ✅ PATCHED <router-view> | now:', el.style.gridTemplateColumns);

    // Watch for the platform resetting the inline style on task change
    if (!styleObserver) {
      styleObserver = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].attributeName === 'style') {
            if (_observerPaused) return;  // email layout owns the columns right now
            var newVal = el.style.gridTemplateColumns;
            if (newVal !== COLUMNS) {
              console.log('[panel-layout] style reset detected, re-patching | was:', newVal);
              el.style.setProperty('grid-template-columns', COLUMNS, 'important');
            }
          }
        }
      });
      styleObserver.observe(el, { attributes: true, attributeFilter: ['style'] });
      console.log('[panel-layout] Style observer attached to <router-view>');
    }
  }

  // Poll every 500ms — works regardless of shadow DOM depth
  var attempts = 0;
  pollInterval = setInterval(function () {
    attempts++;
    var el = findRouterView();
    if (el) {
      clearInterval(pollInterval);
      console.log('[panel-layout] router-view found after', attempts, 'poll attempt(s)');
      patchRouterView(el);
    } else if (attempts % 10 === 0) {
      console.log('[panel-layout] still polling for router-view... attempt', attempts);
    }
  }, 500);

  console.log('[panel-layout] headless widget active — polling for router-view every 500ms');

  // ─── Task-type indicator ──────────────────────────────────────────────────

  var WRAPPER_SELECTOR = 'agentx-react-interaction-control-wrapper';

  // Base (light-mode) palette — soft orange tints, dark text stays legible
  var MEDIA_TYPE_COLORS_LIGHT = {
    email:     '#FFF0E0',   // warm peach
    chat:      '#FFE8CC',   // soft apricot
    telephony: '#FFE4B5',   // moccasin / light amber
  };

  // ── Color math helpers ────────────────────────────────────────────────────
  function _hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  }
  function _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var l = (max + min) / 2;
    var s = d === 0 ? 0 : (l > 0.5 ? d / (2 - max - min) : d / (max + min));
    var h = 0;
    if (d !== 0) {
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: h, s: s, l: l };
  }
  function _hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  function _hslToHex(h, s, l) {
    var r, g, b;
    if (s === 0) { r = g = b = l; } else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = _hue2rgb(p, q, h + 1/3);
      g = _hue2rgb(p, q, h);
      b = _hue2rgb(p, q, h - 1/3);
    }
    return '#' + [r, g, b].map(function(x) {
      return ('0' + Math.round(x * 255).toString(16)).slice(-2);
    }).join('');
  }
  /**
   * Given any hex color, return its dark-mode complement:
   * same hue, saturation boosted slightly, lightness clamped to ~30%.
   * This ensures any light pastel maps to a deep-rich tone that
   * remains readable with white text.
   */
  function _darkComplement(hex) {
    var rgb = _hexToRgb(hex);
    if (!rgb) return hex;   // non-hex passthrough (e.g. named colors)
    var hsl = _rgbToHsl(rgb.r, rgb.g, rgb.b);
    var darkL = Math.min(hsl.l, 0.30);          // cap at 30% lightness
    var darkS = Math.min(hsl.s * 1.15, 1.0);    // 15% saturation boost
    return _hslToHex(hsl.h, darkS, darkL);
  }

  // Resolved at runtime — starts as light, flips on darkmode attribute
  var _darkMode = false;
  var _signalColor = null;   // set if Desktop passes signalColor property

  function resolveColor(mediaType) {
    var base = _signalColor || MEDIA_TYPE_COLORS_LIGHT[mediaType] || null;
    if (!base) return null;
    return _darkMode ? _darkComplement(base) : base;
  }

  function detectMediaType(parsed) {
    return String(
      parsed.mediaType       ||
      parsed.channelType     ||
      (parsed.callAssociatedData  && parsed.callAssociatedData.taskType  && parsed.callAssociatedData.taskType.value)  ||
      (parsed.callAssociatedDetails && parsed.callAssociatedDetails.taskType) ||
      ''
    ).toLowerCase();
  }

  /**
   * Find WRAPPER_SELECTOR anywhere in the document, including inside shadow roots.
   */
  function findWrapper(root) {
    root = root || document.body;
    var el = root.querySelector(WRAPPER_SELECTOR);
    if (el) return el;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        el = findWrapper(all[i].shadowRoot);
        if (el) return el;
      }
    }
    return null;
  }

  /**
   * Apply (or clear) a color indicator on the interaction control wrapper.
   * Uses shadow DOM traversal and falls back to polling if not yet rendered.
   */
  function applyTaskIndicator(mediaType) {
    var wrapper = findWrapper();
    console.log('[panel-layout] applyTaskIndicator | mediaType:', mediaType, '| wrapper found:', !!wrapper);
    if (!wrapper) {
      // Wrapper not in DOM yet — retry once it appears (up to ~3 s)
      var retries = 0;
      var retryInterval = setInterval(function () {
        retries++;
        wrapper = findWrapper();
        if (wrapper) {
          clearInterval(retryInterval);
          console.log('[panel-layout] wrapper found on retry', retries);
          setIndicatorStyle(wrapper, mediaType);
        } else if (retries >= 6) {
          clearInterval(retryInterval);
          console.warn('[panel-layout] ' + WRAPPER_SELECTOR + ' not found after retries (incl. shadow DOM search)');
        }
      }, 500);
      return;
    }
    setIndicatorStyle(wrapper, mediaType);
  }

  function setIndicatorStyle(wrapper, mediaType) {
    // Clean up previously injected indicator style from shadow root
    if (wrapper.shadowRoot) {
      var old = wrapper.shadowRoot.getElementById('task-indicator-style');
      if (old) old.remove();
    }

    // Reset outer element state
    wrapper.removeAttribute('data-task-media-type');
    wrapper.style.removeProperty('--task-indicator-color');
    wrapper.style.backgroundColor = '';
    wrapper.style.borderLeft = '';

    if (!mediaType) return;

    wrapper.setAttribute('data-task-media-type', mediaType);

    var color = resolveColor(mediaType);
    if (!color) {
      console.log('[panel-layout] unknown mediaType for indicator:', mediaType);
      return;
    }

    // Always keep the CSS variable on the outer element for external CSS hooks
    wrapper.style.setProperty('--task-indicator-color', color);

    // Text color: dark text on light bg, light text on dark bg
    var textColor = _darkMode ? '#e8f0fe' : '#1a1a2e';

    if (wrapper.shadowRoot) {
      var style = document.createElement('style');
      style.id = 'task-indicator-style';
      style.textContent = '.interaction-control-wrapper { background-color: ' + color + ' !important; color: ' + textColor + ' !important; }';
      wrapper.shadowRoot.appendChild(style);
      console.log('[panel-layout] indicator injected into shadow root | mediaType:', mediaType, '| color:', color);
    } else {
      wrapper.style.backgroundColor = color;
      wrapper.style.color = textColor;
      console.log('[panel-layout] indicator applied via inline style (no shadow root) | mediaType:', mediaType, '| color:', color);
    }
  }

  // ─── WorkItem layout patches (col3 collapse only, no panel repositioning) ───

  var _workItemLayoutActive  = false;

  function applyWorkItemLayout() {
    if (_workItemLayoutActive) return;
    console.log('[panel-layout] applyWorkItemLayout triggered');
    var rv = findRouterView();
    if (!rv) { console.warn('[panel-layout] workItem layout: router-view not found'); return; }
    // Reuse the same CSS injection as email — hide engage panel, stretch to full width
    _doApplyEngageHide(rv);
    _workItemLayoutActive = true;
  }

  function clearWorkItemLayout() {
    if (!_workItemLayoutActive) return;
    _workItemLayoutActive = false;
    clearEmailGridLayout();
    console.log('[panel-layout] workItem layout cleared');
  }

  // ─── Email layout patches ─────────────────────────────────────────────────

  var EMAIL_COMPOSER_STYLE_ID = 'panel-layout-email-composer-hide';
  var _emailComposerStyleRoot = null;
  var emailLayoutActive       = false;

  /** Generic shadow-DOM element finder — same traversal pattern as findWrapper(). */
  function findDeep(root, selector) {
    root = root || document.body;
    var el = root.querySelector(selector);
    if (el) return el;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        el = findDeep(all[i].shadowRoot, selector);
        if (el) return el;
      }
    }
    return null;
  }

  /**
   * Walk up from targetEl (crossing shadow DOM boundaries via host) until we
   * find the direct child of gridEl's layout context (light DOM child OR
   * shadow-root child — router-view uses shadow DOM for its grid children).
   */
  function findGridChild(targetEl, gridEl) {
    var gridSR = gridEl.shadowRoot;  // may be null
    var el = targetEl;
    while (el) {
      var parent = el.parentElement;
      if (!parent) {
        var root = el.getRootNode();
        if (root instanceof ShadowRoot) {
          // If this shadow root belongs to our grid element, el IS the grid child
          if (root === gridSR) return el;
          el = root.host;
          continue;
        }
        return null;
      }
      if (parent === gridEl) return el;
      el = parent;
    }
    return null;
  }

  function _injectComposerHide(composer) {
    // Always hide the element directly regardless of shadow root
    composer.style.setProperty('display', 'none', 'important');
    // Also collapse its grid placement so it takes no space
    composer.style.setProperty('grid-column', '1 / 1', 'important');
    composer.style.setProperty('grid-row',    '1 / 1', 'important');
    composer.style.setProperty('width',       '0',     'important');
    composer.style.setProperty('overflow',    'hidden', 'important');

    var sr = composer.getRootNode();
    if (sr instanceof ShadowRoot) {
      if (!sr.getElementById(EMAIL_COMPOSER_STYLE_ID)) {
        var s = document.createElement('style');
        s.id = EMAIL_COMPOSER_STYLE_ID;
        s.textContent = 'imi-email-composer { display: none !important; width: 0 !important; overflow: hidden !important; }';
        sr.appendChild(s);
      }
      _emailComposerStyleRoot = sr;
      console.log('[panel-layout] imi-email-composer hidden (shadow root + inline)');
    } else {
      _emailComposerStyleRoot = null;
      console.log('[panel-layout] imi-email-composer hidden (inline only, no shadow root)');
    }
  }

  function hideEmailComposer() {
    var composer = findDeep(document.body, 'imi-email-composer');
    if (composer) { _injectComposerHide(composer); return; }
    var retries = 0;
    var iv = setInterval(function () {
      retries++;
      composer = findDeep(document.body, 'imi-email-composer');
      if (composer) { clearInterval(iv); _injectComposerHide(composer); }
      else if (retries >= 20) { clearInterval(iv); console.warn('[panel-layout] imi-email-composer not found after retries'); }
    }, 400);
  }

  function showEmailComposer() {
    if (_emailComposerStyleRoot) {
      var s = _emailComposerStyleRoot.getElementById(EMAIL_COMPOSER_STYLE_ID);
      if (s) s.remove();
      _emailComposerStyleRoot = null;
    }
    var composer = findDeep(document.body, 'imi-email-composer');
    if (composer) {
      composer.style.removeProperty('display');
      composer.style.removeProperty('grid-column');
      composer.style.removeProperty('grid-row');
      composer.style.removeProperty('width');
      composer.style.removeProperty('overflow');
      console.log('[panel-layout] imi-email-composer show restored');
    }
  }

  // Persisted state for clean restore
  var _emailGridState = null;
  var _emailOverlay = null;

  /**
   * Dump the full grid structure of router-view for diagnostic purposes.
   * Call this from the browser console: window.__plDiag()
   * Or it runs automatically when email layout is first triggered.
   */
  function _diagDumpGrid() {
    var rv = findRouterView();
    if (!rv) { console.warn('[panel-layout][diag] router-view not found'); return; }

    var cs = window.getComputedStyle(rv);
    console.group('[panel-layout][diag] router-view computed styles');
    console.log('display:               ', cs.display);
    console.log('grid-template-columns: ', cs.gridTemplateColumns);
    console.log('grid-template-rows:    ', cs.gridTemplateRows);
    console.log('grid-auto-flow:        ', cs.gridAutoFlow);
    console.log('align-items:           ', cs.alignItems);
    console.log('height:                ', cs.height);
    console.log('BoundingRect:          ', JSON.stringify(rv.getBoundingClientRect().toJSON()));
    console.groupEnd();

    // router-view places grid children in its shadow root
    var srChildren = (rv.shadowRoot ? rv.shadowRoot.children : rv.children);
    var children = srChildren;
    console.group('[panel-layout][diag] router-view grid children (' + children.length + ') [shadow root: ' + !!rv.shadowRoot + ']');
    for (var i = 0; i < children.length; i++) {
      var ch = children[i];
      var ccs = window.getComputedStyle(ch);
      var rect = ch.getBoundingClientRect();
      console.log(
        i + ' | ' + ch.tagName +
        (ch.id ? '#' + ch.id : '') +
        (ch.className ? '.' + String(ch.className).trim().split(/\s+/).join('.') : '') +
        ' | grid-area: ' + ccs.gridArea +
        ' | grid-col: '  + ccs.gridColumn +
        ' | grid-row: '  + ccs.gridRow +
        ' | display: '   + ccs.display +
        ' | visibility: '+ ccs.visibility +
        ' | position: '  + ccs.position +
        ' | rect: x=' + Math.round(rect.x) + ' y=' + Math.round(rect.y) +
          ' w=' + Math.round(rect.width) + ' h=' + Math.round(rect.height)
      );
    }
    console.groupEnd();

    // Also log the specific elements we care about
    ['agentx-react-interaction-control-wrapper', 'uuip-dynamic-widget',
     'agentx-wc-task-list-panel-wrapper', 'imi-email-composer'].forEach(function (sel) {
      var el = findDeep(document.body, sel);
      if (!el) { console.log('[panel-layout][diag]', sel, '— NOT FOUND'); return; }
      var gc = findGridChild(el, rv);
      var elCs = window.getComputedStyle(el);
      var elRect = el.getBoundingClientRect();
      var gcRect = gc ? gc.getBoundingClientRect() : null;
      console.log('[panel-layout][diag]', sel,
        '| gridChild:', gc ? gc.tagName + (gc.id ? '#'+gc.id : '') : 'null',
        '| computed grid-col:', elCs.gridColumn, 'grid-row:', elCs.gridRow,
        '| inline grid-col:', el.style.gridColumn || '(none)', 'grid-row:', el.style.gridRow || '(none)',
        '| el rect: x=' + Math.round(elRect.x) + ' y=' + Math.round(elRect.y) +
          ' w=' + Math.round(elRect.width) + ' h=' + Math.round(elRect.height),
        gcRect ? ('| gc rect: x=' + Math.round(gcRect.x) + ' y=' + Math.round(gcRect.y) +
          ' w=' + Math.round(gcRect.width) + ' h=' + Math.round(gcRect.height)) : ''
      );
    });

    // Dump direct children of panels-scroll-container so we know what's actually a grid item
    var psc = (rv.shadowRoot || rv).querySelector('.panels-scroll-container');
    if (psc) {
      console.group('[panel-layout][diag] panels-scroll-container children (' + psc.children.length + ')');
      for (var j = 0; j < psc.children.length; j++) {
        var pc = psc.children[j];
        var pcs = window.getComputedStyle(pc);
        var pr = pc.getBoundingClientRect();
        console.log(j + ' | ' + pc.tagName +
          (pc.id ? '#'+pc.id : '') +
          (pc.className ? '.' + String(pc.className).trim().split(/\s+/).join('.') : '') +
          ' | display: ' + pcs.display +
          ' | grid-col: ' + pcs.gridColumn +
          ' | grid-row: ' + pcs.gridRow +
          ' | rect: x=' + Math.round(pr.x) + ' y=' + Math.round(pr.y) +
          ' w=' + Math.round(pr.width) + ' h=' + Math.round(pr.height)
        );
      }
      console.groupEnd();
    } else {
      console.log('[panel-layout][diag] panels-scroll-container NOT FOUND via querySelector');
    }
  }

  // Expose for manual console use
  window.__plDiag = _diagDumpGrid;

  var ENGAGE_HIDE_STYLE_ID = 'panel-layout-engage-hide';
  var _engageHideStyleRoot  = null;

  function _doApplyEngageHide(rv) {
    // Run diagnostic first so the log shows the grid state before we touch anything
    _diagDumpGrid();

    var sr = rv.shadowRoot || rv;

    // Remove any stale injection
    var existing = sr.getElementById(ENGAGE_HIDE_STYLE_ID);
    if (existing) existing.remove();

    // Inject CSS into the shadow root so we play nicely with named grid areas:
    //   1. Hide #panel-one (engage/compose panel, col3 named area)
    //   2. Stretch #common-control (call-control bar) to span col3+col4
    //   3. Stretch #panel-two   (customer360 etc.)  to span col3+col4
    // Using implicit named-area line names (common-control-start, panel-two-end)
    // means we don't hardcode numeric column indices — robust across layout changes.
    var style = document.createElement('style');
    style.id = ENGAGE_HIDE_STYLE_ID;
    style.textContent = [
      '#panel-one {',
      '  display: none !important;',
      '}',
      '#common-control {',
      '  grid-column: common-control-start / -1 !important;',
      '}',
      '#panel-two {',
      '  grid-column: common-control-start / -1 !important;',
      '  grid-row:    common-control-end   / panel-two-end !important;',
      '  margin-left: 16px !important;',
      '  padding-left: 0 !important;',
      '}'
    ].join('\n');
    sr.appendChild(style);
    _engageHideStyleRoot = sr;

    console.log('[panel-layout] engage panel hidden \u2705 (CSS injected into shadow root)');
    setTimeout(function () {
      console.log('[panel-layout][diag] POST-APPLY STATE:');
      _diagDumpGrid();
    }, 200);
  }

  function applyEmailGridLayout() {
    var retries = 0;
    function attempt() {
      var rv = findRouterView();
      console.log('[panel-layout] engage-hide attempt', retries, '| rv:', !!rv);
      if (rv) {
        _doApplyEngageHide(rv);
        emailLayoutActive = true;
        return;
      }
      retries++;
      if (retries >= 15) {
        console.warn('[panel-layout] engage-hide: router-view not found after', retries, 'retries');
        return;
      }
      setTimeout(attempt, 400);
    }
    attempt();
  }

  function clearEmailGridLayout() {
    // Remove the injected shadow-root stylesheet — all overrides revert automatically
    if (_engageHideStyleRoot) {
      var s = _engageHideStyleRoot.getElementById(ENGAGE_HIDE_STYLE_ID);
      if (s) s.remove();
      _engageHideStyleRoot = null;
    }
    _emailGridState = null;
    _observerPaused = false;
    console.log('[panel-layout] engage panel restored (shadow-root style removed)');
  }

  function applyEmailLayout() {
    if (emailLayoutActive) return;
    console.log('[panel-layout] applyEmailLayout triggered');
    hideEmailComposer();
    applyEmailGridLayout();
  }

  function clearEmailLayout() {
    if (!emailLayoutActive) return;
    emailLayoutActive = false;
    showEmailComposer();
    clearEmailGridLayout();
  }

  var _lastMediaType = null;

  function handleTaskUpdate(rawTask) {
    if (!rawTask) {
      if (_lastMediaType === null) return;
      _lastMediaType = null;
      applyTaskIndicator('');
      clearEmailLayout();
      clearWorkItemLayout();
      return;
    }

    var parsed = rawTask;
    if (typeof rawTask === 'string') {
      try { parsed = JSON.parse(rawTask); } catch (e) {
        console.warn('[panel-layout] could not parse task JSON:', e.message);
        return;
      }
    }

    var mediaType = detectMediaType(parsed);
    if (mediaType === _lastMediaType) return;
    _lastMediaType = mediaType;

    if (!mediaType) {
      console.log('[panel-layout] could not detect task mediaType — full task object:', parsed);
    } else {
      console.log('[panel-layout] task mediaType detected:', mediaType);
    }

    applyTaskIndicator(mediaType);
    if (mediaType === 'email') {
      clearWorkItemLayout();
      applyEmailLayout();
    } else if (mediaType === 'workitem') {
      clearEmailLayout();
      applyWorkItemLayout();
    } else {
      clearEmailLayout();
      clearWorkItemLayout();
    }
  }

  // ─── Auto-answer ─────────────────────────────────────────────────────────
  //
  // Accepts incoming digital interactions automatically.
  // Controlled by the `autoanswer` property on the custom element:
  //   "all"                  → accept every non-telephony channel
  //   "email,chat,workitem"  → comma-separated list of mediaType values
  //   ""  / not set          → disabled (default)
  //
  // Telephony is intentionally never auto-answered here: voice calls require
  // WebRTC session setup that the Desktop handles separately, and auto-accepting
  // them via SDK can race with media negotiation.

  var _autoAnswerChannels = [];  // empty = disabled
  var _autoAnswerInFlight = {};  // interactionId → true, guards against double-accept

  function _parseAutoAnswerProp(value) {
    if (!value || typeof value !== 'string') return [];
    var trimmed = value.trim().toLowerCase();
    if (!trimmed) return [];
    if (trimmed === 'all') return ['email', 'chat', 'workitem', 'social'];
    return trimmed.split(/[\s,;]+/).filter(Boolean);
  }

  function _initAutoAnswer() {
    if (!_autoAnswerChannels.length) return;

    // panel-layout-headless.js is a plain (non-module) script — it cannot use bare
    // npm imports. Third-party widgets that work (e.g. queue-header-widget) bundle
    // @wxcc-desktop/sdk and construct Desktop({SERVICE: AGENTX_SERVICE}).
    // window.agentx is a different, limited object that does NOT have agentContact.
    // We must read AGENTX_SERVICE.aqm.contact directly.
    var svc;
    try { svc = (typeof AGENTX_SERVICE !== 'undefined') ? AGENTX_SERVICE : null; } catch (e) { svc = null; }
    svc = svc || window.AGENTX_SERVICE || null;

    var aqmContact = svc && svc.aqm && svc.aqm.contact;

    console.log('[panel-layout] auto-answer: _initAutoAnswer() | channels:', _autoAnswerChannels,
      '| AGENTX_SERVICE:', typeof svc,
      '| isInited:', !!(svc && svc.isInited),
      '| aqm.contact:', !!aqmContact,
      '| eAgentOfferContact:', !!(aqmContact && aqmContact.eAgentOfferContact));

    if (!svc || !svc.isInited || !aqmContact) {
      console.warn('[panel-layout] auto-answer: AGENTX_SERVICE not ready, will retry in 2s');
      setTimeout(_initAutoAnswer, 2000);
      return;
    }

    if (!aqmContact.eAgentOfferContact || typeof aqmContact.eAgentOfferContact.listen !== 'function') {
      console.warn('[panel-layout] auto-answer: eAgentOfferContact.listen not found, will retry in 2s');
      setTimeout(_initAutoAnswer, 2000);
      return;
    }

    aqmContact.eAgentOfferContact.listen(function (msg) {
      try {
        var interaction = (msg && msg.data && msg.data.interaction) ? msg.data.interaction : null;
        if (!interaction) {
          console.warn('[panel-layout] auto-answer: eAgentOfferContact with no interaction data', msg);
          return;
        }

        var mediaType     = String(interaction.mediaType || interaction.channelType || '').toLowerCase();
        var interactionId = interaction.interactionId || interaction.id || null;

        console.log('[panel-layout] auto-answer: eAgentOfferContact | mediaType:', mediaType, '| interactionId:', interactionId);

        if (!interactionId) {
          console.warn('[panel-layout] auto-answer: no interactionId in offer', msg);
          return;
        }

        // Never auto-answer telephony regardless of config
        if (mediaType === 'telephony' || mediaType === 'voice') {
          console.log('[panel-layout] auto-answer: skipping telephony offer', interactionId);
          return;
        }

        if (!_autoAnswerChannels.includes(mediaType)) {
          console.log('[panel-layout] auto-answer: channel not in list (' + mediaType + '), skipping');
          return;
        }

        if (_autoAnswerInFlight[interactionId]) {
          console.log('[panel-layout] auto-answer: already accepting', interactionId);
          return;
        }

        _autoAnswerInFlight[interactionId] = true;
        console.log('[panel-layout] auto-answer: accepting', mediaType, interactionId);

        var acceptFn = aqmContact.acceptV2 || aqmContact.accept;
        if (typeof acceptFn !== 'function') {
          console.error('[panel-layout] auto-answer: neither acceptV2 nor accept found on aqm.contact');
          delete _autoAnswerInFlight[interactionId];
          return;
        }

        Promise.resolve(acceptFn.call(aqmContact, { interactionId: interactionId }))
          .then(function () {
            console.log('[panel-layout] auto-answer: ✅ accepted', interactionId);
          })
          .catch(function (err) {
            console.error('[panel-layout] auto-answer: accept failed for', interactionId, err);
          })
          .finally(function () {
            delete _autoAnswerInFlight[interactionId];
          });
      } catch (e) {
        console.error('[panel-layout] auto-answer: unexpected error in offer handler', e);
      }
    });

    // Clear in-flight guard if the offer RONA's (times out before accept)
    if (aqmContact.eAgentOfferContactRona && typeof aqmContact.eAgentOfferContactRona.listen === 'function') {
      aqmContact.eAgentOfferContactRona.listen(function (msg) {
        try {
          var interaction = (msg && msg.data && msg.data.interaction) ? msg.data.interaction : null;
          var id = interaction && (interaction.interactionId || interaction.id);
          if (id) {
            delete _autoAnswerInFlight[id];
            console.log('[panel-layout] auto-answer: RONA for', id, '— cleared in-flight guard');
          }
        } catch (e) { /* ignore */ }
      });
    }

    console.log('[panel-layout] auto-answer: ✅ listeners registered | channels:', _autoAnswerChannels);
  }

  // ─── CRM sync: interaction selection ─────────────────────────────────────
  //
  // When the CRM Tab Manager selects a customer tab, the sync relay sends a
  // CRM_TAB_SELECTED message to the webexcc widget, which re-broadcasts it on
  // BroadcastChannel('crm-sync') as SELECT_INTERACTION.  The headless widget
  // picks it up here and tries to focus the corresponding interaction in the
  // Desktop task list.

  /**
   * Recursively search inside root for any element whose attribute set
   * contains the given interactionId string (exact or substring match).
   * Descends into shadow roots.
   */
  function findInteractionItem(root, interactionId) {
    function search(r) {
      var els = r.querySelectorAll('*');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var attrs = el.attributes;
        for (var j = 0; j < attrs.length; j++) {
          if (attrs[j].value && attrs[j].value.indexOf(interactionId) !== -1) {
            return el;
          }
        }
        if (el.shadowRoot) {
          var found = search(el.shadowRoot);
          if (found) return found;
        }
      }
      return null;
    }
    return search(root);
  }

  // Find the Vue 3 app instance by recursively searching the DOM including
  // shadow roots. Desktop mounts its Vue app inside a web component's shadow
  // root, so a shallow scan of document.body.children is not enough.
  function _findVueApp() {
    var _visited = [];
    function search(node, depth) {
      if (!node || depth > 12) return null;
      if (_visited.indexOf(node) >= 0) return null;
      _visited.push(node);
      try {
        if (node.__vue_app__) return node.__vue_app__;
        var children = node.children ? Array.prototype.slice.call(node.children) : [];
        for (var i = 0; i < children.length; i++) {
          var el = children[i];
          if (el.__vue_app__) return el.__vue_app__;
          // Descend into shadow root first (Desktop app is typically mounted there)
          if (el.shadowRoot) {
            var shadowKids = Array.prototype.slice.call(el.shadowRoot.children || []);
            for (var k = 0; k < shadowKids.length; k++) {
              if (shadowKids[k].__vue_app__) return shadowKids[k].__vue_app__;
            }
            var r = search(el.shadowRoot, depth + 1);
            if (r) return r;
          }
          var r2 = search(el, depth + 1);
          if (r2) return r2;
        }
      } catch (e) {}
      return null;
    }
    return search(document.documentElement, 0);
  }

  // Run once on load: log what navigation hooks are available so we know which
  // tier will fire when selectInteractionInDesktop is called.
  (function _diagOnLoad() {
    try {
      var vueApp = _findVueApp();
      var gp = vueApp ? (vueApp.config && vueApp.config.globalProperties) || {} : null;
      console.log('[panel-layout] diag | Vue app:', !!vueApp,
        '| $router:', !!(gp && gp.$router),
        '| $store:', !!(gp && gp.$store),
        '| window.page:', typeof window.page,
        '| page.js ctx:', typeof window.__page);
      if (gp && gp.$store) {
        var actions = Object.keys(gp.$store._actions || {});
        var relevant = actions.filter(function(k) {
          return /select|task|interact|routing|nav/i.test(k);
        });
        console.log('[panel-layout] diag | Vuex relevant actions:', relevant.length ? relevant : '(none)');
      }
    } catch (e) {
      console.warn('[panel-layout] diag error:', e.message);
    }
  })();

  function selectInteractionInDesktop(interactionId) {
    if (!interactionId) return;
    var targetPath = '/task/' + interactionId;
    console.log('[panel-layout] selectInteractionInDesktop:', interactionId);

    // ── Tier 1: AGENTX_SERVICE direct methods (confirmed absent; kept for future) ──
    var svc = null;
    try { svc = (typeof AGENTX_SERVICE !== 'undefined') ? AGENTX_SERVICE : null; } catch (e) {}
    svc = svc || window.AGENTX_SERVICE || null;
    if (svc) {
      var contact = svc.aqm && svc.aqm.contact;
      if (contact) {
        var selMethods = ['selectTask', 'setActiveTask', 'focusTask', 'setSelectedTask'];
        for (var mi = 0; mi < selMethods.length; mi++) {
          if (typeof contact[selMethods[mi]] === 'function') {
            try {
              contact[selMethods[mi]]({ interactionId: interactionId });
              console.log('[panel-layout] selected via aqm.contact.' + selMethods[mi]);
              return;
            } catch (e) {}
          }
        }
      }
      if (svc.actions && typeof svc.actions.selectInteraction === 'function') {
        try {
          svc.actions.selectInteraction(interactionId);
          console.log('[panel-layout] selected via AGENTX_SERVICE.actions.selectInteraction');
          return;
        } catch (e) {}
      }
    }

    // ── Tier 2: Vue Router push ──
    // Desktop is a Vue 3 SPA. router.push() triggers the full navigation pipeline
    // (route guards → component update → store hooks) unlike bare pushState which
    // only signals page.js and updates the URL/task-list highlight.
    var vueApp = _findVueApp();
    if (vueApp) {
      var gp = (vueApp.config && vueApp.config.globalProperties) || {};
      console.log('[panel-layout] Vue app found; globalProperties keys:', Object.keys(gp).join(', '));

      var router = gp.$router || null;
      if (router && typeof router.push === 'function') {
        try {
          var nav = router.push(targetPath);
          console.log('[panel-layout] Vue Router push → ', targetPath);
          if (nav && typeof nav.catch === 'function') {
            nav.catch(function (err) {
              // NavigationDuplicated is benign — already on the route
              if (err && err.name !== 'NavigationDuplicated') {
                console.warn('[panel-layout] Vue Router push error:', err.message);
              }
            });
          }
          return;
        } catch (e) {
          console.warn('[panel-layout] Vue Router push threw:', e.message);
        }
      } else {
        console.log('[panel-layout] $router not on globalProperties');
      }

      // ── Tier 3: Vuex / Pinia store dispatch ──
      var store = gp.$store || null;
      if (store && typeof store.dispatch === 'function') {
        console.log('[panel-layout] Vuex store found; trying dispatch candidates');
        var candidates = [
          ['agentContact/selectInteraction', { interactionId: interactionId }],
          ['agentContact/setSelectedTask',   { interactionId: interactionId }],
          ['routing/navigate',               targetPath],
          ['interaction/setActive',          interactionId],
          ['task/select',                    interactionId],
        ];
        for (var ci = 0; ci < candidates.length; ci++) {
          try {
            store.dispatch(candidates[ci][0], candidates[ci][1]);
            console.log('[panel-layout] Vuex dispatch succeeded:', candidates[ci][0]);
            return;
          } catch (e) { /* try next */ }
        }
        console.log('[panel-layout] all Vuex dispatch candidates failed');
      }
    } else {
      console.log('[panel-layout] Vue app not found on DOM');
    }

    // ── Tier 4: page.js direct call (window.page) ──
    if (typeof window.page === 'function') {
      try {
        window.page(targetPath);
        console.log('[panel-layout] page.js direct call → ', targetPath);
        return;
      } catch (e) {
        console.warn('[panel-layout] window.page() threw:', e.message);
      }
    } else {
      console.log('[panel-layout] window.page not available (type:', typeof window.page, ')');
    }

    // ── Early exit: already on the target URL ──
    // If the URL already matches, the Desktop is already showing this task.
    // Re-firing anything here only creates races, so stop.
    if (window.location.pathname === targetPath) {
      console.log('[panel-layout] already on', targetPath, '— no switch needed');
      return;
    }

    // ── Primary (and only reliable) mechanism: a REAL click on the task-list item ──
    //
    // ROOT CAUSE of the prior echo loop: synthetic CustomEvents update the
    // interaction *panels* but NOT the Desktop's internal selected-task store,
    // and history.pushState updates ONLY the URL. Either path leaves the Desktop
    // in a split-brain state (URL ≠ internal selection); the Desktop then
    // re-emits `selectedtaskid` to reconcile, which bounces back through the
    // relay → Tab Manager → proxy focus → CRM_TAB_SELECTED → here again, forever.
    //
    // A genuine element.click() on the real task-list item is the ONLY action
    // that commits the internal store (it runs the Desktop's own click handler,
    // which fires taskitem-click → task-selected → ax-selected-interaction-changed
    // AND updates MobX). After it commits, the resulting selectedtaskid equals
    // our target and is suppressed by the sync echo-guard, so the loop ends.
    //
    // Scope the search to DIV.agentx-task-area (the left task panel). The JDS
    // journey timeline (ax-activity-list-item entries that also embed the id)
    // lives under uuip-dynamic-widget in panel-two, OUTSIDE the task area, so
    // scoping here avoids clicking the wrong element and reverting the task.
    function _findTaskAreaItem() {
      var taskArea = findDeep(document.body, '.agentx-task-area');
      if (!taskArea) {
        // Fall back to the list wrapper if the task-area class isn't found
        taskArea = findDeep(document.body, 'agentx-wc-task-list-panel-wrapper');
      }
      if (!taskArea) {
        console.warn('[panel-layout] agentx-task-area not found');
        return null;
      }
      return findInteractionItem(taskArea.shadowRoot || taskArea, interactionId);
    }

    function _realClick(item) {
      console.log('[panel-layout] real click on', item.tagName,
        (item.className || '').toString().trim().slice(0, 50));
      item.click();
      item.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, composed: true,
      }));
    }

    var item = _findTaskAreaItem();
    if (item) {
      _realClick(item);
      return;
    }

    // The task list can be mid-transition (collapsed/re-rendering) when the
    // message arrives — retry shortly before giving up.
    console.warn('[panel-layout] task item not found — retrying in 250ms for', interactionId);
    setTimeout(function () {
      if (window.location.pathname === targetPath) return; // already switched
      var retryItem = _findTaskAreaItem();
      if (retryItem) {
        _realClick(retryItem);
        return;
      }
      // Diagnostic: enumerate what IS in the task area so we can see the structure.
      var ta = findDeep(document.body, '.agentx-task-area');
      var scope = ta ? (ta.shadowRoot || ta) : null;
      var items = scope ? scope.querySelectorAll('md-list-item, [role="listitem"], .md-list-item') : [];
      console.error('[panel-layout] task item STILL not found for', interactionId,
        '| task-area present:', !!ta, '| candidate list items:', items.length);
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        console.log('[panel-layout][diag] item', i, it.tagName,
          (it.className || '').toString().trim().slice(0, 40),
          '| id-attrs:', Array.prototype.map.call(it.attributes, function (a) { return a.name + '=' + a.value; }).join(',').slice(0, 120));
      }
      console.warn('[panel-layout] NOT firing synthetic events / pushState — they cause split-brain. Switch skipped.');
    }, 250);
  }

  // Listen for SELECT_INTERACTION broadcasts from the sync slice.
  // Debounce: if multiple messages arrive within 400ms, only the LAST one wins.
  // Lock: after a switch fires, ignore any reverse-switch for 3s (prevents the
  // echo where the newly-deselected task's proxy fires TAB_FOCUSED, which Tab
  // Manager forwards back as CRM_TAB_SELECTED for the old task).
  (function () {
    try {
      var _pendingTimer = null;
      var _lastSwitchedTo = null;
      var _prevTask = null;        // the task we just left on the last switch
      var _lastSwitchedAt = 0;
      var REVERSE_ECHO_MS = 1000; // guard only against the specific reverse-echo
      var DEBOUNCE_MS     = 200;  // wait for burst to settle before acting

      var ch = new BroadcastChannel('crm-sync');
      ch.onmessage = function (event) {
        if (!event.data || event.data.type !== 'SELECT_INTERACTION') return;
        var iid = event.data.interactionId;
        if (!iid) return;

        // Guard only against the specific reverse-echo: the proxy for the task we
        // just LEFT may fire TAB_FOCUSED → CRM_TAB_SELECTED back for that exact id.
        // The Tab Manager's expectFocusEcho already handles this, but we keep a
        // narrow 1s safety net here for that ONE task only.
        // Any switch to a DIFFERENT task is always a genuine user action — never block it.
        if (_prevTask && iid === _prevTask) {
          var age = Date.now() - _lastSwitchedAt;
          if (age < REVERSE_ECHO_MS) {
            console.log('[panel-layout] SELECT_INTERACTION suppressed (reverse-echo guard, age=' + age + 'ms):', iid);
            return;
          }
        }

        // Debounce: if another message for a different task arrives very quickly,
        // cancel the pending switch and schedule for the latest message instead.
        if (_pendingTimer !== null) {
          clearTimeout(_pendingTimer);
          _pendingTimer = null;
        }

        _pendingTimer = setTimeout(function () {
          _pendingTimer = null;
          _prevTask = _lastSwitchedTo;  // save the task we are about to leave
          _lastSwitchedTo = iid;
          _lastSwitchedAt = Date.now();
          selectInteractionInDesktop(iid);
        }, DEBOUNCE_MS);
      };
      console.log('[panel-layout] CRM sync BroadcastChannel listener ready');
    } catch (e) {
      console.warn('[panel-layout] BroadcastChannel not available:', e.message);
    }
  })();

  if (!customElements.get('panel-layout-headless')) {
    customElements.define('panel-layout-headless', class extends HTMLElement {
      static get observedAttributes() {
        return ['darkmode'];
      }

      constructor() {
        super();
        this._task        = null;
        this._orgid       = null;
        this._datacenter  = null;
        this._signalColor = null;
        this._autoanswer  = null;
      }

      attributeChangedCallback(name, oldVal, newVal) {
        if (name === 'darkmode') {
          _darkMode = (newVal === 'true' || newVal === true);
          console.log('[panel-layout] darkmode:', _darkMode);
          // Re-apply indicator with updated palette if a task is active
          if (this._task) applyTaskIndicator(_lastMediaType);
        }
      }

      set task(value) {
        if (this._task === value) return;
        this._task = value;
        handleTaskUpdate(value);
      }
      get task() { return this._task; }

      set darkmode(value) {
        _darkMode = (value === 'true' || value === true);
        console.log('[panel-layout] darkmode:', _darkMode);
        if (_lastMediaType) applyTaskIndicator(_lastMediaType);
      }
      get darkmode() { return _darkMode; }

      set signalColor(value) {
        _signalColor = value && String(value).trim() ? String(value).trim() : null;
        console.log('[panel-layout] signalColor:', _signalColor);
        if (this._task) applyTaskIndicator(_lastMediaType);
      }
      get signalColor() { return _signalColor; }

      set orgid(value) {
        this._orgid = value;
        console.log('[panel-layout] orgid set:', value);
      }
      get orgid() { return this._orgid; }

      set datacenter(value) {
        this._datacenter = value;
        console.log('[panel-layout] datacenter set:', value);
      }
      get datacenter() { return this._datacenter; }

      set autoanswer(value) {
        this._autoanswer = value;
        var prev = _autoAnswerChannels.slice();
        _autoAnswerChannels = _parseAutoAnswerProp(value);
        console.log('[panel-layout] autoanswer set:', value, '→ channels:', _autoAnswerChannels);
        // Start listening only on first non-empty assignment
        if (_autoAnswerChannels.length && !prev.length) {
          _initAutoAnswer();
        }
      }
      get autoanswer() { return this._autoanswer; }
    });
  }


})();


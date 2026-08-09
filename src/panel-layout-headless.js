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

  // Force future shadow roots OPEN so shadow-DOM traversal can reach nested
  // internals. The wrap-up AI-summary card (agentx-wc-interaction-summary-card /
  // uuip-adaptive-card) attaches a CLOSED shadow root that otherwise hides its
  // section textareas. Installed at widget load, before that card is created.
  try {
    var _origAttachShadow = Element.prototype.attachShadow;
    if (_origAttachShadow && !_origAttachShadow.__plForcedOpen) {
      var _patchedAttachShadow = function (init) {
        var opts = init || {};
        if (opts.mode === 'closed') opts = Object.assign({}, opts, { mode: 'open' });
        return _origAttachShadow.call(this, opts);
      };
      _patchedAttachShadow.__plForcedOpen = true;
      Element.prototype.attachShadow = _patchedAttachShadow;
      console.log('[panel-layout] attachShadow patched → future shadow roots forced open');
    }
  } catch (e) { /* ignore */ }

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
   * Emit an activity analytics event via the shared emitter (window.__wxActivity,
   * from activity-emitter.js). No-op when the emitter is not loaded. This widget
   * owns the EARLY lifecycle signals (offered / rona / declined) that the
   * task-property stream in crm-sync-header.js cannot observe.
   */
  function _emitActivity(eventType, data) {
    if (window.__wxActivity) window.__wxActivity.emit(eventType, data);
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

  // ─── Offer info panel ─────────────────────────────────────────────────────
  //
  // When an incoming task is offered to the agent (eAgentOfferContact / AgentOffered state),
  // display a floating overlay panel showing configurable CAD variable values.
  // Configuration priority:
  //   1. `offerVariables` property on the custom element (JSON array or comma-separated names)
  //   2. FC-DESKTOP-VIEW CAD variable pop-over config (platform-level fallback)
  //   3. Neither present → panel is silently skipped

  var _offerVariables               = null;  // [{name, label}] or null (auto-detect)
  var _offerPanelMap                = {};    // { [interactionId]: HTMLElement }
  var _offerPanelListenersRegistered = false;
  var _offerPanelKeyframesInjected  = false;

  /**
   * Parse the `offerVariables` property value.
   * Accepts comma-separated variable names: 'agentInfo,CustomerName,Topic'
   * Returns [{name, label}] or null.
   */
  function _parseOfferVariablesProp(value) {
    if (!value || typeof value !== 'string') return null;
    var names = value.trim().split(/[\s,;]+/).filter(Boolean);
    if (!names.length) return null;
    return names.map(function (n) { return { name: n, label: n }; });
  }

  /**
   * Unwrap a CAD field from telephony ({value: "..."}) or digital (plain string) shape.
   */
  function _cadValue(field) {
    if (field === null || field === undefined) return '';
    if (typeof field === 'object' && 'value' in field) return String(field.value);
    return String(field);
  }

  /**
   * Parse FC-DESKTOP-VIEW CAD variable into an offer variable list.
   * Returns [{name, label}] or null.
   */
  function _getOfferVarsFromFcDesktopView(cad) {
    if (!cad) return null;
    var raw = cad['FC-DESKTOP-VIEW'];
    if (!raw) return null;
    var jsonStr = _cadValue(raw);
    if (!jsonStr) return null;
    try {
      var config = JSON.parse(jsonStr);
      var popOver = config && Array.isArray(config['pop-over']) ? config['pop-over'] : null;
      if (!popOver || !popOver.length) return null;
      return popOver
        .slice()
        .sort(function (a, b) { return (+(a.variableSeq || 0)) - (+(b.variableSeq || 0)); })
        .map(function (v) { return { name: String(v.name || ''), label: String(v.name || '') }; })
        .filter(function (v) { return v.name; });
    } catch (e) {
      return null;
    }
  }

  /** Escape HTML to prevent XSS when inserting CAD values into innerHTML. */
  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Inject slide-in keyframe animation into document.head (once per page). */
  function _ensureOfferPanelKeyframes() {
    if (_offerPanelKeyframesInjected) return;
    _offerPanelKeyframesInjected = true;
    var style = document.createElement('style');
    style.id = 'offer-panel-keyframes';
    style.textContent = [
      '@keyframes offerPanelSlideIn {',
      '  from { opacity: 0; transform: translateX(30px); }',
      '  to   { opacity: 1; transform: translateX(0); }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /**
   * Show the offer info panel for the given interaction.
   * Silent no-op if no variables are configured or all configured variables are empty.
   */
  function showOfferPanel(interactionId, interaction) {
    if (!interactionId) return;
    var cad = (interaction && interaction.callAssociatedData) || {};

    var vars = _offerVariables || _getOfferVarsFromFcDesktopView(cad);
    if (!vars || !vars.length) {
      console.log('[panel-layout] offer-panel: no variables configured — skipping for', interactionId);
      return;
    }
    if (_offerPanelMap[interactionId]) return; // already shown

    _ensureOfferPanelKeyframes();

    var isDark     = _darkMode;
    var panelCount = Object.keys(_offerPanelMap).length;

    // Use Momentum CSS variables (--mds-color-theme-*) which are scoped by the
    // md-theme--dark / md-theme--light class applied to the panel element itself.
    // Fallback values match Momentum's light/dark palettes for environments where
    // the variables may not cascade (e.g. isolated shadow DOM contexts).
    var cssVars = [
      '--offer-bg:var(--mds-color-theme-background-primary-normal,' + (isDark ? '#1b1b1b' : '#ffffff') + ')',
      '--offer-bg2:var(--mds-color-theme-background-secondary-normal,' + (isDark ? '#2a2a2a' : '#f7f7f7') + ')',
      '--offer-text:var(--mds-color-theme-text-primary-normal,' + (isDark ? '#f0f0f0' : '#121212') + ')',
      '--offer-text2:var(--mds-color-theme-text-secondary-normal,' + (isDark ? '#9e9e9e' : '#6e7780') + ')',
      '--offer-accent:var(--mds-color-theme-background-accent-normal,' + (isDark ? '#64aaff' : '#0070d2') + ')',
      '--offer-divider:var(--mds-color-theme-control-inactive-normal,' + (isDark ? '#3a3a3a' : '#e8e8e8') + ')',
      '--offer-shadow:' + (isDark ? '0 4px 24px rgba(0,0,0,0.55)' : '0 4px 24px rgba(0,0,0,0.14)')
    ].join(';');

    // Caller identity for header
    var callerName = _cadValue(cad.CustomerName) || _cadValue(cad.ani) || _cadValue(cad.CallerId) || interactionId.slice(0, 8);
    var mediaType  = String((interaction && (interaction.mediaType || interaction.channelType)) || '').toLowerCase() || 'task';
    var mediaLabel = mediaType.charAt(0).toUpperCase() + mediaType.slice(1);

    // Build variable rows — no truncation, content drives height
    var rowsHtml = '';
    var rowCount  = 0;
    for (var i = 0; i < vars.length; i++) {
      var v        = vars[i];
      var rawField = cad[v.name];
      if (rawField === undefined || rawField === null) continue;
      var val = _cadValue(rawField).trim();
      if (!val) continue;
      var isLast = (i === vars.length - 1);
      rowsHtml += [
        '<div style="padding:12px 16px;' + (!isLast ? 'border-bottom:1px solid var(--offer-divider);' : '') + '">',
        '  <div style="font-size:11px;font-weight:600;color:var(--offer-text2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">' + _escHtml(v.label) + '</div>',
        '  <div style="font-size:14px;line-height:1.5;color:var(--offer-text);background:var(--offer-bg2);border-radius:6px;padding:8px 12px;white-space:pre-wrap;word-break:break-word;">' + _escHtml(val) + '</div>',
        '</div>'
      ].join('');
      rowCount++;
    }

    if (!rowCount) {
      console.log('[panel-layout] offer-panel: all configured variables are empty — skipping for', interactionId);
      return;
    }

    var panel = document.createElement('div');
    panel.id = 'offer-panel-' + interactionId;
    // Apply Momentum theme class so --mds-color-theme-* variables resolve correctly
    panel.className = isDark ? 'md-theme--dark' : 'md-theme--light';
    panel.setAttribute('data-offer-panel', '1');
    panel.style.cssText = [
      cssVars,
      'position:fixed',
      'top:' + (12 + panelCount * 16) + 'px',
      'right:12px',
      'width:min(480px,calc(100vw - 80px))',
      'max-height:min(90vh,600px)',
      'display:flex',
      'flex-direction:column',
      'background:var(--offer-bg)',
      'border-radius:8px',
      'border-left:4px solid var(--offer-accent)',
      'box-shadow:var(--offer-shadow)',
      'z-index:99999',
      'overflow:hidden',
      'font-family:inherit',
      'animation:offerPanelSlideIn 0.22s ease-out'
    ].join(';');

    panel.innerHTML = [
      // ── Header ──────────────────────────────────────────────────────────
      '<div style="flex-shrink:0;background:var(--offer-bg2);padding:10px 16px;',
      'display:flex;align-items:flex-start;justify-content:space-between;gap:10px;',
      'border-bottom:1px solid var(--offer-divider);">',
      '  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0;">',
      '    <span style="flex-shrink:0;background:var(--offer-accent);color:#fff;font-size:10px;font-weight:700;',
      '      padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.05em;">',
      _escHtml(mediaLabel),
      '    </span>',
      '    <span style="font-size:14px;font-weight:600;color:var(--offer-text);word-break:break-word;">',
      _escHtml(callerName),
      '    </span>',
      '  </div>',
      '  <button id="offer-panel-close-' + interactionId + '" aria-label="Close"',
      '    style="flex-shrink:0;background:none;border:none;cursor:pointer;',
      '    padding:0 4px;font-size:18px;line-height:1;color:var(--offer-text2);',
      '    margin-top:1px;" title="Close">&#x2715;</button>',
      '</div>',
      // ── Body (scrollable) ────────────────────────────────────────────────
      '<div style="overflow-y:auto;flex:1 1 auto;">',
      rowsHtml,
      '</div>'
    ].join('');

    document.body.appendChild(panel);
    _offerPanelMap[interactionId] = panel;

    var closeBtn = document.getElementById('offer-panel-close-' + interactionId);
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { hideOfferPanel(interactionId); });
    }

    console.log('[panel-layout] offer-panel: \u2705 shown for', interactionId, '| vars:', vars.map(function (v) { return v.name; }).join(','));
  }

  /** Remove the offer info panel for the given interaction. */
  function hideOfferPanel(interactionId) {
    if (!interactionId) return;
    var panel = _offerPanelMap[interactionId];
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    delete _offerPanelMap[interactionId];
    // Clean up keyframe style when no panels remain
    if (!Object.keys(_offerPanelMap).length) {
      var kf = document.getElementById('offer-panel-keyframes');
      if (kf && kf.parentNode) kf.parentNode.removeChild(kf);
      _offerPanelKeyframesInjected = false;
    }
    console.log('[panel-layout] offer-panel: hidden for', interactionId);
  }

  /**
   * Register SDK listeners for the offer panel lifecycle.
   * Mirrors the _initAutoAnswer() retry pattern.
   * Called unconditionally at startup — showOfferPanel() is a no-op when nothing is configured.
   */
  function _initOfferPanel() {
    if (_offerPanelListenersRegistered) return;

    var svc;
    try { svc = (typeof AGENTX_SERVICE !== 'undefined') ? AGENTX_SERVICE : null; } catch (e) { svc = null; }
    svc = svc || window.AGENTX_SERVICE || null;
    var aqmContact = svc && svc.aqm && svc.aqm.contact;

    if (!svc || !svc.isInited || !aqmContact) {
      setTimeout(_initOfferPanel, 2000);
      return;
    }

    if (!aqmContact.eAgentOfferContact || typeof aqmContact.eAgentOfferContact.listen !== 'function') {
      setTimeout(_initOfferPanel, 2000);
      return;
    }

    // Show panel on offer
    aqmContact.eAgentOfferContact.listen(function (msg) {
      try {
        var interaction = msg && msg.data && msg.data.interaction;
        if (!interaction) return;
        var id = interaction.interactionId || interaction.id;
        if (id) {
          showOfferPanel(id, interaction);
          _emitActivity('task_offered', { interactionId: id, channel: detectMediaType(interaction) });
        }
      } catch (e) {
        console.error('[panel-layout] offer-panel: error in eAgentOfferContact handler', e);
      }
    });

    // Hide on RONA (agent did not answer in time)
    if (aqmContact.eAgentOfferContactRona && typeof aqmContact.eAgentOfferContactRona.listen === 'function') {
      aqmContact.eAgentOfferContactRona.listen(function (msg) {
        try {
          var interaction = msg && msg.data && msg.data.interaction;
          var id = interaction && (interaction.interactionId || interaction.id);
          if (id) {
            hideOfferPanel(id);
            _emitActivity('rona', { interactionId: id, channel: interaction ? detectMediaType(interaction) : null });
          }
        } catch (e) {}
      });
    }

    // Hide on declined / assign failed (USER_DECLINED)
    if (aqmContact.eAgentContactAssignFailed && typeof aqmContact.eAgentContactAssignFailed.listen === 'function') {
      aqmContact.eAgentContactAssignFailed.listen(function (msg) {
        try {
          var interaction = msg && msg.data && msg.data.interaction;
          var id = (msg && msg.data && msg.data.interactionId)
            || (interaction && (interaction.interactionId || interaction.id));
          if (id) {
            hideOfferPanel(id);
            _emitActivity('declined', { interactionId: id, channel: interaction ? detectMediaType(interaction) : null });
          }
        } catch (e) {}
      });
    }

    // Hide on accepted (eAgentContactAssigned)
    if (aqmContact.eAgentContactAssigned && typeof aqmContact.eAgentContactAssigned.listen === 'function') {
      aqmContact.eAgentContactAssigned.listen(function (msg) {
        try {
          var id = (msg && msg.data && msg.data.interactionId)
            || (msg && msg.data && msg.data.interaction && (msg.data.interaction.interactionId || msg.data.interaction.id));
          if (id) hideOfferPanel(id);
        } catch (e) {}
      });
    }

    // Safety fallback: hide on ended
    if (aqmContact.eAgentContactEnded && typeof aqmContact.eAgentContactEnded.listen === 'function') {
      aqmContact.eAgentContactEnded.listen(function (msg) {
        try {
          var id = msg && msg.data && msg.data.interactionId;
          if (id) hideOfferPanel(id);
        } catch (e) {}
      });
    }

    _offerPanelListenersRegistered = true;
    console.log('[panel-layout] offer-panel: \u2705 listeners registered');
  }

  _initOfferPanel();

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
    // The Desktop is already showing this task; a real click would only create
    // races. CRM-tab synchronisation is driven independently by crm-sync-header
    // (Desktop selection change → INTERACTION_SELECTED → Tab Manager), so there
    // is nothing to do here.
    if (window.location.pathname === targetPath) {
      console.log('[panel-layout] already on', targetPath, '— no click needed');
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

  // Listen for SELECT_INTERACTION broadcasts from crm-sync-header.
  //
  // crm-sync-header only broadcasts SELECT_INTERACTION when the agent focuses a
  // CRM tab for an interaction that is NOT already the Desktop's selected task,
  // so every message here is a genuine switch request. The feedback loop is
  // broken upstream (the Tab Manager suppresses the TAB_FOCUSED echoes of its
  // own programmatic focus, and crm-sync-header only emits INTERACTION_SELECTED
  // on a real Desktop selection change), so NO reverse-echo guard is needed here
  // — adding one would wrongly swallow rapid legitimate A→B→A switches.
  //
  // A short debounce coalesces the burst the relay flush produces on connect so
  // we only perform the final click.
  (function () {
    try {
      var _pendingTimer = null;
      var DEBOUNCE_MS = 200;

      var ch = new BroadcastChannel('crm-sync');
      ch.onmessage = function (event) {
        if (!event.data || event.data.type !== 'SELECT_INTERACTION') return;
        var iid = event.data.interactionId;
        if (!iid) return;

        // Debounce: if another message arrives very quickly, cancel the pending
        // switch and schedule for the latest message instead.
        if (_pendingTimer !== null) {
          clearTimeout(_pendingTimer);
          _pendingTimer = null;
        }

        _pendingTimer = setTimeout(function () {
          _pendingTimer = null;
          selectInteractionInDesktop(iid);
        }, DEBOUNCE_MS);
      };
      console.log('[panel-layout] CRM sync BroadcastChannel listener ready');
    } catch (e) {
      console.warn('[panel-layout] BroadcastChannel not available:', e.message);
    }
  })();

  // ─── Wrap-up → CRM field transfer ─────────────────────────────────────────
  //
  // When the active interaction enters wrap-up (detected via the SDK), and a CRM
  // window is open (the crm-tab-manager, reported by the browser extension), glow
  // the Desktop's native wrap-up notes field and float a small toolbar over it:
  //
  //   • Settings → pick the CRM target field (extension frames candidates) and
  //     choose Automatic / Manual mode. The choice is remembered per browser.
  //   • Transfer → append the wrap-up text into the remembered CRM field. Enabled
  //     only when a target is configured AND Manual mode is selected.
  //
  // In Automatic mode the text is transferred on wrap-up submission instead.
  //
  // The extension bridges the actual CRM DOM writes (the CRM is a cross-origin
  // iframe only its content script can touch); this widget owns the SDK detection
  // and the Desktop-side UI, talking to the extension over window.postMessage.

  var _wrapCfg              = { crmOpen: false, targetConfigured: false, mode: 'manual' };
  var _wrapField           = null;   // the native wrap-up notes element
  var _wrapFieldSelector   = null;   // optional override via `wrapupfieldselector`
  var _wrapInteractionId   = null;
  var _wrapLastText        = '';
  var _wrapToolbar         = null;
  var _wrapReposTimer      = null;
  var _wrapPending         = {};     // reqId → { resolve, timer }
  var _wrapReqSeq          = 0;
  var _wrapBridgeReady     = false;
  var _wrapBcCrmOpen       = false;  // CRM presence learned from crm-sync BroadcastChannel
  var _wrapBc              = null;
  var _wrapTick            = 0;
  var _wrapExtWarned       = false;  // throttle the "no extension reply" warning
  var _wrapStatusStr       = '';     // throttle status logging
  var _wrapHighlightOn     = false;  // CRM target glow state (kept in sync w/ source glow)

  // Keep the CRM target glow in lock-step with the Desktop source glow so both
  // frames light up / go dark at exactly the same moments (only during wrap-up).
  function _wrapSetHighlight(on) {
    on = !!on;
    if (on === _wrapHighlightOn) return;
    _wrapHighlightOn = on;
    _wrapPost({ type: on ? 'HIGHLIGHT' : 'UNHIGHLIGHT' });
  }

  // Clicks on our floating toolbar/popover must NOT dismiss the native wrap-up
  // dialog. The dialog closes via an outside-pointer detector; we register a
  // window-capture guard (fires before any document-level listener) that stops
  // pointer/mouse-down events targeting our UI from ever reaching that detector.
  // Buttons still work because the synthetic `click` is generated independently.
  var _WRAP_GUARD_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup'];
  function _wrapSwallowGuard(e) {
    try {
      if (!_wrapToolbar) return;
      var path = e.composedPath ? e.composedPath() : [];
      var pop = _wrapToolbar._pop || null;
      var editable = false;
      for (var i = 0; i < path.length; i++) {
        var n = path[i];
        if (n && n.nodeType === 1) {
          var tag = n.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable) editable = true;
        }
        if (n === _wrapToolbar || (pop && n === pop)) {
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          // Keep focus on the wrap-up field for plain controls, but let the
          // editable content-override fields receive focus/caret normally.
          if (e.type === 'mousedown' && !editable) e.preventDefault();
          return;
        }
      }
    } catch (err) { /* ignore */ }
  }

  var _WRAP_ICON_GEAR = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94a7.6 7.6 0 000-1.88l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7 7 0 00-1.62-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.58.24-1.12.56-1.62.94l-2.39-.96a.5.5 0 00-.6.22L2.71 8.84a.5.5 0 00.12.64l2.03 1.58a7.6 7.6 0 000 1.88l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.14.24.42.32.66.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.24 1.12-.56 1.62-.94l2.39.96c.24.1.52.02.66-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z"/></svg>';
  var _WRAP_ICON_ARROW = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 8h11l-3.5-3.5L10 3l6 5-6 5-1.5-1.5L12 9H1z"/></svg>';
  var _WRAP_ICON_COLLAPSE = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 3 4 8 9 13"/><polyline points="13 3 8 8 13 13"/></svg>';
  var _WRAP_ICON_EXPAND = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="7 3 12 8 7 13"/><polyline points="3 3 8 8 3 13"/></svg>';
  var _WRAP_GLOW_COLORS = ['#0e7fc1', '#1a6b35', '#7c35b5', '#c46c00', '#b0362c', '#2dadce'];
  var _wrapGlowColor = '#0e7fc1';

  // ── locale-aware strings (this file is copied raw, not bundled) ──────────
  var _wrapLocaleCache = null;
  var _WRAP_I18N = {
    en: {
      settings: 'Settings', transfer: 'Transfer', targetField: 'Target field',
      pickTarget: 'Pick target field', transferMode: 'Transfer mode',
      manual: 'Manual', automatic: 'Automatic', glowColor: 'Glow color',
      content: 'Content to transfer', noFields: 'No editable summary fields detected.',
      reset: 'Reset', field: 'Field', collapse: 'Collapse', expand: 'Expand', titleHint: '(no title)',
      hint: 'Manual: press Transfer. Automatic: copies on submit.',
      tipNoCrm: 'CRM window not detected — open the CRM Tab Manager',
      tipNoTarget: 'Select a target field in Settings first',
      tipAuto: 'Transfer happens automatically on submit',
      tipTransfer: 'Copy wrap-up notes to the CRM field',
    },
    de: {
      settings: 'Einstellungen', transfer: 'Übertragen', targetField: 'Zielfeld',
      pickTarget: 'Zielfeld auswählen', transferMode: 'Übertragungsmodus',
      manual: 'Manuell', automatic: 'Automatisch', glowColor: 'Leuchtfarbe',
      content: 'Zu übertragender Inhalt', noFields: 'Keine bearbeitbaren Zusammenfassungsfelder erkannt.',
      reset: 'Zurücksetzen', field: 'Feld', collapse: 'Einklappen', expand: 'Ausklappen', titleHint: '(kein Titel)',
      hint: 'Manuell: Übertragen drücken. Automatisch: kopiert beim Absenden.',
      tipNoCrm: 'CRM-Fenster nicht erkannt — CRM-Tab-Manager öffnen',
      tipNoTarget: 'Zuerst ein Zielfeld in den Einstellungen wählen',
      tipAuto: 'Übertragung erfolgt automatisch beim Absenden',
      tipTransfer: 'Nachbearbeitungsnotizen ins CRM-Feld kopieren',
    },
    cs: {
      settings: 'Nastavení', transfer: 'Přenést', targetField: 'Cílové pole',
      pickTarget: 'Vybrat cílové pole', transferMode: 'Režim přenosu',
      manual: 'Ručně', automatic: 'Automaticky', glowColor: 'Barva záření',
      content: 'Obsah k přenosu', noFields: 'Nebyla zjištěna žádná upravitelná pole souhrnu.',
      reset: 'Obnovit', field: 'Pole', collapse: 'Sbalit', expand: 'Rozbalit', titleHint: '(bez názvu)',
      hint: 'Ručně: stiskněte Přenést. Automaticky: zkopíruje se při odeslání.',
      tipNoCrm: 'Okno CRM nezjištěno — otevřete správce karet CRM',
      tipNoTarget: 'Nejprve v nastavení vyberte cílové pole',
      tipAuto: 'Přenos proběhne automaticky při odeslání',
      tipTransfer: 'Zkopírovat poznámky uzavření do pole CRM',
    },
  };
  function _wrapLocale() {
    if (_wrapLocaleCache) return _wrapLocaleCache;
    var lang = '';
    try {
      var hosts = ['panel-layout-headless', 'crm-sync-header', 'task-management'];
      for (var i = 0; i < hosts.length && !lang; i++) {
        var h = document.querySelector(hosts[i]);
        if (h && h.getAttribute('locale')) lang = h.getAttribute('locale');
      }
      if (!lang) lang = navigator.language || navigator.userLanguage || 'en';
    } catch (e) { lang = 'en'; }
    var primary = String(lang).toLowerCase().split(/[-_]/)[0];
    _wrapLocaleCache = _WRAP_I18N[primary] ? primary : 'en';
    return _wrapLocaleCache;
  }
  function _wrapT(k) {
    var d = _WRAP_I18N[_wrapLocale()] || _WRAP_I18N.en;
    return (d && d[k] != null) ? d[k] : (_WRAP_I18N.en[k] != null ? _WRAP_I18N.en[k] : k);
  }

  // ── content transform: select/deselect fields + override values ─────────
  var _wrapXformInc = null;   // persisted exclusions { fieldId: false }
  var _wrapXformVal = {};     // in-memory value overrides { fieldId: string }
  function _wrapSlug(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function _wrapLoadInc() {
    if (_wrapXformInc) return _wrapXformInc;
    try { _wrapXformInc = JSON.parse(localStorage.getItem('crmWrapXformInclude') || '{}') || {}; }
    catch (e) { _wrapXformInc = {}; }
    return _wrapXformInc;
  }
  function _wrapSaveInc() {
    try { localStorage.setItem('crmWrapXformInclude', JSON.stringify(_wrapLoadInc())); } catch (e) { /* ignore */ }
  }
  function _wrapIncluded(id) { return _wrapLoadInc()[id] !== false; }
  function _wrapSetIncluded(id, on) { _wrapLoadInc()[id] = !!on; _wrapSaveInc(); }

  var _wrapXformLabel = null;  // persisted label overrides { fieldId: string }
  function _wrapLoadLabels() {
    if (_wrapXformLabel) return _wrapXformLabel;
    try { _wrapXformLabel = JSON.parse(localStorage.getItem('crmWrapXformLabel') || '{}') || {}; }
    catch (e) { _wrapXformLabel = {}; }
    return _wrapXformLabel;
  }
  function _wrapSaveLabels() {
    try { localStorage.setItem('crmWrapXformLabel', JSON.stringify(_wrapLoadLabels())); } catch (e) { /* ignore */ }
  }
  function _wrapLabelOf(id, def) {
    var m = _wrapLoadLabels();
    return Object.prototype.hasOwnProperty.call(m, id) ? m[id] : (def || '');
  }
  function _wrapSetLabel(id, val) { _wrapLoadLabels()[id] = val; _wrapSaveLabels(); }

  var _wrapCollapsed = null;   // persisted toolbar collapse state
  function _wrapLoadCollapsed() {
    if (_wrapCollapsed !== null) return _wrapCollapsed;
    try { _wrapCollapsed = localStorage.getItem('crmWrapCollapsed') === '1'; } catch (e) { _wrapCollapsed = false; }
    return _wrapCollapsed;
  }
  function _wrapSetCollapsedState(on) {
    _wrapCollapsed = !!on;
    try { localStorage.setItem('crmWrapCollapsed', _wrapCollapsed ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function _wrapPost(payload) {
    return new Promise(function (resolve) {
      var reqId = 'w' + (++_wrapReqSeq) + '-' + Date.now();
      var timer = setTimeout(function () {
        if (_wrapPending[reqId]) { delete _wrapPending[reqId]; resolve(null); }
      }, 3000);
      _wrapPending[reqId] = { resolve: resolve, timer: timer };
      try {
        window.postMessage({ __crmWrap: true, reqId: reqId, payload: payload }, '*');
      } catch (e) {
        clearTimeout(timer); delete _wrapPending[reqId]; resolve(null);
      }
    });
  }

  function _wrapInitBridge() {
    if (_wrapBridgeReady) return;
    _wrapBridgeReady = true;
    _wrapInitBc();
    window.addEventListener('message', function (ev) {
      var d = ev.data;
      if (!d || ev.source !== window) return;
      if (d.__crmWrapReply === true && d.reqId && _wrapPending[d.reqId]) {
        var p = _wrapPending[d.reqId];
        delete _wrapPending[d.reqId];
        clearTimeout(p.timer);
        p.resolve(d.resp || null);
        return;
      }
      if (d.__crmWrapPush === true) {
        // Target picked / cleared in the CRM frame → refresh status + re-glow.
        _wrapRefreshStatus().then(function () {
          if (d.event === 'PICKER_RESULT') _wrapPost({ type: 'HIGHLIGHT' });
        });
      }
    });
  }

  // In-browser CRM-open signal (crm-sync-header broadcasts CRM_PRESENCE on the
  // shared 'crm-sync' BroadcastChannel when the Tab Manager connects). This does
  // NOT depend on the relay websocket or the extension's tab lookup.
  function _wrapInitBc() {
    if (_wrapBc) return;
    try {
      _wrapBc = new BroadcastChannel('crm-sync');
      _wrapBc.addEventListener('message', function (ev) {
        var d = ev.data;
        if (d && d.type === 'CRM_PRESENCE') {
          var was = _wrapBcCrmOpen;
          _wrapBcCrmOpen = !!d.open;
          if (was !== _wrapBcCrmOpen) console.log('[panel-layout] wrap-transfer: CRM presence via crm-sync →', _wrapBcCrmOpen);
          _wrapUpdateToolbarState();
        }
        // AI wrap-up summary from the task-management widget → fill the native card.
        if (d && d.type === 'WRAP_SUMMARY' && d.sections) {
          _wrapPendingSummary = d.sections;
          _wrapSummaryApplied = false;
          _wrapSummaryTries = 0;
          console.log('[panel-layout] wrap-summary: received sections; watching for the wrap-up card');
          try { _wrapSummaryStartWatch(); } catch (e) { /* ignore */ }
        }
        // Show/hide the "generating AI summary" spinner over the wrap-up card.
        if (d && d.type === 'WRAP_SUMMARY_PENDING') {
          try { _wrapShowSummarySpinner(); } catch (e) { /* ignore */ }
        }
        if (d && d.type === 'WRAP_SUMMARY_ERROR') {
          try { _wrapHideSummarySpinner(); } catch (e) { /* ignore */ }
        }
      });
    } catch (e) { /* BroadcastChannel unavailable */ }
  }

  function _wrapQueryCrmPresence() {
    try { if (_wrapBc) _wrapBc.postMessage({ type: 'CRM_PRESENCE_QUERY' }); } catch (e) { /* ignore */ }
  }

  function _wrapCrmOpen() {
    return !!(_wrapCfg.crmOpen || _wrapBcCrmOpen);
  }

  function _wrapRefreshStatus() {
    return _wrapPost({ type: 'GET_STATUS' }).then(function (resp) {
      if (resp) {
        _wrapExtWarned = false;
        _wrapCfg = {
          crmOpen: !!resp.crmOpen,
          targetConfigured: !!resp.targetConfigured,
          mode: resp.mode === 'auto' ? 'auto' : 'manual',
        };
        if (resp.glowColor) _wrapApplyGlowColor(resp.glowColor);
        var s = 'crmOpen=' + _wrapCfg.crmOpen + ' target=' + _wrapCfg.targetConfigured + ' mode=' + _wrapCfg.mode;
        if (s !== _wrapStatusStr) { _wrapStatusStr = s; console.log('[panel-layout] wrap-transfer: status from extension', _wrapCfg); }
      } else if (!_wrapExtWarned) {
        _wrapExtWarned = true;
        console.warn('[panel-layout] wrap-transfer: NO reply from the CRM Click-to-Contact extension. ' +
          'RELOAD the Desktop TAB after (re)loading the extension so its content script injects here. ' +
          '(in-browser postMessage → extension; not the relay websocket)');
      }
      _wrapUpdateToolbarState();
      return _wrapCfg;
    });
  }

  // Concrete Webex CC (agentx) wrap-up DOM identifiers, verified from a live
  // wrap-up dialog. The dialog has TWO fields: a reason combobox
  // (md-input inside `.wrap-up-input-wrapper`) AND an editable AI summary
  // (`.interaction-summary > agentx-wc-interaction-summary`). The subheader tells
  // the agent to "select a code and if needed click the summary and edit it" — so
  // the free-text SOURCE we transfer is the summary; the reason picker is a
  // fallback for orgs without a summary. Tried in order; heuristics are last.
  var _WRAP_CONCRETE_SELECTORS = [
    '.interaction-summary',
    'agentx-wc-interaction-summary',
    'md-input[name="wrapup-suggested-reasons-dropdown-id-input"]',
    '.wrap-up-input-wrapper md-input',
    '#pillSearchInput',
    '.wrap-up-input-wrapper',
    '.wrapup-container',
  ];

  function _wrapFindField() {
    // 1) Explicit override from the `wrapupfieldselector` property.
    if (_wrapFieldSelector) {
      var elCfg = findDeep(document.body, _wrapFieldSelector);
      if (elCfg) return elCfg;
    }
    // 2) Concrete agentx wrap-up identifiers.
    for (var i = 0; i < _WRAP_CONCRETE_SELECTORS.length; i++) {
      var el = findDeep(document.body, _WRAP_CONCRETE_SELECTORS[i]);
      if (el) return el;
    }
    // 3) Heuristic last resort: a searchable input / textarea within the
    //    interaction control area (guards against a future markup rename).
    var scopeSelectors = [
      'agentx-wc-control-panel',
      'agentx-react-interaction-control-wrapper',
      '#common-control',
      '.call-control',
    ];
    for (var s = 0; s < scopeSelectors.length; s++) {
      var sc = findDeep(document.body, scopeSelectors[s]);
      if (sc) {
        var h = findDeep(sc.shadowRoot || sc, 'textarea, input[type="search"], input[type="text"]');
        if (h) return h;
      }
    }
    return null;
  }

  var _wrapSdkData = null;  // last wrap-up SDK event payload (auto-mode source)

  // ── AI wrap-up summary writer: fills the native interaction-summary card ─────
  // Runs on its OWN watcher (independent of the wrap-transfer field lookup): the
  // React widget generates a concise structured summary (5 sections) on wrap-up
  // and broadcasts it; we find the interaction-summary AdaptiveCard, enter edit
  // mode, and write each section.
  var _wrapPendingSummary = null;
  var _wrapSummaryApplied = false;
  var _wrapSummaryTries = 0;
  var _wrapSummaryTimer = null;
  var _wrapEditClicks = 0;
  var _wrapPenClicked = false;
  var _wrapSpinnerEl = null;
  var _wrapSpinnerPosTimer = null;
  var _wrapSpinnerSafetyTimer = null;
  var _WRAP_SUMMARY_KEYS = ['initialContactReason', 'additionalContext', 'additionalContactReasons', 'keyActionsTaken', 'nextSteps'];

  // Floating "Generating AI summary…" spinner shown over the wrap-up card while
  // the widget generates the summary (from WRAP_SUMMARY_PENDING until written).
  function _wrapShowSummarySpinner() {
    if (_wrapSpinnerEl) return;
    if (!document.getElementById('pl-wrap-spinner-style')) {
      var st = document.createElement('style');
      st.id = 'pl-wrap-spinner-style';
      st.textContent = '@keyframes plWrapSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    var el = document.createElement('div');
    el.id = 'pl-wrap-summary-spinner';
    el.setAttribute('style', 'position:fixed;z-index:2147483646;display:flex;align-items:center;gap:8px;' +
      'background:#0353a8;color:#fff;font:600 12px/1.2 var(--brand-font-family,Inter,\'Segoe UI\',sans-serif);' +
      'padding:7px 12px;border-radius:16px;box-shadow:0 4px 14px rgba(0,0,0,.25);pointer-events:none;');
    el.innerHTML = '<span style="width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;' +
      'border-radius:50%;display:inline-block;animation:plWrapSpin .8s linear infinite;"></span>' +
      '<span>Generating AI summary…</span>';
    document.body.appendChild(el);
    _wrapSpinnerEl = el;
    _wrapPositionSummarySpinner();
    _wrapSpinnerPosTimer = setInterval(_wrapPositionSummarySpinner, 400);
    // Safety: never leave the spinner up forever.
    _wrapSpinnerSafetyTimer = setTimeout(_wrapHideSummarySpinner, 20000);
  }
  function _wrapPositionSummarySpinner() {
    if (!_wrapSpinnerEl) return;
    var r = null;
    try {
      var target = _wrapSummaryAnchor() || findDeep(document.body, '#common-control') ||
        findDeep(document.body, 'agentx-react-interaction-control-wrapper');
      if (target && target.getBoundingClientRect) r = target.getBoundingClientRect();
    } catch (e) { /* ignore */ }
    if (r && r.width) {
      _wrapSpinnerEl.style.top = Math.max(8, r.top + 48) + 'px';
      _wrapSpinnerEl.style.left = Math.min(window.innerWidth - 230, r.left + 12) + 'px';
    } else {
      _wrapSpinnerEl.style.top = '120px';
      _wrapSpinnerEl.style.left = '120px';
    }
  }
  function _wrapHideSummarySpinner() {
    if (_wrapSpinnerPosTimer) { clearInterval(_wrapSpinnerPosTimer); _wrapSpinnerPosTimer = null; }
    if (_wrapSpinnerSafetyTimer) { clearTimeout(_wrapSpinnerSafetyTimer); _wrapSpinnerSafetyTimer = null; }
    if (_wrapSpinnerEl && _wrapSpinnerEl.parentNode) _wrapSpinnerEl.parentNode.removeChild(_wrapSpinnerEl);
    _wrapSpinnerEl = null;
  }

  function _wrapSummaryAnchor() {
    return findDeep(document.body, 'agentx-wc-interaction-summary')
      || findDeep(document.body, '.interaction-summary')
      || findDeep(document.body, '#response-body-summary-sections-container')
      || findDeep(document.body, '.ac-adaptiveCard');
  }

  // Deep query that ALSO enters `root`'s OWN shadow root. Plain findDeep only
  // recurses DESCENDANTS' shadows, so it never gets past a web component (e.g.
  // agentx-wc-interaction-summary) into its own shadow.
  function _wrapDeep(root, sel) {
    if (!root) return null;
    try { var e = root.querySelector && root.querySelector(sel); if (e) return e; } catch (x) { /* ignore */ }
    if (root.shadowRoot) { var e2 = _wrapDeep(root.shadowRoot, sel); if (e2) return e2; }
    var all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (var i = 0; i < all.length; i++) { if (all[i].shadowRoot) { var e3 = _wrapDeep(all[i].shadowRoot, sel); if (e3) return e3; } }
    return null;
  }
  function _wrapDeepAll(root, sel, out) {
    out = out || [];
    if (!root) return out;
    try { if (root.querySelectorAll) { var l = root.querySelectorAll(sel); for (var i = 0; i < l.length; i++) out.push(l[i]); } } catch (x) { /* ignore */ }
    if (root.shadowRoot) _wrapDeepAll(root.shadowRoot, sel, out);
    var all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (var j = 0; j < all.length; j++) { if (all[j].shadowRoot) _wrapDeepAll(all[j].shadowRoot, sel, out); }
    return out;
  }

  // Set a native <textarea>/<input> value so the AdaptiveCard model updates
  // (React/AdaptiveCards listen on the input event; a raw .value= is ignored).
  function _wrapSetInputValue(el, val) {
    try {
      var isTA = (el.tagName || '').toUpperCase() === 'TEXTAREA';
      var proto = isTA ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      var setter = desc && desc.set;
      if (setter) setter.call(el, val); else el.value = val;
      // input drives the AdaptiveCards model; NO focus()/blur() — that moved focus
      // out of the wrap-up popover and closed it.
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }

  // Log the summary card structure so the exact edit trigger + section layout can
  // be pinned from a live wrap-up.
  function _wrapDumpSummaryCard(anchor) {
    try {
      var container = _wrapDeep(anchor, '#response-body-summary-sections-container');
      var tas = _wrapDeepAll(anchor, 'textarea');
      var secIds = [];
      _WRAP_SUMMARY_KEYS.forEach(function (k) { if (_wrapDeep(anchor, '#' + k)) secIds.push(k); });
      console.log('[panel-layout] wrap-summary CARD anchor=' + (anchor.tagName || '').toLowerCase() +
        ' sectionsContainer=' + (!!container) + ' textareas=' + tas.length +
        ' sectionIds=[' + secIds.join(',') + ']');
    } catch (e) { /* ignore */ }
  }

  // Dump every editable + button in the whole wrap-up control region so we can
  // find the real summary field / edit affordance if it lives outside the card.
  function _wrapDumpWrapRegion() {
    try {
      var region = findDeep(document.body, 'agentx-react-interaction-control-wrapper')
        || findDeep(document.body, '#common-control')
        || findDeep(document.body, '.wrapup-container');
      if (!region) { console.log('[panel-layout] wrap-summary REGION: not found'); return; }
      var tas = findAllDeep(region, 'textarea');
      var ces = findAllDeep(region, '[contenteditable=""],[contenteditable="true"]');
      var inputs = findAllDeep(region, 'md-input, md-textarea, input');
      var summaryEls = findAllDeep(region, '[class*="summary"], agentx-wc-interaction-summary').map(function (e) {
        return (e.tagName || '').toLowerCase() + '.' + ((e.className && e.className.toString) ? e.className.toString().split(/\s+/)[0] : '');
      }).slice(0, 10);
      var btns = findAllDeep(region, 'button, md-button, [role="button"], md-icon').map(function (b) {
        var a = (b.getAttribute && (b.getAttribute('title') || b.getAttribute('aria-label') || b.getAttribute('name') || b.getAttribute('data-testid'))) || '';
        var tx = (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24);
        var c = (b.className && b.className.toString) ? b.className.toString().split(/\s+/).slice(0, 2).join('.') : '';
        return (a || tx || ('.' + c)).trim();
      }).filter(function (s) { return s; }).slice(0, 24);
      console.log('[panel-layout] wrap-summary REGION textareas=' + tas.length + ' contenteditable=' + ces.length + ' inputs=' + inputs.length + ' summaryEls=[' + summaryEls.join(', ') + ']');
      console.log('[panel-layout] wrap-summary REGION buttons=[' + btns.join(' | ') + ']');
    } catch (e) { /* ignore */ }
  }

  // Find the summary card's pen/edit control WITHIN the summary anchor ONLY (a
  // document-wide search previously clicked an unrelated "edit-name-button" and
  // hid the panel).
  function _wrapFindEditControl(anchor) {
    var all = _wrapDeepAll(anchor, 'button, md-button, [role="button"], md-icon, [title], [aria-label], [data-testid]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var s = '';
      try {
        s = [el.getAttribute && el.getAttribute('title'), el.getAttribute && el.getAttribute('aria-label'),
             el.getAttribute && el.getAttribute('data-testid'), (el.className && el.className.toString) ? el.className.toString() : ''
        ].join(' ').toLowerCase();
      } catch (e) { /* ignore */ }
      if (/edit summary|edit the summary|\bedit\b|pencil|upravit|bearbeiten/.test(s) &&
          !/name|copy|delete|remove|feedback|helpful|regenerate|generate|expand|collapse|close/.test(s)) {
        return el;
      }
    }
    return null;
  }

  // Click the summary pen ONCE to reveal the editable fields.
  function _wrapTryEnterEditMode(anchor) {
    if (_wrapPenClicked) return false;
    var pen = _wrapFindEditControl(anchor);
    if (pen) {
      _wrapPenClicked = true;
      try { pen.click(); } catch (e) { /* ignore */ }
      var lbl = (pen.getAttribute && (pen.getAttribute('title') || pen.getAttribute('aria-label') || pen.getAttribute('data-testid'))) || '';
      console.log('[panel-layout] wrap-summary: clicked edit pen "' + lbl + '"');
      return true;
    }
    if (_wrapSummaryTries % 6 === 2) console.log('[panel-layout] wrap-summary: no edit pen found within the summary card yet');
    return false;
  }

  // Returns true once at least one section has been written.
  function _wrapFillSummaryCard(sections) {
    var anchor = _wrapSummaryAnchor();
    if (!anchor) return false;
    var textareas = _wrapDeepAll(anchor, 'textarea');
    if (!textareas.length) {
      _wrapTryEnterEditMode(anchor); // click the pen once to reveal the fields
      return false;
    }
    var wrote = 0;
    for (var i = 0; i < _WRAP_SUMMARY_KEYS.length; i++) {
      var key = _WRAP_SUMMARY_KEYS[i];
      var val = sections[key];
      if (val == null || String(val).trim() === '') continue;
      var sec = _wrapDeep(anchor, '#' + key);
      var ta = sec ? _wrapDeep(sec, 'textarea') : null;
      if (ta && _wrapSetInputValue(ta, String(val))) wrote++;
    }
    if (!wrote) {
      for (var j = 0; j < textareas.length && j < _WRAP_SUMMARY_KEYS.length; j++) {
        var v = sections[_WRAP_SUMMARY_KEYS[j]];
        if (v != null && String(v).trim() !== '' && _wrapSetInputValue(textareas[j], String(v))) wrote++;
      }
    }
    if (wrote) console.log('[panel-layout] wrap-summary: wrote', wrote, 'section(s) into the wrap-up card');
    return wrote > 0;
  }

  function _wrapSummaryStartWatch() {
    if (_wrapSummaryTimer) return;
    _wrapSummaryTries = 0;
    _wrapEditClicks = 0;
    _wrapPenClicked = false;
    _wrapSummaryTimer = setInterval(_wrapSummaryTick, 700);
    _wrapSummaryTick();
  }
  function _wrapSummaryStopWatch() {
    if (_wrapSummaryTimer) { clearInterval(_wrapSummaryTimer); _wrapSummaryTimer = null; }
  }
  function _wrapSummaryTick() {
    if (!_wrapPendingSummary || _wrapSummaryApplied) { _wrapSummaryStopWatch(); return; }
    _wrapSummaryTries++;
    if (_wrapSummaryTries > 80) { // ~56s
      console.warn('[panel-layout] wrap-summary: gave up finding an editable wrap-up card after ' + _wrapSummaryTries + ' tries — run __wrapSummaryDiag() during wrap-up');
      _wrapSummaryStopWatch();
      _wrapHideSummarySpinner();
      return;
    }
    var anchor = _wrapSummaryAnchor();
    if (!anchor) {
      if (_wrapSummaryTries % 8 === 1) console.log('[panel-layout] wrap-summary: waiting for the wrap-up summary card to render…');
      return;
    }
    if (_wrapSummaryTries % 6 === 1) _wrapDumpSummaryCard(anchor);
    if (_wrapFillSummaryCard(_wrapPendingSummary)) {
      _wrapSummaryApplied = true;
      _wrapSummaryStopWatch();
      _wrapHideSummarySpinner();
      console.log('[panel-layout] wrap-summary: applied ✅');
    }
  }

  // Diagnostic: run __wrapSummaryDiag() in the Desktop console during wrap-up.
  try {
    window.__wrapSummaryDiag = function () {
      var a = _wrapSummaryAnchor();
      if (a) _wrapDumpSummaryCard(a); else console.log('[panel-layout] wrap-summary: no summary card in DOM');
      _wrapDumpWrapRegion();
      return { anchor: !!a, pending: !!_wrapPendingSummary, applied: _wrapSummaryApplied, tries: _wrapSummaryTries };
    };
  } catch (e) { /* ignore */ }

  // Assemble the editable AI summary the way the card's own "Copy summary" button
  // does. agentx-wc-interaction-summary renders a Microsoft Adaptive Card of
  // labeled textareas (Contact reason / Details / Additional topics / Actions
  // taken / Next steps) under #response-body-summary-sections-container.
  function _wrapReadSummary(anchor) {
    try {
      var container = findDeep(anchor, '#response-body-summary-sections-container');
      if (container && container.children && container.children.length) {
        var lines = [];
        var secs = container.children;
        for (var i = 0; i < secs.length; i++) {
          var sec = secs[i];
          var ta = sec.querySelector('textarea, input');
          var val = ta ? (ta.value || '').trim() : '';
          if (val) {
            // Edit mode: labelled <textarea>. Prefix with its label text block.
            var labelEl = sec.querySelector('.ac-textBlock p') || sec.querySelector('.ac-textBlock');
            var label = labelEl ? (labelEl.textContent || '').trim() : '';
            if (label && val.indexOf(label) !== 0) val = label + ' ' + val;
          } else {
            // Read mode: no textarea — the value is rendered as text blocks.
            var blocks = sec.querySelectorAll('.ac-textBlock');
            var parts = [];
            for (var b = 0; b < blocks.length; b++) {
              var tx = (blocks[b].textContent || '').replace(/\s+/g, ' ').trim();
              if (tx && parts.indexOf(tx) < 0) parts.push(tx);
            }
            val = parts.join(' ');
          }
          if (val) lines.push(val);
        }
        if (lines.length) {
          var titleEl = findDeep(anchor, '.ac-textBlock p');
          var title = titleEl ? (titleEl.textContent || '').trim() : '';
          if (title && lines.join('\n').indexOf(title) >= 0) title = '';
          return (title ? title + '\n' : '') + lines.join('\n');
        }
      }
      // Fallback: read every Adaptive Card text/input block in document order
      // (covers layouts without the sections container in read-only mode).
      var root = findDeep(anchor, '.ac-adaptiveCard') || anchor;
      var all = root.querySelectorAll ? root.querySelectorAll('.ac-textBlock, textarea, input') : [];
      var out = []; var last = '';
      for (var k = 0; k < all.length; k++) {
        var el = all[k];
        var t = (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')
          ? (el.value || '').trim()
          : (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t !== last && !_wrapIsNoiseLine(t)) { out.push(t); last = t; }
      }
      return out.join('\n');
    } catch (e) { return ''; }
  }

  // Build the auto-mode transfer text from the SDK wrap-up payload (the summary
  // DOM is gone by submit time, so auto mode sources the SDK event instead).
  function _wrapBuildSdkText(d) {
    if (!d || typeof d !== 'object') return '';
    var out = [];
    var reason = d.wrapUpReason || d.wrapUpAuxCodeName || d.wrapupCodeName || d.reason ||
      (d.wrapUp && (d.wrapUp.name || d.wrapUp.reason));
    if (reason) out.push('Wrap-up: ' + reason);
    var summary = d.summary || d.callSummary || d.aiSummary || d.wrapUpSummary || d.conversationSummary;
    if (summary && typeof summary === 'string') out.push(summary);
    return out.join('\n');
  }

  // Extract the wrap-up text from the located anchor. For the summary anchor we
  // assemble the Adaptive Card sections; otherwise fall back to an editable field
  // (reason input incl. its shadow <input>) or a selected reason chip.
  function _wrapReadFieldText() {
    var el = _wrapField;
    if (!el) return _wrapLastText || '';
    try {
      if (el.tagName === 'AGENTX-WC-INTERACTION-SUMMARY' ||
          (el.className && el.className.toString().indexOf('interaction-summary') >= 0)) {
        var sum = _wrapReadSummary(el);
        if (sum) return sum;
      }
      var editable = findDeep(el, 'textarea, md-textarea, [contenteditable=""], [contenteditable="true"], md-input, input');
      if (!editable) {
        var t0 = el.tagName;
        if (t0 === 'MD-INPUT' || t0 === 'INPUT' || t0 === 'TEXTAREA' || el.isContentEditable) editable = el;
      }
      if (editable) {
        if (editable.isContentEditable) {
          var ce = (editable.textContent || '').trim();
          if (ce) return ce;
        }
        if (typeof editable.value === 'string' && editable.value.trim()) return editable.value;
        var inner = editable.shadowRoot && editable.shadowRoot.querySelector('input, textarea, [contenteditable]');
        if (inner) {
          if (typeof inner.value === 'string' && inner.value.trim()) return inner.value;
          var it = (inner.textContent || '').trim();
          if (it) return it;
        }
      }
      // Selected reason chip (AI-suggested variant).
      var chipRoot = (el.closest && el.closest('.wrapup-container, .wrap-up-popover-wrapper')) || el;
      var chips = chipRoot.querySelectorAll
        ? chipRoot.querySelectorAll('[data-chip-interactive="true"], .suggestion-chips__chip--interactive')
        : null;
      if (chips && chips.length) {
        var parts = [];
        for (var c = 0; c < chips.length; c++) {
          var tx = (chips[c].textContent || '').trim();
          if (tx) parts.push(tx);
        }
        if (parts.length) return parts.join(', ');
      }
    } catch (e) { /* ignore */ }
    return _wrapLastText || '';
  }

  // Deep querySelectorAll that descends through open shadow roots.
  function findAllDeep(root, selector) {
    var out = [];
    if (!root || !root.querySelectorAll) return out;
    try { Array.prototype.push.apply(out, root.querySelectorAll(selector)); } catch (e) { /* ignore */ }
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) out = out.concat(findAllDeep(all[i].shadowRoot, selector));
    }
    return out;
  }

  function _wrapControlValue(n) {
    try {
      if (n.isContentEditable) return (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (typeof n.value === 'string' && n.value.trim()) return n.value.trim();
      var inner = n.shadowRoot && n.shadowRoot.querySelector('input, textarea, [contenteditable]');
      if (inner) return (inner.value || inner.textContent || '').trim();
      if (n.querySelector) { var q = n.querySelector('input, textarea'); if (q && q.value) return q.value.trim(); }
    } catch (e) { /* ignore */ }
    return '';
  }

  function _wrapLabelFor(n) {
    try {
      var al = n.getAttribute && (n.getAttribute('aria-label') || n.getAttribute('placeholder'));
      if (al) return al.trim();
      var root = n.getRootNode ? n.getRootNode() : document;
      if (n.id && root.querySelector) {
        var esc = (window.CSS && CSS.escape) ? CSS.escape(n.id) : n.id;
        var lf = root.querySelector('label[for="' + esc + '"]');
        if (lf) return (lf.textContent || '').replace(/\s+/g, ' ').trim();
      }
      var lab = n.closest && n.closest('label');
      if (lab) { var t = (lab.textContent || '').replace(/\s+/g, ' ').trim(); if (t && t.length < 80) return t; }
      var nm = n.getAttribute && n.getAttribute('name');
      if (nm) return nm.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }).trim();
    } catch (e) { /* ignore */ }
    return '';
  }

  // The wrap-up region that may contain several structured source elements (the
  // reason input, the AI summary sections, chips, …). Walk up from the anchor
  // crossing shadow boundaries; fall back to the anchor itself.
  function _wrapRegionScope() {
    var el = _wrapField, hop = 0;
    var isRegion = function (n) {
      try { return n.matches && n.matches('.wrapup-container,.wrap-up-popover-wrapper,agentx-wc-wrapup,.wrapup,agentx-wc-interaction-control'); }
      catch (e) { return false; }
    };
    while (el && hop < 15) {
      if (el.nodeType === 1 && isRegion(el)) return el;
      var parent = el.parentElement;
      if (!parent) {
        var root = el.getRootNode && el.getRootNode();
        if (root && root.host) { el = root.host; hop++; continue; }
        break;
      }
      el = parent; hop++;
    }
    return _wrapField;
  }

  // The AI summary card — the free-text source that actually gets transferred.
  // It is a distinct element from the reason search/combobox above it.
  var _wrapSummaryRootCache = null;
  function _wrapSummaryRoot() {
    if (_wrapSummaryRootCache && _wrapSummaryRootCache.isConnected) return _wrapSummaryRootCache;
    _wrapSummaryRootCache = null;
    var sels = ['agentx-wc-interaction-summary', '.interaction-summary', '[class*="interaction-summary"]'];
    for (var i = 0; i < sels.length; i++) { var e = findDeep(document.body, sels[i]); if (e) { _wrapSummaryRootCache = e; return e; } }
    var card = findDeep(document.body, '#response-body-summary-sections-container') || findDeep(document.body, '.ac-adaptiveCard');
    if (card) { _wrapSummaryRootCache = card; return card; }
    var f = _wrapField;
    if (f && (f.tagName === 'AGENTX-WC-INTERACTION-SUMMARY' ||
        (f.className && String(f.className).indexOf('interaction-summary') >= 0))) { _wrapSummaryRootCache = f; return f; }
    return null;
  }

  // Split an assembled summary string into labelled fields on "Label:" markers
  // (works when the DOM structure is opaque). A label is a short, non-sentence
  // segment before a colon; its value is the remainder + following non-label lines.
  // Summary-card chrome that is NOT wrap-up data (footer badge, feedback icons).
  function _wrapIsNoiseLine(s) {
    var t = String(s || '').replace(/[·•|]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!t) return true;
    return /^(ai[-\s]?generated|generated by ai|ai summary|vygenerov)\b/.test(t);
  }

  function _wrapSplitLabeled(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
      .filter(function (s) { return s && !_wrapIsNoiseLine(s); });
    var fields = [], cur = null;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var m = ln.match(/^([^:：]{1,34})[:：]\s*(.*)$/);
      var isLabel = m && !/[.!?]$/.test(m[1]) && m[1].split(' ').length <= 6;
      if (isLabel) {
        if (cur) fields.push(cur);
        cur = { label: m[1].trim(), value: (m[2] || '').trim() };
      } else if (cur) {
        cur.value += (cur.value ? ' ' : '') + ln;
      } else {
        fields.push({ label: '', value: ln });   // preamble / title
      }
    }
    if (cur) fields.push(cur);
    // Drop a leading title-only field when real labelled fields follow.
    while (fields.length > 1 && !fields[0].label && fields.some(function (f, ix) { return ix > 0 && f.label; })) fields.shift();
    return fields;
  }

  // The reason picker / suggestion search must never be treated as source text.
  function _wrapIsReasonPicker(n) {
    try {
      var name = (n.getAttribute && n.getAttribute('name')) || '';
      var ph = (n.getAttribute && n.getAttribute('placeholder')) || '';
      var role = (n.getAttribute && n.getAttribute('role')) || '';
      var type = ((n.getAttribute && n.getAttribute('type')) || '').toLowerCase();
      if (/reason|dropdown|suggest/i.test(name)) return true;
      if (n.id && /pillsearch|reason|suggest/i.test(n.id)) return true;
      if (role === 'combobox' || role === 'searchbox') return true;
      if (type === 'search') return true;
      if (/hledat|search|suchen|rechercher|buscar|szukaj|ara/i.test(ph)) return true;
      if (n.closest && n.closest('.wrap-up-input-wrapper, .suggestion-chips, [role="combobox"], .md-combobox, .searchable-dropdown, .select-search')) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  // Parse the summary card into labelled fields, trying (in order): the
  // adaptive-card sections container, editable textareas, read-mode text-block
  // pairs, then an innerText line-pairing fallback.
  function _wrapParseSummary(root, push) {
    // 1) Adaptive Card sections container (cleanest — edit or read mode).
    var container = findDeep(root, '#response-body-summary-sections-container');
    if (container && container.children && container.children.length) {
      var secs = container.children;
      for (var i = 0; i < secs.length; i++) {
        var sec = secs[i];
        var labelEl = sec.querySelector('.ac-textBlock p') || sec.querySelector('.ac-textBlock');
        var label = labelEl ? (labelEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        var ta = sec.querySelector('textarea, input');
        var val;
        if (ta) { val = (ta.value || '').trim(); }
        else {
          var blks = sec.querySelectorAll('.ac-textBlock');
          var parts = [];
          for (var b = 0; b < blks.length; b++) {
            var tx = (blks[b].textContent || '').replace(/\s+/g, ' ').trim();
            if (tx) parts.push(tx);
          }
          if (parts.length && parts[0] === label) parts.shift();
          val = parts.join(' ');
        }
        push(sec.id || label, label, val);
      }
      return;
    }
    // 2) Editable textareas / contenteditable inside the summary.
    var tas = findAllDeep(root, 'textarea, [contenteditable=""], [contenteditable="true"]');
    var got = false;
    for (var t = 0; t < tas.length; t++) {
      var e = tas[t];
      if (_wrapIsReasonPicker(e)) continue;
      var v = e.isContentEditable ? (e.textContent || '').replace(/\s+/g, ' ').trim() : (e.value || '').trim();
      var host = (e.closest && e.closest('[id]')) || e.parentElement;
      var lEl = host && (host.querySelector('.ac-textBlock p') || host.querySelector('.ac-textBlock') || host.querySelector('label'));
      var lbl = lEl ? (lEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
      push((host && host.id) || lbl, lbl, v);
      got = true;
    }
    if (got) return;
    // 3) Read-mode adaptive-card text blocks: pair bold label + following value.
    var allBlocks = findAllDeep(root, '.ac-textBlock');
    var blocks = [];
    for (var bi = 0; bi < allBlocks.length; bi++) {
      var bs = (allBlocks[bi].textContent || '').replace(/\s+/g, ' ').trim();
      if (bs && !_wrapIsNoiseLine(bs)) blocks.push(allBlocks[bi]);
    }
    if (blocks.length) {
      for (var k = 0; k < blocks.length; k++) {
        var el = blocks[k];
        var s = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!s) continue;
        var bold = false;
        try { var w = window.getComputedStyle(el).fontWeight || ''; bold = (parseInt(w, 10) >= 600) || /bold/i.test(w); } catch (e2) { /* ignore */ }
        if (bold && k + 1 < blocks.length) {
          var nv = (blocks[k + 1].textContent || '').replace(/\s+/g, ' ').trim();
          push(_wrapSlug(s), s.replace(/[:：]\s*$/, ''), nv);
          k++;
        } else {
          push('line-' + k, '', s);
        }
      }
      return;
    }
    // 4) innerText line pairing (label ends with ":" → next line is its value).
    var raw = (root.innerText || root.textContent || '');
    var lines = raw.split(/\r?\n/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); })
      .filter(function (x) { return x && !_wrapIsNoiseLine(x); });
    for (var m = 0; m < lines.length; m++) {
      var ln = lines[m];
      if (/[:：]$/.test(ln) && m + 1 < lines.length) { push(_wrapSlug(ln), ln.replace(/[:：]\s*$/, ''), lines[++m]); }
      else {
        var mm = ln.match(/^(.{1,40}?)[:：]\s+(.+)$/);
        if (mm) push(_wrapSlug(mm[1]), mm[1], mm[2]);
        else push('line-' + m, '', ln);
      }
    }
  }

  // Collect the structured source elements the transfer text is assembled from,
  // so the agent can select/deselect or rewrite each. Prefers the AI summary
  // card; only if there is none does it look at other editable region controls
  // (never the reason picker). Returns [{ id, label, value }].
  function _wrapReadSummaryFields() {
    if (!_wrapField) return [];
    function mkPush(arr, seen) {
      return function (id, label, value) {
        label = (label == null ? '' : String(label)).trim();
        value = (value == null ? '' : String(value)).trim();
        if (!label && !value) return;
        id = _wrapSlug(id) || _wrapSlug(label) || ('f' + arr.length);
        var base = id, k = 1;
        while (seen[id]) id = base + '-' + (k++);
        seen[id] = 1;
        arr.push({ id: id, label: label, value: value });
      };
    }
    function labeled(arr) { return arr.filter(function (f) { return f.label; }).length; }
    function inOurUI(n) { return !!(n.closest && n.closest('.crm-wrap-pop, .crm-wrap-toolbar')); }
    try {
      var summaryRoot = _wrapSummaryRoot() || _wrapField;

      // (a) Structured DOM parse of the summary card.
      var domFields = [];
      if (summaryRoot) _wrapParseSummary(summaryRoot, mkPush(domFields, {}));

      // (b) Label-split of the assembled summary text.
      var text = '';
      try { text = _wrapReadSummary(summaryRoot || _wrapField) || ''; } catch (e2) { text = ''; }
      if (!text) text = _wrapReadFieldText();
      var txtFields = [], tp = mkPush(txtFields, {});
      _wrapSplitLabeled(text).forEach(function (f) { if (f.value) tp(f.label, f.label, f.value); });

      // Pick the richer structured result (prefer more labelled fields).
      var chosen = null;
      if (labeled(txtFields) >= 2 && labeled(txtFields) >= labeled(domFields)) chosen = txtFields;
      else if (domFields.length) chosen = domFields;
      else if (txtFields.length) chosen = txtFields;
      if (chosen && chosen.length) return chosen;

      // (c) No summary → other editable region controls (excluding reason picker).
      var out = [], op = mkPush(out, {});
      var scope = _wrapRegionScope();
      if (scope) {
        var nodes = findAllDeep(scope, 'textarea, input, md-input, [contenteditable=""], [contenteditable="true"]');
        for (var m = 0; m < nodes.length; m++) {
          var n = nodes[m];
          if (inOurUI(n) || !_wrapVisible(n) || _wrapIsReasonPicker(n)) continue;
          var type = ((n.getAttribute && n.getAttribute('type')) || '').toLowerCase();
          if (n.tagName === 'INPUT' && /^(hidden|checkbox|radio|button|submit|range|color|file)$/.test(type)) continue;
          var v = _wrapControlValue(n);
          if (!v) continue;
          op(n.id || (n.getAttribute && n.getAttribute('name')), _wrapLabelFor(n), v);
        }
        if (out.length) return out;
      }
      // (d) Fallback: the whole transferable text as a single editable field.
      var whole = _wrapReadFieldText();
      if (whole) op('all', '', whole);
      return out;
    } catch (e) { /* ignore */ }
    return [];
  }

  // Build the transfer text honouring the content transform: included fields
  // only, using the agent's value overrides. Falls back to the raw reader when
  // there are no structured summary fields (e.g. a reason-only wrap-up).
  function _wrapBuildTransformedText() {
    var fields = _wrapReadSummaryFields();
    if (fields.length) {
      var lines = [];
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        if (!_wrapIncluded(f.id)) continue;
        var v = (_wrapXformVal[f.id] != null) ? _wrapXformVal[f.id] : f.value;
        v = (v == null ? '' : String(v)).trim();
        if (!v) continue;
        var label = _wrapLabelOf(f.id, f.label).replace(/[:：]\s*$/, '').trim();
        lines.push(label ? (label + ': ' + v) : v);
      }
      if (lines.length) return lines.join('\n');
    }
    return _wrapReadFieldText();
  }

  function _wrapInjectGlowInto(root) {
    var container = (root && root.nodeType === 11) ? root : document.head;
    if (!container || (container.querySelector && container.querySelector('style[data-crm-wrap-glow]'))) return;
    var st = document.createElement('style');
    st.setAttribute('data-crm-wrap-glow', '1');
    st.textContent =
      '@keyframes crmWrapSourceGlow{' +
      '0%,100%{box-shadow:0 0 0 3px color-mix(in srgb,var(--crm-wrap-glow,#0e7fc1) 45%,transparent),' +
      '0 0 10px 2px color-mix(in srgb,var(--crm-wrap-glow,#0e7fc1) 22%,transparent)}' +
      '50%{box-shadow:0 0 0 5px color-mix(in srgb,var(--crm-wrap-glow,#0e7fc1) 70%,transparent),' +
      '0 0 20px 7px color-mix(in srgb,var(--crm-wrap-glow,#0e7fc1) 42%,transparent)}}' +
      '.crm-wrap-source-glow{outline:2px solid var(--crm-wrap-glow,#0e7fc1) !important;outline-offset:2px !important;' +
      'border-radius:6px;animation:crmWrapSourceGlow 1.4s ease-in-out infinite !important;}';
    container.appendChild(st);
  }

  function _wrapEnsureDocStyle() {
    if (document.getElementById('crm-wrap-doc-style')) return;
    var font = 'var(--md-font-family,"CiscoSansTT Regular","CiscoSansTT",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif)';
    var st = document.createElement('style');
    st.id = 'crm-wrap-doc-style';
    st.textContent = [
      '.crm-wrap-toolbar,.crm-wrap-pop{--w-panel:#fff;--w-border:#dbe3ec;--w-text:#0a2236;',
      '--w-text2:#5b6b7b;--w-accent:#0e7fc1;--w-accent-strong:#0b6ca6;--w-bg:#f4f7fa;--w-active:#cfe0ee;',
      'font-family:' + font + ';}',
      '.crm-wrap-toolbar.md--dark,.crm-wrap-pop.md--dark{--w-panel:#17242f;--w-border:rgba(255,255,255,.08);',
      '--w-text:rgba(255,255,255,.88);--w-text2:rgba(255,255,255,.5);--w-accent:#2dadce;--w-accent-strong:#3bbfe0;',
      '--w-bg:#0f1b26;--w-active:rgba(45,173,206,.16);}',
      '.crm-wrap-toolbar{position:fixed;z-index:2147483000;display:inline-flex;align-items:center;gap:4px;',
      'padding:4px;border-radius:20px;background:var(--w-panel);border:1px solid var(--w-border);',
      'box-shadow:0 6px 20px rgba(10,34,54,.16);}',
      '.crm-wrap-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;',
      'padding:6px 12px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;color:var(--w-text2);',
      'font-family:inherit;transition:background .12s,color .12s;}',
      '.crm-wrap-btn:hover{background:var(--w-bg);color:var(--w-text);}',
      '.crm-wrap-btn svg{display:block;}',
      '.crm-wrap-btn--primary{background:var(--w-accent);color:#fff;}',
      '.crm-wrap-btn--primary:hover{background:var(--w-accent-strong);color:#fff;}',
      '.crm-wrap-btn[disabled]{opacity:.45;cursor:default;}',
      '.crm-wrap-btn[disabled]:hover{background:transparent;color:var(--w-text2);}',
      '.crm-wrap-btn--primary[disabled]:hover{background:var(--w-accent);color:#fff;}',
      '.crm-wrap-toggle{padding:6px;border-radius:50%;color:var(--w-text2);}',
      '.crm-wrap-toggle:hover{background:var(--w-bg);color:var(--w-accent);}',
      '.crm-wrap-toolbar.is-collapsed{padding:3px;gap:0;}',
      '.crm-wrap-toolbar.is-collapsed .crm-wrap-btn:not(.crm-wrap-toggle){display:none;}',
      '.crm-wrap-toolbar.is-collapsed .crm-wrap-toggle{color:var(--w-accent);}',
      '.crm-wrap-pop{position:fixed;z-index:2147483001;min-width:236px;max-width:300px;padding:14px;',
      'border-radius:12px;background:var(--w-panel);border:1px solid var(--w-border);color:var(--w-text);',
      'box-shadow:0 12px 32px rgba(10,34,54,.22);}',
      '.crm-wrap-pop__label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;',
      'color:var(--w-text2);margin:14px 0 6px;}',
      '.crm-wrap-pop__label:first-child{margin-top:0;}',
      '.crm-wrap-pop__pick{all:unset;box-sizing:border-box;display:block;width:100%;text-align:center;',
      'padding:9px 10px;border-radius:16px;background:var(--w-accent);color:#fff;font-size:12px;font-weight:600;',
      'cursor:pointer;font-family:inherit;transition:background .12s;}',
      '.crm-wrap-pop__pick:hover{background:var(--w-accent-strong);}',
      '.crm-wrap-seg{display:flex;gap:3px;background:var(--w-bg);border:1px solid var(--w-border);',
      'border-radius:18px;padding:3px;}',
      '.crm-wrap-seg__btn{all:unset;box-sizing:border-box;flex:1 1 0;text-align:center;padding:6px 10px;',
      'border-radius:15px;font-size:12px;font-weight:600;cursor:pointer;color:var(--w-text2);font-family:inherit;',
      'transition:background .12s,color .12s;}',
      '.crm-wrap-seg__btn:hover{color:var(--w-text);}',
      '.crm-wrap-seg__btn.is-active{background:var(--w-panel);color:var(--w-accent);box-shadow:0 1px 3px rgba(10,34,54,.16);}',
      '.crm-wrap-swatches{display:flex;flex-wrap:wrap;gap:8px;}',
      '.crm-wrap-swatch{all:unset;box-sizing:border-box;width:22px;height:22px;border-radius:50%;cursor:pointer;',
      'border:2px solid var(--w-panel);box-shadow:0 0 0 1px var(--w-border);transition:transform .1s;}',
      '.crm-wrap-swatch:hover{transform:scale(1.12);}',
      '.crm-wrap-swatch.is-active{box-shadow:0 0 0 2px var(--w-accent);}',
      '.crm-wrap-pop__row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:14px 0 6px;}',
      '.crm-wrap-pop__reset{all:unset;box-sizing:border-box;cursor:pointer;font-size:10px;font-weight:700;',
      'text-transform:uppercase;letter-spacing:.05em;color:var(--w-accent);}',
      '.crm-wrap-pop__reset:hover{color:var(--w-accent-strong);text-decoration:underline;}',
      '.crm-wrap-fields{display:flex;flex-direction:column;gap:8px;max-height:230px;overflow:auto;}',
      '.crm-wrap-field{border:1px solid var(--w-border);border-radius:10px;padding:8px;background:var(--w-bg);}',
      '.crm-wrap-field__head{display:flex;align-items:center;gap:7px;cursor:pointer;}',
      '.crm-wrap-field__cb{width:15px;height:15px;accent-color:var(--w-accent);cursor:pointer;margin:0;flex:0 0 auto;}',
      '.crm-wrap-field__label{font-size:11px;font-weight:700;color:var(--w-text);}',
      '.crm-wrap-field__title{all:unset;box-sizing:border-box;flex:1 1 auto;min-width:0;font-size:11px;',
      'font-weight:700;color:var(--w-text);padding:2px 4px;border-radius:5px;border:1px solid transparent;',
      'font-family:inherit;cursor:text;}',
      '.crm-wrap-field__title:hover{border-color:var(--w-border);}',
      '.crm-wrap-field__title:focus{border-color:var(--w-accent);box-shadow:0 0 0 2px var(--w-active);}',
      '.crm-wrap-field__title::placeholder{color:var(--w-text2);font-weight:400;font-style:italic;}',
      '.crm-wrap-field__val{box-sizing:border-box;width:100%;margin-top:6px;padding:6px 8px;border-radius:8px;',
      'border:1px solid var(--w-border);background:var(--w-panel);color:var(--w-text);font-family:inherit;',
      'font-size:12px;line-height:1.35;resize:vertical;min-height:32px;}',
      '.crm-wrap-field__val:focus{outline:none;border-color:var(--w-accent);box-shadow:0 0 0 2px var(--w-active);}',
      '.crm-wrap-field.is-off{opacity:.5;}',
      '.crm-wrap-field.is-off .crm-wrap-field__val{background:var(--w-bg);}',
      '.crm-wrap-pop__empty{font-size:11px;color:var(--w-text2);margin:6px 0 0;}',
      '.crm-wrap-pop__hint{font-size:11px;color:var(--w-text2);margin:12px 0 0;line-height:1.4;}',
    ].join('');
    document.head.appendChild(st);
  }

  // Apply the chosen glow colour to the live source field + reflect the swatch.
  function _wrapApplyGlowColor(color) {
    if (color) _wrapGlowColor = color;
    if (_wrapField) { try { _wrapField.style.setProperty('--crm-wrap-glow', _wrapGlowColor); } catch (e) { /* ignore */ } }
    var pop = _wrapToolbar && _wrapToolbar._pop;
    if (pop) {
      var sw = pop.querySelectorAll('.crm-wrap-swatch');
      for (var i = 0; i < sw.length; i++) sw[i].classList.toggle('is-active', sw[i].getAttribute('data-color') === _wrapGlowColor);
    }
  }

  // True only while the wrap-up field is actually on screen. The Desktop often
  // leaves the field detached/hidden when the panel is dismissed, so a mere
  // "element exists" test isn't enough to keep the toolbar attached to it.
  function _wrapVisible(el) {
    if (!el || !el.isConnected) return false;
    try {
      if (typeof el.checkVisibility === 'function' &&
          !el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false;
      var r = el.getBoundingClientRect();
      if (!r || (r.width === 0 && r.height === 0)) return false;
    } catch (e) { return false; }
    return true;
  }

  function _wrapPositionUI() {
    if (!_wrapToolbar || !_wrapField) return;
    // If the wrap-up panel has gone (field detached/hidden), tear the toolbar
    // down immediately instead of leaving it hovering over unrelated content.
    if (!_wrapVisible(_wrapField)) { _wrapSetHighlight(false); _wrapHideUI(); return; }
    var r;
    try { r = _wrapField.getBoundingClientRect(); } catch (e) { return; }
    if (!r || (r.width === 0 && r.height === 0)) return;
    var tw = _wrapToolbar.offsetWidth || 0;
    var th = _wrapToolbar.offsetHeight || 0;
    // Dock onto the frame's top-right corner, straddling the border so the
    // toolbar reads as part of the glowing frame (not floating over other UI).
    var top = r.top - Math.round(th / 2);
    if (top < 4) top = r.bottom - Math.round(th / 2);
    var left = r.right - tw - 8;
    if (left < 4) left = 4;
    _wrapToolbar.style.top = top + 'px';
    _wrapToolbar.style.left = left + 'px';
    var pop = _wrapToolbar._pop;
    if (pop && pop.parentNode) {
      pop.style.top = (top + (_wrapToolbar.offsetHeight || 0) + 6) + 'px';
      pop.style.left = Math.max(4, r.right - (pop.offsetWidth || 0)) + 'px';
    }
  }

  function _wrapUpdateToolbarState() {
    if (!_wrapToolbar) return;
    var transferBtn = _wrapToolbar._transferBtn;
    if (transferBtn) {
      var open = _wrapCrmOpen();
      var enabled = open && _wrapCfg.targetConfigured && _wrapCfg.mode === 'manual';
      if (enabled) transferBtn.removeAttribute('disabled');
      else transferBtn.setAttribute('disabled', 'disabled');
      transferBtn.title = !open
        ? _wrapT('tipNoCrm')
        : !_wrapCfg.targetConfigured
          ? _wrapT('tipNoTarget')
          : (_wrapCfg.mode !== 'manual' ? _wrapT('tipAuto') : _wrapT('tipTransfer'));
    }
    var pop = _wrapToolbar._pop;
    if (pop) {
      var segs = pop.querySelectorAll('.crm-wrap-seg__btn');
      for (var i = 0; i < segs.length; i++) {
        segs[i].classList.toggle('is-active', segs[i].getAttribute('data-mode') === _wrapCfg.mode);
      }
    }
  }

  function _wrapClosePopover() {
    if (_wrapToolbar && _wrapToolbar._pop && _wrapToolbar._pop.parentNode) {
      _wrapToolbar._pop.parentNode.removeChild(_wrapToolbar._pop);
    }
    if (_wrapToolbar) _wrapToolbar._pop = null;
  }

  function _wrapBuildPopover() {
    var pop = document.createElement('div');
    pop.className = 'crm-wrap-pop' + (_darkMode ? ' md--dark' : '');
    // A bubble-phase guard so a click inside the popover never reaches the host
    // desktop's outside-click detector that would dismiss the wrap-up dialog.
    pop.addEventListener('click', function (e) { e.stopPropagation(); });

    var targetLabel = document.createElement('p');
    targetLabel.className = 'crm-wrap-pop__label';
    targetLabel.textContent = _wrapT('targetField');

    var pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'crm-wrap-pop__pick';
    pick.textContent = _wrapT('pickTarget');
    pick.addEventListener('click', function () {
      _wrapPost({ type: 'PICKER_START' }).then(function (r) {
        if (!r) console.warn('[panel-layout] wrap-transfer: PICKER_START got NO reply — the CRM extension is not responding in this tab. HARD-RELOAD this Desktop tab (its content script was orphaned by an extension reload).');
        else if (!r.ok) console.warn('[panel-layout] wrap-transfer: PICKER_START ok=false frames=' + (r.frames || 0) + ' — open the CRM Tab Manager so a CRM frame can receive the picker.');
        else console.log('[panel-layout] wrap-transfer: PICKER_START delivered to', r.frames, 'frame(s)');
      });
      _wrapClosePopover();
    });

    var modeLabel = document.createElement('p');
    modeLabel.className = 'crm-wrap-pop__label';
    modeLabel.textContent = _wrapT('transferMode');
    var seg = document.createElement('div');
    seg.className = 'crm-wrap-seg';
    [['manual', _wrapT('manual')], ['auto', _wrapT('automatic')]].forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'crm-wrap-seg__btn';
      b.setAttribute('data-mode', m[0]);
      b.textContent = m[1];
      b.addEventListener('click', function () {
        _wrapPost({ type: 'SET_MODE', mode: m[0] }).then(function () { _wrapRefreshStatus(); });
      });
      seg.appendChild(b);
    });

    // Content transform — select/deselect summary fields and edit their values.
    var fields = _wrapReadSummaryFields();
    var contentRow = document.createElement('div');
    contentRow.className = 'crm-wrap-pop__row';
    var contentLabel = document.createElement('span');
    contentLabel.className = 'crm-wrap-pop__label';
    contentLabel.style.margin = '0';
    contentLabel.textContent = _wrapT('content');
    contentRow.appendChild(contentLabel);
    if (fields.length) {
      var reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'crm-wrap-pop__reset';
      reset.textContent = _wrapT('reset');
      reset.addEventListener('click', function () {
        _wrapXformVal = {};
        _wrapXformInc = {};
        _wrapXformLabel = {};
        _wrapSaveInc();
        _wrapSaveLabels();
        _wrapLastText = _wrapBuildTransformedText();
        _wrapClosePopover();
        var np = _wrapBuildPopover();
        document.body.appendChild(np);
        _wrapToolbar._pop = np;
        _wrapPositionUI();
        _wrapUpdateToolbarState();
      });
      contentRow.appendChild(reset);
    }
    var fieldsWrap = document.createElement('div');
    fieldsWrap.className = 'crm-wrap-fields';
    if (!fields.length) {
      var empty = document.createElement('p');
      empty.className = 'crm-wrap-pop__empty';
      empty.textContent = _wrapT('noFields');
      fieldsWrap.appendChild(empty);
    } else {
      fields.forEach(function (f, idx) {
        var row = document.createElement('div');
        var on = _wrapIncluded(f.id);
        row.className = 'crm-wrap-field' + (on ? '' : ' is-off');
        var head = document.createElement('div');
        head.className = 'crm-wrap-field__head';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'crm-wrap-field__cb';
        cb.checked = on;
        var title = document.createElement('input');
        title.type = 'text';
        title.className = 'crm-wrap-field__title';
        title.value = _wrapLabelOf(f.id, f.label);
        title.placeholder = _wrapT('titleHint');
        head.appendChild(cb);
        head.appendChild(title);
        var val = document.createElement('textarea');
        val.className = 'crm-wrap-field__val';
        val.rows = 2;
        val.value = (_wrapXformVal[f.id] != null) ? _wrapXformVal[f.id] : f.value;
        val.disabled = !on;
        cb.addEventListener('change', function () {
          _wrapSetIncluded(f.id, cb.checked);
          row.classList.toggle('is-off', !cb.checked);
          val.disabled = !cb.checked;
          _wrapLastText = _wrapBuildTransformedText();
        });
        title.addEventListener('input', function () {
          _wrapSetLabel(f.id, title.value);
          _wrapLastText = _wrapBuildTransformedText();
        });
        val.addEventListener('input', function () {
          _wrapXformVal[f.id] = val.value;
          _wrapLastText = _wrapBuildTransformedText();
        });
        row.appendChild(head);
        row.appendChild(val);
        fieldsWrap.appendChild(row);
      });
    }

    var glowLabel = document.createElement('p');
    glowLabel.className = 'crm-wrap-pop__label';
    glowLabel.textContent = _wrapT('glowColor');
    var swatches = document.createElement('div');
    swatches.className = 'crm-wrap-swatches';
    _WRAP_GLOW_COLORS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'crm-wrap-swatch' + (c === _wrapGlowColor ? ' is-active' : '');
      b.setAttribute('data-color', c);
      b.style.background = c;
      b.title = c;
      b.addEventListener('click', function () {
        _wrapApplyGlowColor(c);
        _wrapPost({ type: 'SET_GLOW_COLOR', color: c });
      });
      swatches.appendChild(b);
    });

    var hint = document.createElement('p');
    hint.className = 'crm-wrap-pop__hint';
    hint.textContent = _wrapT('hint');

    pop.appendChild(targetLabel);
    pop.appendChild(pick);
    pop.appendChild(modeLabel);
    pop.appendChild(seg);
    pop.appendChild(contentRow);
    pop.appendChild(fieldsWrap);
    pop.appendChild(glowLabel);
    pop.appendChild(swatches);
    pop.appendChild(hint);
    return pop;
  }

  function _wrapApplyCollapsed(bar) {
    if (!bar) return;
    var collapsed = _wrapLoadCollapsed();
    bar.classList.toggle('is-collapsed', collapsed);
    var t = bar.querySelector('.crm-wrap-toggle');
    if (t) {
      // Chevron points the way it moves: » folds into the frame corner, « unfolds.
      t.innerHTML = collapsed ? _WRAP_ICON_COLLAPSE : _WRAP_ICON_EXPAND;
      t.title = collapsed ? _wrapT('expand') : _wrapT('collapse');
      if (collapsed) { t.style.setProperty('background', _wrapGlowColor, 'important'); t.style.setProperty('color', '#fff', 'important'); }
      else { t.style.removeProperty('background'); t.style.removeProperty('color'); }
    }
    // Tie the toolbar to the glow frame it belongs to.
    try { bar.style.setProperty('border-color', _wrapGlowColor); } catch (e) { /* ignore */ }
  }

  function _wrapShowUI(field) {
    _wrapHideUI();
    _wrapField = field;
    try {
      var _dbgEd = findDeep(field, 'textarea, md-textarea, [contenteditable=""], [contenteditable="true"], md-input, input');
      console.log('[panel-layout] wrap-transfer: source anchor <' + (field.tagName || '').toLowerCase() + '> ' +
        (field.className && field.className.toString ? field.className.toString().split(/\s+/)[0] : '') +
        ' | editable:', _dbgEd ? ((_dbgEd.tagName || '').toLowerCase() + ' name=' + (_dbgEd.getAttribute && _dbgEd.getAttribute('name'))) : 'none');
    } catch (e) { /* ignore */ }
    _wrapEnsureDocStyle();
    var root = field.getRootNode ? field.getRootNode() : document;
    _wrapInjectGlowInto(root && root.nodeType === 11 ? root : document);
    field.classList.add('crm-wrap-source-glow');
    try { field.style.setProperty('--crm-wrap-glow', _wrapGlowColor); } catch (e) { /* ignore */ }

    _wrapLastText = _wrapBuildTransformedText();
    field._wrapInputHandler = function () { _wrapLastText = _wrapBuildTransformedText(); };
    field.addEventListener('input', field._wrapInputHandler);

    var bar = document.createElement('div');
    bar.className = 'crm-wrap-toolbar' + (_darkMode ? ' md--dark' : '');
    // Bubble-phase guard: a click on the toolbar must not reach the host
    // desktop's outside-click detector that dismisses the wrap-up dialog.
    bar.addEventListener('click', function (e) { e.stopPropagation(); });

    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'crm-wrap-btn crm-wrap-toggle';
    toggleBtn.addEventListener('click', function () {
      _wrapSetCollapsedState(!_wrapLoadCollapsed());
      if (_wrapLoadCollapsed()) _wrapClosePopover();
      _wrapApplyCollapsed(bar);
      _wrapPositionUI();
    });

    var settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'crm-wrap-btn';
    settingsBtn.innerHTML = _WRAP_ICON_GEAR + '<span></span>';
    settingsBtn.querySelector('span').textContent = _wrapT('settings');
    settingsBtn.addEventListener('click', function () {
      if (bar._pop) { _wrapClosePopover(); return; }
      var pop = _wrapBuildPopover();
      document.body.appendChild(pop);
      bar._pop = pop;
      _wrapPositionUI();
      _wrapUpdateToolbarState();
    });

    var transferBtn = document.createElement('button');
    transferBtn.type = 'button';
    transferBtn.className = 'crm-wrap-btn crm-wrap-btn--primary';
    transferBtn.setAttribute('disabled', 'disabled');
    transferBtn.innerHTML = _WRAP_ICON_ARROW + '<span></span>';
    transferBtn.querySelector('span').textContent = _wrapT('transfer');
    transferBtn.addEventListener('click', function () {
      if (transferBtn.hasAttribute('disabled')) return;
      var text = _wrapBuildTransformedText();
      if (!text) return;
      _wrapPost({ type: 'WRITE_WRAPUP_TEXT', text: text });
    });

    bar.appendChild(settingsBtn);
    bar.appendChild(transferBtn);
    bar._transferBtn = transferBtn;
    bar._pop = null;
    bar.appendChild(toggleBtn);
    _wrapApplyCollapsed(bar);
    document.body.appendChild(bar);
    _wrapToolbar = bar;

    _wrapPositionUI();
    window.addEventListener('scroll', _wrapPositionUI, true);
    window.addEventListener('resize', _wrapPositionUI, true);
    _WRAP_GUARD_EVENTS.forEach(function (t) { window.addEventListener(t, _wrapSwallowGuard, true); });
    _wrapReposTimer = setInterval(_wrapPositionUI, 500);
    _wrapUpdateToolbarState();
    console.log('[panel-layout] wrap-transfer: UI shown over wrap-up field');
  }

  function _wrapHideUI() {
    _wrapClosePopover();
    if (_wrapReposTimer) { clearInterval(_wrapReposTimer); _wrapReposTimer = null; }
    window.removeEventListener('scroll', _wrapPositionUI, true);
    window.removeEventListener('resize', _wrapPositionUI, true);
    _WRAP_GUARD_EVENTS.forEach(function (t) { window.removeEventListener(t, _wrapSwallowGuard, true); });
    if (_wrapField) {
      _wrapField.classList.remove('crm-wrap-source-glow');
      if (_wrapField._wrapInputHandler) {
        _wrapField.removeEventListener('input', _wrapField._wrapInputHandler);
        _wrapField._wrapInputHandler = null;
      }
    }
    if (_wrapToolbar && _wrapToolbar.parentNode) _wrapToolbar.parentNode.removeChild(_wrapToolbar);
    _wrapToolbar = null;
    _wrapField = null;
  }

  // The native wrap-up dialog only renders after the agent clicks the wrap-up
  // button (#wrapup-button-id) — it is NOT in the DOM when eAgentWrapup fires.
  // So we watch for the field to appear/disappear for the whole wrap-up state.
  var _wrapWatchTimer = null;

  function _wrapStartWatch() {
    if (_wrapWatchTimer) return;
    _wrapCheckField();
    _wrapWatchTimer = setInterval(_wrapCheckField, 500);
  }

  function _wrapStopWatch() {
    if (_wrapWatchTimer) { clearInterval(_wrapWatchTimer); _wrapWatchTimer = null; }
  }

  function _wrapCheckField() {
    if (_wrapInteractionId === null) { _wrapStopWatch(); return; }
    // Re-poll CRM-open status roughly every 3s so Transfer enables if the agent
    // opens the CRM after entering wrap-up.
    if ((_wrapTick++ % 6) === 0) { _wrapRefreshStatus(); _wrapQueryCrmPresence(); }
    var field = _wrapFindField();
    if (field && _wrapVisible(field)) {
      if (_wrapField !== field || !_wrapToolbar) {
        _wrapShowUI(field);
      }
      _wrapSetHighlight(true);
      // Continuously capture the transformed text so auto-transfer works even if
      // the popover has closed by the time the wrap-up submit event fires.
      var t = _wrapBuildTransformedText();
      if (t) _wrapLastText = t;
    } else {
      if (_wrapToolbar) _wrapHideUI();
      _wrapSetHighlight(false);
      if ((_wrapTick % 10) === 1) {
        console.log('[panel-layout] wrap-transfer: field NOT found yet — open the wrap-up dialog (click the wrap-up button) so the summary renders');
      }
    }
  }

  function _wrapOnEnter(interactionId) {
    if (!interactionId) return;
    _wrapInteractionId = interactionId;
    _wrapLastText = '';
    _wrapTick = 0;
    _wrapHighlightOn = false;
    // New wrap-up: drop any stale summary; the widget regenerates + rebroadcasts.
    _wrapPendingSummary = null;
    _wrapSummaryApplied = false;
    _wrapSummaryTries = 0;
    _wrapSummaryStopWatch();
    _wrapHideSummarySpinner();
    // Show the glow/toolbar as soon as the wrap-up field appears; CRM-open only
    // gates the Transfer button (queried async from the extension + crm-sync).
    _wrapRefreshStatus();
    _wrapQueryCrmPresence();
    _wrapStartWatch();
  }

  function _wrapOnSubmit() {
    if (_wrapCrmOpen() && _wrapCfg.targetConfigured && _wrapCfg.mode === 'auto') {
      var text = _wrapLastText || _wrapBuildSdkText(_wrapSdkData);
      if (text) {
        _wrapPost({ type: 'WRITE_WRAPUP_TEXT', text: text });
        console.log('[panel-layout] wrap-transfer: auto-transferred on submit (SDK)');
      }
    }
    _wrapSetHighlight(false);
    _wrapStopWatch();
    _wrapHideUI();
    _wrapInteractionId = null;
    _wrapSdkData = null;
    _wrapPendingSummary = null;
    _wrapSummaryStopWatch();
    _wrapHideSummarySpinner();
  }

  function _initWrapTransfer() {
    _wrapInitBridge();
    var svc;
    try { svc = (typeof AGENTX_SERVICE !== 'undefined') ? AGENTX_SERVICE : null; } catch (e) { svc = null; }
    svc = svc || window.AGENTX_SERVICE || null;
    var aqmContact = svc && svc.aqm && svc.aqm.contact;
    if (!svc || !svc.isInited || !aqmContact ||
        !aqmContact.eAgentWrapup || typeof aqmContact.eAgentWrapup.listen !== 'function') {
      setTimeout(_initWrapTransfer, 2000);
      return;
    }
    aqmContact.eAgentWrapup.listen(function (msg) {
      try {
        if (msg && msg.data) _wrapSdkData = msg.data;
        _wrapOnEnter(msg && msg.data && msg.data.interactionId);
      } catch (e) { /* ignore */ }
    });
    if (aqmContact.eAgentContactWrappedUp && typeof aqmContact.eAgentContactWrappedUp.listen === 'function') {
      aqmContact.eAgentContactWrappedUp.listen(function (msg) {
        try {
          if (msg && msg.data) { _wrapSdkData = msg.data; console.log('[panel-layout] wrap-transfer: wrapup SDK data', msg.data); }
          _wrapOnSubmit();
        } catch (e) { /* ignore */ }
      });
    }
    if (aqmContact.eAgentContactEnded && typeof aqmContact.eAgentContactEnded.listen === 'function') {
      aqmContact.eAgentContactEnded.listen(function () {
        try { _wrapSetHighlight(false); _wrapStopWatch(); _wrapHideUI(); _wrapInteractionId = null; } catch (e) { /* ignore */ }
      });
    }
    console.log('[panel-layout] wrap-transfer: SDK listeners registered');
  }

  // Console diagnostic: run __wrapDiag() in the Desktop console during wrap-up to
  // see the wrap-transfer state (field found, toolbar, CRM-open sources).
  try {
    window.__wrapDiag = function () {
      var field = null;
      try { field = _wrapFindField(); } catch (e) { /* ignore */ }
      var rect = null;
      if (field) { try { var r = field.getBoundingClientRect(); rect = { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; } catch (e) { /* ignore */ } }
      var info = {
        interactionId: _wrapInteractionId,
        watching: !!_wrapWatchTimer,
        fieldFound: field ? ((field.tagName || '').toLowerCase() + '.' + (field.className && field.className.toString ? field.className.toString().split(/\s+/)[0] : '')) : null,
        fieldRect: rect,
        toolbarShown: !!_wrapToolbar,
        crmOpen: _wrapCrmOpen(),
        extCrmOpen: _wrapCfg.crmOpen,
        bcCrmOpen: _wrapBcCrmOpen,
        targetConfigured: _wrapCfg.targetConfigured,
        mode: _wrapCfg.mode,
        lastText: (_wrapLastText || '').slice(0, 160),
      };
      console.log('[panel-layout] __wrapDiag', info);
      return info;
    };
  } catch (e) { /* ignore */ }

  _initWrapTransfer();

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
        this._offerVariables = null;
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
        // Update theme class on any live offer panels so Momentum CSS variables re-scope
        var themeClass = _darkMode ? 'md-theme--dark' : 'md-theme--light';
        var ids = Object.keys(_offerPanelMap);
        for (var i = 0; i < ids.length; i++) {
          _offerPanelMap[ids[i]].className = themeClass;
        }
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

      set offerVariables(value) {
        this._offerVariables = value;
        _offerVariables = _parseOfferVariablesProp(value);
        console.log('[panel-layout] offerVariables set:', value, '→', _offerVariables);
      }
      get offerVariables() { return this._offerVariables; }

      set wrapupfieldselector(value) {
        _wrapFieldSelector = value && String(value).trim() ? String(value).trim() : null;
        console.log('[panel-layout] wrapupfieldselector set:', _wrapFieldSelector);
      }
      get wrapupfieldselector() { return _wrapFieldSelector; }
    });
  }


})();


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

  function _doApplyEmailGrid(rv, wrapperEl, dynWidgetEl) {
    // Run diagnostic first so the log shows the grid state before we touch anything
    _diagDumpGrid();

    // wrapperGC = DIV#common-control (grid-area: common-control, col3/row3)
    var wrapperGC = findGridChild(wrapperEl, rv) || wrapperEl;

    // panels-scroll-container is display:contents so its children ARE the grid items.
    // #panel-two is the actual grid child for the main content — not uuip-dynamic-widget.
    var psc = (rv.shadowRoot || rv).querySelector('.panels-scroll-container');
    var panelTwo = psc ? psc.querySelector('#panel-two') : null;
    if (!panelTwo) {
      console.warn('[panel-layout] #panel-two not found — falling back to dynWidgetEl');
      panelTwo = dynWidgetEl;
    }

    function label(el) {
      return el.tagName + (el.id ? '#'+el.id : '') +
             (el.className ? '.'+String(el.className).trim().split(/\s+/)[0] : '');
    }
    console.log('[panel-layout] email grid | wrapperGC:', label(wrapperGC),
                '| panelTwo:', label(panelTwo));

    // ── Read current computed grid rows to restore precisely ──
    var cs = window.getComputedStyle(rv);
    var origRows = cs.gridTemplateRows;

    var rowParts = origRows.split(/\s+/);
    var newRows = rowParts.slice();
    if (newRows.length >= 4) {
      newRows[2] = 'auto';  // row3: shrink to interaction wrapper content
      newRows[3] = '1fr';   // row4: fill remaining height
    }
    var emailRows = newRows.join(' ');
    console.log('[panel-layout] email grid | origRows:', origRows, '| emailRows:', emailRows);

    _emailGridState = {
      wrapperGC:     wrapperGC,
      panelTwo:      panelTwo,
      wrapperCol:    wrapperGC.style.gridColumn,
      wrapperRow:    wrapperGC.style.gridRow,
      wrapperAlign:  wrapperGC.style.alignSelf,
      wrapperH:      wrapperGC.style.height,
      panelTwoCol:   panelTwo.style.gridColumn,
      panelTwoRow:   panelTwo.style.gridRow,
      panelTwoAlign: panelTwo.style.alignSelf,
      panelTwoH:     panelTwo.style.height,
      panelTwoML:    panelTwo.style.marginLeft,
      rvRowsOrig:    rv.style.gridTemplateRows
    };

    // Place wrapperGC (#common-control): col4/row3, auto height
    wrapperGC.style.setProperty('grid-column', '4',     'important');
    wrapperGC.style.setProperty('grid-row',    '3',     'important');
    wrapperGC.style.setProperty('align-self',  'start', 'important');
    wrapperGC.style.setProperty('height',      'auto',  'important');

    // Place panelTwo (#panel-two): col4/row4, fills remaining height
    // margin-left matches the visual left indent of #common-control's internal padding
    panelTwo.style.setProperty('grid-column',  '4',       'important');
    panelTwo.style.setProperty('grid-row',     '4',       'important');
    panelTwo.style.setProperty('align-self',   'stretch', 'important');
    panelTwo.style.setProperty('height',       '100%',    'important');
    panelTwo.style.setProperty('margin-left',  '16px',    'important');

    // Collapse col3 (hides #panel-one automatically), update rows
    _observerPaused = true;
    rv.style.setProperty('grid-template-columns', EMAIL_COLUMNS, 'important');
    rv.style.setProperty('grid-template-rows',    emailRows,     'important');

    emailLayoutActive = true;
    console.log('[panel-layout] email CSS-grid layout applied ✅');
    // Post-apply diagnostic to verify what actually changed
    setTimeout(function () {
      console.log('[panel-layout][diag] POST-APPLY STATE:');
      _diagDumpGrid();
    }, 200);
  }

  function applyEmailGridLayout() {
    var retries = 0;
    function attempt() {
      var rv        = findRouterView();
      var wrapperEl = findWrapper();
      var dynWidget = findDeep(document.body, 'uuip-dynamic-widget');
      console.log('[panel-layout] email grid attempt', retries,
                  '| rv:', !!rv, '| wrapper:', !!wrapperEl, '| dynWidget:', !!dynWidget);
      if (rv && wrapperEl && dynWidget) {
        _doApplyEmailGrid(rv, wrapperEl, dynWidget);
        return;
      }
      retries++;
      if (retries >= 15) {
        console.warn('[panel-layout] email grid layout: elements not found after', retries, 'retries | rv:', !!rv, '| wrapper:', !!wrapperEl, '| dynWidget:', !!dynWidget);
        return;
      }
      setTimeout(attempt, 400);
    }
    attempt();
  }

  function clearEmailGridLayout() {
    if (!_emailGridState) return;
    var s = _emailGridState;

    if (s.roWrapper)  { s.roWrapper.disconnect(); }
    if (s.roTaskList) { s.roTaskList.disconnect(); }

    function restoreProp(el, prop, val) {
      val ? el.style.setProperty(prop, val) : el.style.removeProperty(prop);
    }
    restoreProp(s.wrapperGC,  'grid-column', s.wrapperCol);
    restoreProp(s.wrapperGC,  'grid-row',    s.wrapperRow);
    restoreProp(s.wrapperGC,  'align-self',  s.wrapperAlign);
    restoreProp(s.wrapperGC,  'height',      s.wrapperH);
    if (s.panelTwo) {
      restoreProp(s.panelTwo, 'grid-column', s.panelTwoCol);
      restoreProp(s.panelTwo, 'grid-row',    s.panelTwoRow);
      restoreProp(s.panelTwo, 'align-self',  s.panelTwoAlign);
      restoreProp(s.panelTwo, 'height',      s.panelTwoH);
      restoreProp(s.panelTwo, 'margin-left', s.panelTwoML);
    }

    var rv = findRouterView();
    if (rv) {
      restoreProp(rv, 'grid-template-rows', s.rvRowsOrig);
    }
    _emailGridState = null;

    // Restore grid columns and re-enable the style observer
    if (rv) rv.style.setProperty('grid-template-columns', COLUMNS, 'important');
    _observerPaused = false;

    console.log('[panel-layout] email CSS-grid layout cleared');
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

  // ─────────────────────────────────────────────────────────────────────────

  var _lastMediaType = null;

  function handleTaskUpdate(rawTask) {
    if (!rawTask) {
      if (_lastMediaType === null) return;  // already cleared
      _lastMediaType = null;
      applyTaskIndicator('');
      clearEmailLayout();
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
    if (mediaType === _lastMediaType) return;  // nothing changed
    _lastMediaType = mediaType;

    if (!mediaType) {
      console.log('[panel-layout] could not detect task mediaType — full task object:', parsed);
    } else {
      console.log('[panel-layout] task mediaType detected:', mediaType);
    }

    applyTaskIndicator(mediaType);
    if (mediaType === 'email') {
      applyEmailLayout();
    } else {
      clearEmailLayout();
    }
  }

  // ─── Custom element registration ─────────────────────────────────────────

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
    });
  }
})();


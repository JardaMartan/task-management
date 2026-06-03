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

  var COLUMNS = 'var(--nav-bar-width) auto minmax(auto, 0.6fr) 1.5fr auto';
  var styleObserver = null;
  var pollInterval = null;

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

  // Register a no-op custom element so the Desktop runtime is satisfied
  if (!customElements.get('panel-layout-headless')) {
    customElements.define('panel-layout-headless', class extends HTMLElement {});
  }
})();


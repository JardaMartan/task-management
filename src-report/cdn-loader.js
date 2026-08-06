/**
 * agent-activity CDN loader.
 *
 * Loads the React/Redux UMD dependencies from a public CDN as browser globals,
 * then loads the widget bundle (agent-activity-cdn.js) which expects them.
 * When several widgets share the SAME CDN URLs the browser downloads each library
 * once; a loader that finds a global already present skips it.
 *
 * Plain ES5, served raw (not bundled) so it can run before anything else.
 */
(function () {
  'use strict';

  var CDN = 'https://cdn.jsdelivr.net/npm/';

  // [globalName, path] in load order. react-dom needs React; react-redux needs
  // React + ReactDOM; @reduxjs/toolkit is self-contained. Versions must match
  // package.json so every widget references the identical URL (shared cache).
  var DEPS = [
    ['React', 'react@18.2.0/umd/react.production.min.js'],
    ['ReactDOM', 'react-dom@18.2.0/umd/react-dom.production.min.js'],
    ['ReactRedux', 'react-redux@8.1.2/dist/react-redux.min.js'],
    ['RTK', '@reduxjs/toolkit@1.9.5/dist/redux-toolkit.umd.min.js']
  ];

  var me = document.currentScript;
  var base = (me && me.src) ? me.src.replace(/[^/]*$/, '') : '';
  var WIDGET_URL = base + 'agent-activity-cdn.js';

  function loadScript(url, cb) {
    var s = document.createElement('script');
    s.src = url;
    // No crossOrigin: scripts execute cross-origin without it, and setting it
    // would require a CORS header on the relay-served widget bundle (it has none).
    s.onload = function () { cb(); };
    s.onerror = function () { console.error('[agent-activity loader] failed to load', url); cb(); };
    (document.head || document.documentElement).appendChild(s);
  }

  function loadDeps(i, done) {
    if (i >= DEPS.length) { done(); return; }
    if (window[DEPS[i][0]]) { loadDeps(i + 1, done); return; } // already provided by another widget
    loadScript(CDN + DEPS[i][1], function () { loadDeps(i + 1, done); });
  }

  function haveAll() {
    for (var i = 0; i < DEPS.length; i++) { if (!window[DEPS[i][0]]) return false; }
    return true;
  }

  function boot() { loadScript(WIDGET_URL, function () {}); }

  if (haveAll()) boot();
  else loadDeps(0, boot);
})();

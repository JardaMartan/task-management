// Global AgentX desktop environment shims for local/standalone builds
// Some parts of @wxcc-desktop/sdk expect a bare global identifier AGENTX_SERVICE
// (not accessed via window/globalThis). The browser throws ReferenceError if that
// identifier is not declared. We declare it and attach minimal shape.
/* eslint-disable no-undef */
(function initAgentXGlobals() {
  try {
    // Check via globalThis to avoid the var-hoisting trap: a bare `var AGENTX_SERVICE`
    // inside the IIFE would be hoisted as a local `undefined`, making `typeof` return
    // 'undefined' even when the Desktop runtime has already defined the real global.
    if (!globalThis.AGENTX_SERVICE) {
      const mock = {
        name: 'MockAgentX',
        version: '0.0.0-local',
        getEnvironment: function () { return 'local'; },
        getTenantInfo: function () { return { orgId: 'demo-org', region: 'us' }; }
      };
      try {
        globalThis.AGENTX_SERVICE = mock;
      } catch (_e) {
        // Property is non-writable (real Desktop already owns it) — that's fine.
      }
      if (!globalThis.CiscoDesktop) {
        globalThis.CiscoDesktop = { getEnvironment: mock.getEnvironment };
      }
      if (!globalThis.WebexDesktop) {
        globalThis.WebexDesktop = { getEnvironment: mock.getEnvironment };
      }
    }
  } catch (err) {
    // Swallow errors; we only care about avoiding ReferenceError.
    console.error('[agentx-globals] Failed to initialize global AgentX shims', err);
  }
})();
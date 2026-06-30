// Global AgentX desktop environment shims for local/standalone builds.
// Some parts of @wxcc-desktop/sdk expect a bare global identifier AGENTX_SERVICE
// (not accessed via window/globalThis). The browser throws ReferenceError if that
// identifier is not declared. We declare it and attach a minimal shape.
/* eslint-disable no-undef */
(function initAgentXGlobals() {
  try {
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
    console.error('[agentx-globals] Failed to initialize global AgentX shims', err);
  }
})();

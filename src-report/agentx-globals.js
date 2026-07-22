// Global AgentX desktop environment shims for local/standalone builds.
// The @wxcc-desktop/sdk expects a bare global identifier AGENTX_SERVICE; the
// browser throws ReferenceError if it is not declared. Declare a minimal shape.
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
      } catch (_e) { /* real Desktop owns it — fine */ }
      if (!globalThis.CiscoDesktop) globalThis.CiscoDesktop = { getEnvironment: mock.getEnvironment };
      if (!globalThis.WebexDesktop) globalThis.WebexDesktop = { getEnvironment: mock.getEnvironment };
    }
  } catch (err) {
    console.error('[agentx-globals] Failed to initialize global AgentX shims', err);
  }
})();

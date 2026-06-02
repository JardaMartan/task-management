// Global AgentX desktop environment shims for local/standalone builds
// Some parts of @wxcc-desktop/sdk expect a bare global identifier AGENTX_SERVICE
// (not accessed via window/globalThis). The browser throws ReferenceError if that
// identifier is not declared. We declare it and attach minimal shape.
/* eslint-disable no-undef */
(function initAgentXGlobals() {
  try {
    // Declare a var so the bare identifier exists in the global scope.
    if (typeof AGENTX_SERVICE === 'undefined') {
      // Use var (not let/const) so it becomes a property of global object in non-module context.
      // eslint-disable-next-line no-var
      var AGENTX_SERVICE = {
        name: 'MockAgentX',
        version: '0.0.0-local',
        getEnvironment: function () { return 'local'; },
        getTenantInfo: function () { return { orgId: 'demo-org', region: 'us' }; }
      };
      // Also mirror to globalThis for defensive access patterns.
      globalThis.AGENTX_SERVICE = AGENTX_SERVICE;
      // Optional other desktop globals sometimes probed by SDKs.
      if (typeof globalThis.CiscoDesktop === 'undefined') {
        globalThis.CiscoDesktop = { getEnvironment: AGENTX_SERVICE.getEnvironment };
      }
      if (typeof globalThis.WebexDesktop === 'undefined') {
        globalThis.WebexDesktop = { getEnvironment: AGENTX_SERVICE.getEnvironment };
      }
      // console.info('[agentx-globals] Mock AGENTX_SERVICE defined');
    }
  } catch (err) {
    // Swallow errors; we only care about avoiding ReferenceError.
    console.error('[agentx-globals] Failed to initialize global AgentX shims', err);
  }
})();
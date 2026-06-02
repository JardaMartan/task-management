// Minimal stub for @wxcc-desktop/sdk so tests don't crash on import
const Desktop = {
  config: {
    init: jest.fn().mockRejectedValue(new Error('SDK not available in test')),
  },
  agentStateInfo: null,
};

module.exports = { Desktop };

'use strict';

const DEFAULTS = {
  enabled: true,
  desktopUrlPattern: 'desktop.wxcc-us1.cisco.com',
  allowlist: [],
  channels: { call: true, sms: true, email: true },
};

const $ = (id) => document.getElementById(id);

function render(cfg, activeUrl) {
  const on = !!cfg.enabled;
  $('dot').className = 'dot ' + (on ? 'dot--on' : 'dot--off');
  $('state').textContent = on ? 'Enabled' : 'Disabled';

  let role = 'idle';
  if (activeUrl) {
    if (cfg.desktopUrlPattern && activeUrl.indexOf(cfg.desktopUrlPattern) !== -1) role = 'Desktop bridge';
    else role = 'CRM scanner';
  }
  $('page').textContent = 'This tab: ' + role;
}

function getCfg() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('crmC2C', (res) => {
      resolve(Object.assign({}, DEFAULTS, (res && res.crmC2C) || {}));
    });
  });
}

async function init() {
  const cfg = await getCfg();
  let activeUrl = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeUrl = (tab && tab.url) || '';
  } catch (e) { /* ignore */ }
  render(cfg, activeUrl);

  $('toggle').addEventListener('click', async () => {
    const c = await getCfg();
    c.enabled = !c.enabled;
    chrome.storage.sync.set({ crmC2C: c }, () => render(c, activeUrl));
  });

  $('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
}

document.addEventListener('DOMContentLoaded', init);

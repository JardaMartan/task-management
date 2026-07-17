'use strict';

const DEFAULTS = {
  enabled: true,
  desktopUrlPattern: 'desktop.wxcc-us1.cisco.com',
  allowlist: [],
  channels: { call: true, sms: true, email: true },
};

const $ = (id) => document.getElementById(id);

function load() {
  chrome.storage.sync.get('crmC2C', (res) => {
    const cfg = Object.assign({}, DEFAULTS, (res && res.crmC2C) || {});
    cfg.channels = Object.assign({}, DEFAULTS.channels, cfg.channels || {});
    $('enabled').checked = !!cfg.enabled;
    $('desktopUrlPattern').value = cfg.desktopUrlPattern || '';
    $('allowlist').value = (cfg.allowlist || []).join(', ');
    $('ch-call').checked = !!cfg.channels.call;
    $('ch-sms').checked = !!cfg.channels.sms;
    $('ch-email').checked = !!cfg.channels.email;
  });
}

function save() {
  const allowlist = $('allowlist').value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const cfg = {
    enabled: $('enabled').checked,
    desktopUrlPattern: $('desktopUrlPattern').value.trim() || DEFAULTS.desktopUrlPattern,
    allowlist,
    channels: {
      call: $('ch-call').checked,
      sms: $('ch-sms').checked,
      email: $('ch-email').checked,
    },
  };

  chrome.storage.sync.set({ crmC2C: cfg }, () => {
    const el = $('saved');
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1500);
  });
}

document.addEventListener('DOMContentLoaded', load);
$('save').addEventListener('click', save);

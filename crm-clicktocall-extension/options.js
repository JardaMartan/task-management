'use strict';

const DEFAULTS = {
  enabled: true,
  desktopUrlPattern: 'desktop.wxcc-us1.cisco.com',
  crmManagerUrlPattern: 'crm-tab-manager',
  allowlist: [],
  channels: { call: true, sms: true, email: true },
};

const $ = (id) => document.getElementById(id);

function renderWrap() {
  chrome.storage.sync.get('crmWrapTransfer', (res) => {
    const w = (res && res.crmWrapTransfer) || { mode: 'manual', target: null };
    const tgt = w.target && w.target.selector
      ? `${w.target.selector} (${w.target.origin || '?'})`
      : 'none selected';
    $('wrap-target').innerHTML = 'Target field: <em>' + tgt.replace(/</g, '&lt;') + '</em>';
    $('wrap-mode').textContent = 'Mode: ' + (w.mode || 'manual');
  });
}

function load() {
  chrome.storage.sync.get('crmC2C', (res) => {
    const cfg = Object.assign({}, DEFAULTS, (res && res.crmC2C) || {});
    cfg.channels = Object.assign({}, DEFAULTS.channels, cfg.channels || {});
    $('enabled').checked = !!cfg.enabled;
    $('desktopUrlPattern').value = cfg.desktopUrlPattern || '';
    $('crmManagerUrlPattern').value = cfg.crmManagerUrlPattern || '';
    $('allowlist').value = (cfg.allowlist || []).join(', ');
    $('ch-call').checked = !!cfg.channels.call;
    $('ch-sms').checked = !!cfg.channels.sms;
    $('ch-email').checked = !!cfg.channels.email;
  });
  renderWrap();
}

function save() {
  const allowlist = $('allowlist').value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const cfg = {
    enabled: $('enabled').checked,
    desktopUrlPattern: $('desktopUrlPattern').value.trim() || DEFAULTS.desktopUrlPattern,
    crmManagerUrlPattern: $('crmManagerUrlPattern').value.trim() || DEFAULTS.crmManagerUrlPattern,
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

function clearWrapTarget() {
  chrome.storage.sync.get('crmWrapTransfer', (res) => {
    const w = (res && res.crmWrapTransfer) || { mode: 'manual', target: null };
    w.target = null;
    chrome.storage.sync.set({ crmWrapTransfer: w }, renderWrap);
  });
}

document.addEventListener('DOMContentLoaded', load);
$('save').addEventListener('click', save);
$('wrap-clear').addEventListener('click', clearWrapTarget);

/*
 * background.js — MV3 service worker.
 *
 * Routes INITIATE_CONTACT messages from a CRM tab's content script to the
 * Webex CC Desktop tab's content script (which re-emits them into the widget).
 *
 * The Desktop tab is located by matching the stored `desktopUrlPattern` against
 * open tab URLs. If several Desktop tabs are open the message is sent to all of
 * them (the widget bridge de-dupes / only the active one acts on it).
 */
'use strict';

const DEFAULTS = {
  enabled: true,
  desktopUrlPattern: 'desktop.wxcc',
  allowlist: [],
  channels: { call: true, sms: true, email: true },
};

function getConfig() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get('crmC2C', (res) => {
        const stored = (res && res.crmC2C) || {};
        resolve(Object.assign({}, DEFAULTS, stored));
      });
    } catch (e) {
      resolve(DEFAULTS);
    }
  });
}

function patternToTabQuery(pattern) {
  // chrome.tabs.query url globs need a scheme + at least one path segment.
  if (!pattern || pattern === '*') return ['*://*/*'];
  if (pattern.indexOf('://') !== -1) return [pattern.endsWith('*') ? pattern : pattern + '*'];
  // Bare host or substring → wrap as host glob.
  return [`*://*${pattern}*/*`, `*://${pattern}/*`];
}

async function findDesktopTabs(pattern) {
  const queries = patternToTabQuery(pattern);
  const seen = new Set();
  const tabs = [];
  for (const q of queries) {
    try {
      const found = await chrome.tabs.query({ url: q });
      for (const t of found) {
        if (!seen.has(t.id)) { seen.add(t.id); tabs.push(t); }
      }
    } catch (e) { /* invalid glob — ignore */ }
  }
  // Fallback: substring filter across all tabs (covers odd URL shapes).
  if (tabs.length === 0 && pattern && pattern !== '*') {
    try {
      const all = await chrome.tabs.query({});
      for (const t of all) {
        if (t.url && t.url.indexOf(pattern) !== -1 && !seen.has(t.id)) {
          seen.add(t.id); tabs.push(t);
        }
      }
    } catch (e) { /* ignore */ }
  }
  return tabs;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'INITIATE_CONTACT') return;

  (async () => {
    const cfg = await getConfig();
    if (!cfg.enabled) { sendResponse({ ok: false, reason: 'disabled' }); return; }

    // Stable id so the widget can de-dupe the direct + forwarded delivery paths.
    const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

    let tabs = await findDesktopTabs(cfg.desktopUrlPattern);
    let mode = 'pattern';
    if (tabs.length === 0) {
      // Pattern matched no tab — fall back to broadcasting to every tab. Frames
      // without the bridge listener simply reject; only the widget frame acts.
      console.warn('[crm-c2c/bg] no tab matched desktopUrlPattern', JSON.stringify(cfg.desktopUrlPattern), '— broadcasting to all tabs');
      try { tabs = await chrome.tabs.query({}); } catch (e) { tabs = []; }
      mode = 'broadcast';
    }

    let delivered = 0;
    for (const t of tabs) {
      try {
        await chrome.tabs.sendMessage(t.id, {
          type: 'INITIATE_CONTACT',
          channel: msg.channel,
          destination: msg.destination,
          id,
        });
        delivered++;
      } catch (e) {
        // The bridge content script may not be injected in that tab/frame.
      }
    }
    console.log('[crm-c2c/bg]', mode, 'routed', msg.channel, msg.destination, '→', delivered, 'tab(s)');
    sendResponse({ ok: delivered > 0, delivered, mode });
  })();

  return true; // async sendResponse
});

// Seed default config on install so the options page has something to show.
chrome.runtime.onInstalled.addListener(async () => {
  const cfg = await getConfig();
  try { chrome.storage.sync.set({ crmC2C: cfg }); } catch (e) { /* ignore */ }
});

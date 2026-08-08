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
  crmManagerUrlPattern: 'crm-tab-manager',
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

/* ── Wrap-up → CRM field transfer ─────────────────────────────────────────
 *
 * Routes the wrap-up transfer messages between the headless widget (via the
 * Desktop content-script forwarder) and the CRM frames inside the Tab Manager
 * window. The chosen target field + mode live in chrome.storage.sync so a single
 * per-browser-profile selection is remembered across sessions.
 */

const WRAP_KEY = 'crmWrapTransfer';

// The tab hosting the wrap-up widget (Webex CC Desktop). Learned from WRAP_REQ so
// we don't depend on a URL pattern (Desktop may be desktop.wxcc*, web.webex.com,
// …). It is excluded from CRM pick/write targets and used to route pushes back.
let _desktopTabId = null;

function getWrap() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(WRAP_KEY, (res) => {
        const w = (res && res[WRAP_KEY]) || { mode: 'manual', target: null, targets: [] };
        if (!Array.isArray(w.targets)) w.targets = w.target ? [w.target] : [];
        resolve(w);
      });
    } catch (e) {
      resolve({ mode: 'manual', target: null, targets: [] });
    }
  });
}

function sameSig(a, b) {
  if (!a || !b) return false;
  return a.tag === b.tag && a.name === b.name && a.placeholder === b.placeholder &&
    a.ariaLabel === b.ariaLabel && a.labelText === b.labelText && a.idStem === b.idStem &&
    a.dataName === b.dataName;
}

function setWrap(w) {
  return new Promise((resolve) => {
    try { chrome.storage.sync.set({ [WRAP_KEY]: w }, resolve); } catch (e) { resolve(); }
  });
}

// Collect the tabs that may host the CRM: the Tab Manager tab(s) (CRM lives in a
// nested iframe there) PLUS the active tab of every window (covers a CRM opened
// as its own tab), excluding the Webex CC Desktop tab itself.
async function crmRecipientTabs(cfg) {
  const seen = new Set();
  const out = [];
  const push = (t) => { if (t && t.id != null && t.id !== _desktopTabId && !seen.has(t.id)) { seen.add(t.id); out.push(t); } };
  try { (await findDesktopTabs(cfg.crmManagerUrlPattern || 'crm-tab-manager')).forEach(push); } catch (e) { /* ignore */ }
  try {
    const active = await chrome.tabs.query({ active: true });
    for (const t of active) {
      if (t.url && cfg.desktopUrlPattern && t.url.indexOf(cfg.desktopUrlPattern) !== -1) continue;
      push(t);
    }
  } catch (e) { /* ignore */ }
  return out;
}

// Deliver a message to every frame of each CRM recipient tab. Only the CRM
// participant frame that owns the remembered target acts on writes.
async function sendToCrmFrames(msg, cfg) {
  const tabs = await crmRecipientTabs(cfg);
  console.log('[crm-wrap/bg]', msg.type, '→ recipient tabs', tabs.length, tabs.map((t) => t.url));
  let n = 0;
  for (const t of tabs) {
    try { await chrome.tabs.sendMessage(t.id, msg); n++; } catch (e) { /* not ready */ }
  }
  return n;
}

async function sendToDesktopFrames(msg, cfg) {
  const seen = new Set();
  const tabs = [];
  try {
    (await findDesktopTabs(cfg.desktopUrlPattern)).forEach((t) => { if (t && t.id != null && !seen.has(t.id)) { seen.add(t.id); tabs.push(t); } });
  } catch (e) { /* ignore */ }
  if (_desktopTabId != null && !seen.has(_desktopTabId)) tabs.push({ id: _desktopTabId });
  let n = 0;
  for (const t of tabs) {
    try { await chrome.tabs.sendMessage(t.id, msg); n++; } catch (e) { /* not ready */ }
  }
  return n;
}

async function handleWrapReq(payload) {
  const cfg = await getConfig();
  const type = payload && payload.type;
  if (type === 'GET_STATUS') {
    const w = await getWrap();
    const tabs = await findDesktopTabs(cfg.crmManagerUrlPattern || 'crm-tab-manager');
    console.log('[crm-wrap/bg] GET_STATUS | pattern', JSON.stringify(cfg.crmManagerUrlPattern),
      '| managerTabs', tabs.length, tabs.map((t) => t.url));
    return {
      crmOpen: cfg.enabled && tabs.length > 0,
      targetConfigured: !!((w.targets && w.targets.length) || (w.target && w.target.selector)),
      mode: w.mode || 'manual',
      glowColor: w.glowColor || '#0e7fc1',
    };
  }
  if (type === 'SET_MODE') {
    const w = await getWrap();
    w.mode = payload.mode === 'auto' ? 'auto' : 'manual';
    await setWrap(w);
    return { ok: true, mode: w.mode };
  }
  if (type === 'SET_GLOW_COLOR') {
    const w = await getWrap();
    w.glowColor = payload.color || '#0e7fc1';
    await setWrap(w);
    await sendToCrmFrames({ type: 'WRAP_HIGHLIGHT', color: w.glowColor }, cfg);
    return { ok: true, glowColor: w.glowColor };
  }
  if (type === 'PICKER_START') {
    const n = await sendToCrmFrames({ type: 'WRAP_PICKER_START' }, cfg);
    console.log('[crm-wrap/bg] PICKER_START delivered to', n, 'tab(s)');
    return { ok: n > 0, frames: n };
  }
  if (type === 'HIGHLIGHT') {
    const n = await sendToCrmFrames({ type: 'WRAP_HIGHLIGHT' }, cfg);
    return { ok: n > 0 };
  }
  if (type === 'UNHIGHLIGHT') {
    const n = await sendToCrmFrames({ type: 'WRAP_UNHIGHLIGHT' }, cfg);
    return { ok: n > 0 };
  }
  if (type === 'WRITE_WRAPUP_TEXT') {
    const w = await getWrap();
    const hasTarget = (w.targets && w.targets.length) || (w.target && w.target.selector);
    if (!hasTarget) return { ok: false, reason: 'no-target' };
    const n = await sendToCrmFrames({ type: 'WRAP_WRITE', text: payload.text || '', target: w.target, targets: w.targets }, cfg);
    return { ok: n > 0 };
  }
  if (type === 'CLEAR_TARGET') {
    const w = await getWrap();
    w.target = null;
    w.targets = [];
    await setWrap(w);
    await sendToCrmFrames({ type: 'WRAP_CLEAR_TARGET' }, cfg);
    await sendToDesktopFrames({ type: 'WRAP_PUSH', event: 'TARGET_CLEARED' }, cfg);
    return { ok: true };
  }
  return { ok: false, reason: 'unknown' };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === 'WRAP_REQ') {
    if (sender && sender.tab && sender.tab.id != null) _desktopTabId = sender.tab.id;
    handleWrapReq(msg.payload || {}).then(sendResponse).catch(() => sendResponse({ ok: false }));
    return true; // async sendResponse
  }
  if (msg.type === 'WRAP_PICKER_RESULT') {
    (async () => {
      const cfg = await getConfig();
      const w = await getWrap();
      const d = msg.descriptor ||
        (msg.selector ? { origin: msg.origin, selector: msg.selector, selectors: [msg.selector] } : null);
      if (d) {
        w.targets = (Array.isArray(w.targets) ? w.targets : []).filter((t) => !sameSig(t.signature, d.signature));
        w.targets.unshift(d);
        if (w.targets.length > 8) w.targets.length = 8;
        w.target = d;
        await setWrap(w);
      }
      await sendToDesktopFrames({ type: 'WRAP_PUSH', event: 'PICKER_RESULT' }, cfg);
    })();
    return; // no response needed
  }
});

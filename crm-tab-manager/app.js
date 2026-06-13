/* ── i18n ─────────────────────────────────────────────────────────────────── */

var _tabManagerI18n = {
  en: {
    pageTitle:            'CRM Tab Manager — WebexCC Sync',
    title:                'CRM Tab Manager',
    subtitle:             'WebexCC Sync Bridge',
    config:               'Configuration',
    wsUrlLabel:           'Relay WebSocket URL',
    crmUrlLabel:          'CRM URL Template',
    crmUrlHint:           'Placeholders: <code>{ani}</code> &middot; <code>{interactionId}</code> &middot; <code>{customerId}</code>',
    autoClose:            'Automatically close CRM tab when agent completes wrapup',
    saveBtn:              'Save & Reconnect',
    interactionsTitle:    'Active Interactions',
    emptyState:           'No active interactions',
    connected:            'Connected',
    disconnected:         'Disconnected',
    badgeActive:          'Active',
    badgeWrapup:          'Wrapup',
    badgeEnded:           'Ended',
    openCrm:              'Open CRM',
    closeTab:             'Close tab',
    rowClickHint:         'Click to show CRM content and notify WebexCC',
    popupBlockedTitle:    '⚠ Popup blocked',
    popupBlockedMsg:      'Popup was blocked. Allow popups from <strong>{origin}</strong> in your browser settings, then click <strong>Save &amp; Reconnect</strong>.',
    templateMissingTitle: '⚙ Template missing',
    templateMissingMsg:   'The CRM URL template is empty. Enter a template above (e.g. <code>https://crm.example.com/customers/{ani}</code>) and click <strong>Save &amp; Reconnect</strong>.',
    dismiss:              'Dismiss',
  },
  de: {
    pageTitle:            'CRM Tab-Manager — WebexCC Sync',
    title:                'CRM Tab-Manager',
    subtitle:             'WebexCC Synchronisationsbrücke',
    config:               'Konfiguration',
    wsUrlLabel:           'Relay WebSocket-URL',
    crmUrlLabel:          'CRM-URL-Vorlage',
    crmUrlHint:           'Platzhalter: <code>{ani}</code> &middot; <code>{interactionId}</code> &middot; <code>{customerId}</code>',
    autoClose:            'CRM-Tab automatisch schließen, wenn der Agent die Nachbearbeitung abschließt',
    saveBtn:              'Speichern & Verbinden',
    interactionsTitle:    'Aktive Interaktionen',
    emptyState:           'Keine aktiven Interaktionen',
    connected:            'Verbunden',
    disconnected:         'Getrennt',
    badgeActive:          'Aktiv',
    badgeWrapup:          'Nachbearbeitung',
    badgeEnded:           'Beendet',
    openCrm:              'CRM öffnen',
    closeTab:             'Tab schließen',
    rowClickHint:         'Klicken, um CRM-Inhalt anzuzeigen und WebexCC zu benachrichtigen',
    popupBlockedTitle:    '⚠ Popup blockiert',
    popupBlockedMsg:      'Popup wurde blockiert. Erlauben Sie Popups von <strong>{origin}</strong> in Ihren Browsereinstellungen und klicken Sie dann auf <strong>Speichern &amp; Verbinden</strong>.',
    templateMissingTitle: '⚙ Vorlage fehlt',
    templateMissingMsg:   'Die CRM-URL-Vorlage ist leer. Geben Sie oben eine Vorlage ein (z.\u00a0B. <code>https://crm.example.com/customers/{ani}</code>) und klicken Sie auf <strong>Speichern &amp; Verbinden</strong>.',
    dismiss:              'Schließen',
  },
  cs: {
    pageTitle:            'Správce karet CRM — WebexCC Sync',
    title:                'Správce karet CRM',
    subtitle:             'Synchronizační most WebexCC',
    config:               'Konfigurace',
    wsUrlLabel:           'URL relé WebSocket',
    crmUrlLabel:          'Šablona URL CRM',
    crmUrlHint:           'Zástupné znaky: <code>{ani}</code> &middot; <code>{interactionId}</code> &middot; <code>{customerId}</code>',
    autoClose:            'Automaticky zavřít kartu CRM po dokončení vyhodnocení hovoru',
    saveBtn:              'Uložit a připojit',
    interactionsTitle:    'Aktivní interakce',
    emptyState:           'Žádné aktivní interakce',
    connected:            'Připojeno',
    disconnected:         'Odpojeno',
    badgeActive:          'Aktivní',
    badgeWrapup:          'Vyhodnocení',
    badgeEnded:           'Ukončeno',
    openCrm:              'Otevřít CRM',
    closeTab:             'Zavřít kartu',
    rowClickHint:         'Kliknutím zobrazíte obsah CRM a upozorníte WebexCC',
    popupBlockedTitle:    '⚠ Vyskakovací okno blokováno',
    popupBlockedMsg:      'Vyskakovací okno bylo zablokováno. Povolte vyskakovací okna z <strong>{origin}</strong> v nastavení prohlížeče a klikněte na <strong>Uložit &amp; připojit</strong>.',
    templateMissingTitle: '⚙ Chybí šablona',
    templateMissingMsg:   'Šablona URL CRM je prázdná. Zadejte šablonu výše (např. <code>https://crm.example.com/customers/{ani}</code>) a klikněte na <strong>Uložit a připojit</strong>.',
    dismiss:              'Zavřít',
  },
};

var _lang = ((navigator.language || 'en').toLowerCase().split(/[-_]/)[0]);
var _t = _tabManagerI18n[_lang] || _tabManagerI18n['en'];

function _escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function applyI18n() {
  document.title = _t.pageTitle;
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.dataset.i18n;
    if (key === 'crmUrlHint') {
      el.innerHTML = _t[key] || el.innerHTML;
    } else {
      el.textContent = _t[key] || el.textContent;
    }
  });
}

/* ── Config (persisted to localStorage) ──────────────────────────────────── */

const CONFIG_KEY = 'crmTabManager_config';

// Session ID injected by the widget when it opens this window.
// Format: ?session=<uuid>  (appended by openCrmTabManager in syncSlice.js)
// Falls back to empty string — relay still accepts it, but session-scoped
// routing will only work when both sides share the same non-empty sessionId.
const _sessionId = new URLSearchParams(location.search).get('session') || '';
if (_sessionId) {
  console.log('[tab-manager] Session ID:', _sessionId);
} else {
  console.warn('[tab-manager] No session ID in URL — multi-agent isolation disabled for this window');
}

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; } catch { return {}; }
}

function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// Default the relay URL to the same origin as this page so the Tab Manager
// always connects to the right relay instance regardless of localStorage state.
// When served from production (https://webex-crm-relay-...) this gives wss://...
// When served locally (http://localhost:3001) this gives ws://localhost:3001.
var _defaultWsUrl = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host;

// Merge saved config, but discard any saved wsUrl that points at localhost when
// we are running on a non-localhost origin (stale value from old dev default).
const _savedConfig = loadConfig();
const _isNonLocalhost = (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');
if (_savedConfig.wsUrl && _isNonLocalhost && /localhost|127\.0\.0\.1/.test(_savedConfig.wsUrl)) {
  console.log('[tab-manager] Discarding stale localhost wsUrl from localStorage, using origin default:', _defaultWsUrl);
  delete _savedConfig.wsUrl;
}

let config = {
  wsUrl: _defaultWsUrl,
  crmUrlTemplate: '',
  autoCloseOnWrapup: false,
  ..._savedConfig,
};

/* ── DOM refs ─────────────────────────────────────────────────────────────── */

const wsStatusEl       = document.getElementById('ws-status');
const wsUrlInput       = document.getElementById('ws-url-input');
const crmUrlInput      = document.getElementById('crm-url-input');
const autoCloseEl      = document.getElementById('auto-close-checkbox');
const saveBtn          = document.getElementById('save-btn');
const interactionsList = document.getElementById('interactions-list');
const configToggleEl   = document.getElementById('config-toggle');
const configBodyEl     = document.getElementById('config-body');
const configChevronEl  = document.getElementById('config-chevron');
const popupSlotEl      = document.getElementById('popup-warning-slot');

/* ── Apply saved config to UI ─────────────────────────────────────────────── */

function applyConfigToUI() {
  wsUrlInput.value   = config.wsUrl;
  crmUrlInput.value  = config.crmUrlTemplate;
  autoCloseEl.checked = config.autoCloseOnWrapup;
}
applyConfigToUI();
applyI18n();

/* ── Config panel toggle ─────────────────────────────────────────────────── */

let configOpen = false; // starts collapsed in the new split-pane layout
configToggleEl.addEventListener('click', () => {
  configOpen = !configOpen;
  configBodyEl.classList.toggle('collapsed', !configOpen);
  configChevronEl.innerHTML = configOpen ? '&#9660;' : '&#9658;';
});

/* ── Save config ─────────────────────────────────────────────────────────── */

saveBtn.addEventListener('click', () => {
  config.wsUrl           = wsUrlInput.value.trim()  || 'ws://localhost:3001';
  config.crmUrlTemplate  = crmUrlInput.value.trim();
  config.autoCloseOnWrapup = autoCloseEl.checked;
  saveConfig(config);
  reconnect();
});

/* ── Tab registry (keyed by customer, not interaction) ───────────────────── */
// One CRM tab ("customer card") is shared by every interaction that resolves to
// the same customer. The registry is therefore keyed by a stable customer key,
// and each entry tracks the set of interaction IDs currently referencing it.
// The tab is only closed once the LAST referencing interaction is gone.
//
// Map<customerKey, { windowRef, crmUrl, tabName, interactionIds: Set<string> }>
const registry = new Map();

// Base URL for the proxy page — same origin as this Tab Manager page.
const PROXY_BASE = location.origin + '/crm-tab-manager/crm-proxy.html';

function isEmailIdentity(value) {
  return typeof value === 'string' && /\S+@\S+\.\S+/.test(value);
}

// Resolve a stable per-customer key. Two interactions that produce the same key
// share a single CRM tab. Priority:
//   1. customerId   — a unified CRM identity (best; unifies across media types)
//   2. email in ani — preferred over phone per product requirement
//   3. ani (phone)
//   4. displayUrl   — last resort so identical CRM pages still dedupe
// Falls back to the interaction ID so a tab can always be tracked.
function customerKeyFor(data, interactionId) {
  if (data) {
    if (data.customerId) {
      // A customerId that is itself an email must unify with email-channel keys
      // (where the email arrives in `ani`), so the same person shares one tab.
      if (isEmailIdentity(data.customerId)) return 'email:' + data.customerId.toLowerCase();
      return 'cid:' + String(data.customerId).toLowerCase();
    }
    if (isEmailIdentity(data.ani))  return 'email:' + data.ani.toLowerCase();
    if (data.ani)                   return 'ani:'   + String(data.ani).toLowerCase();
    if (data.displayUrl)            return 'url:'   + data.displayUrl;
  }
  return 'iid:' + interactionId;
}

// window.open names must be simple tokens — sanitize the customer key.
function tabNameFor(customerKey) {
  return 'crm_' + String(customerKey).replace(/[^a-zA-Z0-9]/g, '_');
}

// Find the registry entry that currently references a given interaction.
function findRegistryEntryByInteraction(interactionId) {
  for (const [key, entry] of registry.entries()) {
    if (entry.interactionIds.has(interactionId)) return { key, entry };
  }
  return null;
}

function buildCrmUrl(ani, interactionId, customerId) {
  if (!config.crmUrlTemplate) return null;
  // Prefer the resolved customer identity (email from JDS) over the raw ANI
  // (phone number).  For email tasks ani == customerId so this is a no-op;
  // for voice tasks with JDS resolution customerId is the email address.
  const effectiveCustomerId = customerId || ani || '';
  return config.crmUrlTemplate
    .replace('{ani}', encodeURIComponent(effectiveCustomerId))
    .replace('{interactionId}', encodeURIComponent(interactionId || ''))
    .replace('{customerId}', encodeURIComponent(effectiveCustomerId));
}

function buildProxyUrl(interactionId, crmUrl, title) {
  const params = new URLSearchParams({ interactionId, url: crmUrl || '' });
  if (title) params.set('title', title);
  return PROXY_BASE + '?' + params.toString();
}

function openOrFocusCrmTab(interactionId, ani, customerId, displayUrl, title) {
  const crmUrl = displayUrl || buildCrmUrl(ani, interactionId, customerId);
  if (!crmUrl) {
    console.warn('[tab-manager] No CRM URL — configure the CRM URL template or set displayUrl CAD variable');
    showPopupBlockedWarning(true /* templateMissing */);
    return;
  }

  const customerKey = customerKeyFor({ ani, customerId, displayUrl }, interactionId);

  // If a tab for this customer is already open, reuse it (the same "customer
  // card" must never be displayed twice). Register this interaction against it.
  const existing = registry.get(customerKey);
  if (existing && existing.windowRef && !existing.windowRef.closed) {
    existing.interactionIds.add(interactionId);
    suppressTabFocusEcho();
    existing.windowRef.focus();
    console.log('[tab-manager] Reusing CRM tab for customer', customerKey, '— interactions:', [...existing.interactionIds]);
    return;
  }

  // Stable per-customer tab name so the browser reuses the same tab if it is
  // re-opened. Because this call originates from the Tab Manager window's own JS
  // context, the browser opens the URL as a tab IN THIS SAME WINDOW.
  const tabName  = tabNameFor(customerKey);
  const proxyUrl = buildProxyUrl(interactionId, crmUrl, title);

  console.log('[tab-manager] Opening CRM tab for customer', customerKey, '→', proxyUrl);
  const windowRef = window.open(proxyUrl, tabName);
  if (!windowRef) {
    console.warn('[tab-manager] window.open blocked for', proxyUrl);
    showPopupBlockedWarning(false);
    return;
  }

  const ids = (existing && existing.interactionIds) || new Set();
  ids.add(interactionId);
  registry.set(customerKey, { windowRef, crmUrl, tabName, interactionIds: ids });
}

function closeCrmTab(interactionId) {
  const found = findRegistryEntryByInteraction(interactionId);
  if (!found) return;
  const { key, entry } = found;

  // Drop this interaction's reference. Only close the actual tab once no other
  // active interaction for the same customer still needs it.
  entry.interactionIds.delete(interactionId);
  if (entry.interactionIds.size === 0) {
    if (entry.windowRef && !entry.windowRef.closed) entry.windowRef.close();
    registry.delete(key);
    console.log('[tab-manager] Closed CRM tab for customer', key, '— last interaction ended');
  } else {
    console.log('[tab-manager] Keeping CRM tab open for customer', key, '— still', entry.interactionIds.size, 'active interaction(s)');
  }
}

function focusCrmTab(interactionId) {
  const found = findRegistryEntryByInteraction(interactionId);
  if (found && found.entry.windowRef && !found.entry.windowRef.closed) {
    suppressTabFocusEcho();
    found.entry.windowRef.focus();
  }
}

/* ── Popup blocked / missing-template warning ────────────────────────────── */

let warningShown = false;
function showPopupBlockedWarning(templateMissing = false) {
  if (warningShown) return;
  warningShown = true;
  const msg = templateMissing
    ? _t.templateMissingMsg
    : _t.popupBlockedMsg.replace('{origin}', _escHtml(location.origin));
  const title = templateMissing ? _t.templateMissingTitle : _t.popupBlockedTitle;
  popupSlotEl.innerHTML = `
    <div class="popup-warning">
      <strong>${title}</strong>
      <p>${msg}</p>
      <button onclick="this.closest('.popup-warning').remove(); warningShown=false;">${_t.dismiss}</button>
    </div>`;
}

/* ── Interaction state map ───────────────────────────────────────────────── */
// Map<interactionId, { ani, crmUrl, state: 'connected'|'wrapup'|'ended' }>
const interactions = new Map();

/* ── Render interaction list ─────────────────────────────────────────────── */

function renderInteractions() {
  if (interactions.size === 0) {
    interactionsList.innerHTML = `<p class="empty-state">${_t.emptyState}</p>`;
    return;
  }

  interactionsList.innerHTML = '';
  for (const [id, data] of interactions.entries()) {
    const stateLabel = { connected: _t.badgeActive, wrapup: _t.badgeWrapup, ended: _t.badgeEnded }[data.state] || data.state;
    const stateClass = { connected: 'badge--active', wrapup: 'badge--wrapup', ended: 'badge--ended' }[data.state] || '';
    const rowClass = data.state === 'ended' ? 'interaction-row interaction-row--ended' : 'interaction-row';

    const row = document.createElement('div');
    row.className = rowClass;
    row.dataset.id = id;
    const label = data.title || data.ani || 'Unknown';
    const urlHint = data.displayUrl
      ? `<span class="display-url" title="${data.displayUrl}">${data.displayUrl}</span>`
      : '';
    row.innerHTML = `
      <div class="interaction-info" title="${_t.rowClickHint}">
        <span class="ani">${label}</span>
        <span class="badge ${stateClass}">${stateLabel}</span>
        <span class="iid">${id.slice(0, 8)}&hellip;</span>
        ${urlHint}
      </div>
      <div class="interaction-actions">
        <button class="btn btn--sm" data-action="open" data-id="${id}">${_t.openCrm}</button>
        <button class="btn btn--sm btn--danger" data-action="close" data-id="${id}">${_t.closeTab}</button>
      </div>`;

    // Click on info area → focus CRM tab + tell WebexCC to switch interaction
    row.querySelector('.interaction-info').addEventListener('click', () => {
      focusCrmTab(id);
      sendWs({ type: 'CRM_TAB_SELECTED', interactionId: id });
    });

    interactionsList.appendChild(row);
  }
}

// Delegate button clicks
interactionsList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'open') {
    const d = interactions.get(id);
    if (d) {
      openOrFocusCrmTab(id, d.ani, d.customerId, d.displayUrl, d.title);
      sendWs({ type: 'CRM_TAB_SELECTED', interactionId: id });
    }
  } else if (btn.dataset.action === 'close') {
    closeCrmTab(id);
    interactions.delete(id);
    renderInteractions();
  }
});

/* ── WebSocket connection ────────────────────────────────────────────────── */

let ws = null;
let heartbeatTimer = null;
let reconnectTimer = null;

function setStatus(connected) {
  wsStatusEl.textContent = connected ? _t.connected : _t.disconnected;
  wsStatusEl.className = `badge ${connected ? 'badge--connected' : 'badge--disconnected'}`;
}

function sendWs(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('[tab-manager] →', msg.type, msg);
    ws.send(JSON.stringify(msg));
  } else {
    console.warn('[tab-manager] cannot send (not connected):', msg.type);
  }
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  console.log('[tab-manager] Connecting to', config.wsUrl);
  try {
    ws = new WebSocket(config.wsUrl);
  } catch (err) {
    console.error('[tab-manager] Could not open WebSocket:', err.message);
    return;
  }

  ws.onopen = () => {
    console.log('[tab-manager] Connected to relay');
    setStatus(true);
    sendWs({ type: 'REGISTER', role: 'crm', sessionId: _sessionId });
    heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) sendWs({ type: 'HEARTBEAT' });
    }, 30000);
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    handleMessage(msg);
  };

  ws.onclose = () => {
    console.log('[tab-manager] Disconnected — retrying in 5 s');
    setStatus(false);
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    ws = null;
    reconnectTimer = setTimeout(connect, 5000);
  };

  ws.onerror = () => {
    console.warn('[tab-manager] WebSocket error (will reconnect on close)');
  };
}

function reconnect() {
  clearTimeout(reconnectTimer);
  clearInterval(heartbeatTimer);
  if (ws) { try { ws.close(); } catch (_) {} }
  ws = null;
  connect();
}

/* ── Message handling ────────────────────────────────────────────────────── */

function handleMessage(msg) {
  console.log('[tab-manager] ←', msg.type, msg);

  switch (msg.type) {

    case 'REGISTERED': {
      // The relay now notifies webexcc clients on the same session when a crm
      // client registers, triggering an automatic state flush. We still send
      // CRM_CLIENT_CONNECTED once as a belt-and-suspenders measure for older
      // relay versions, but the retried sends are no longer necessary.
      console.log('[tab-manager] registered — relay will request state flush from WebexCC');
      sendWs({ type: 'CRM_CLIENT_CONNECTED' });
      break;
    }

    case 'INTERACTION_ARRIVED': {
      const { interactionId, ani, customerId, displayUrl, title, state } = msg;
      interactions.set(interactionId, { ani, customerId: customerId || null, displayUrl: displayUrl || null, title: title || null, state: state || 'connected' });
      renderInteractions();
      openOrFocusCrmTab(interactionId, ani, customerId || null, displayUrl || null, title || null);
      break;
    }

    case 'INTERACTION_SELECTED': {
      // Desktop-initiated task switch → activate the corresponding iframe.
      // No echo suppression needed: switching an iframe never generates focus
      // events that would bounce back through the relay.
      const _sel = interactions.get(msg.interactionId);
      if (_sel) {
        openOrFocusCrmTab(msg.interactionId, _sel.ani, _sel.customerId, _sel.displayUrl, _sel.title);
      } else {
        focusCrmTab(msg.interactionId);
      }
      break;
    }

    case 'INTERACTION_WRAPUP': {
      const { interactionId } = msg;
      if (interactions.has(interactionId)) {
        interactions.get(interactionId).state = 'wrapup';
        renderInteractions();
      }
      break;
    }

    case 'INTERACTION_ENDED': {
      const { interactionId } = msg;
      if (config.autoCloseOnWrapup) {
        // Auto-close covers both wrapup-then-end and direct end (no wrapup step).
        closeCrmTab(interactionId);
        interactions.delete(interactionId);
      } else if (interactions.has(interactionId)) {
        interactions.get(interactionId).state = 'ended';
      }
      renderInteractions();
      break;
    }

    case 'TASK_TITLE': {
      // Sent by the headless widget (self-sufficient path) when the Desktop
      // passes the task prop. Updates the title of an existing interaction
      // without opening a new tab.
      const { interactionId, title } = msg;
      if (title && interactions.has(interactionId)) {
        interactions.get(interactionId).title = title;
        renderInteractions();
        console.log('[tab-manager] TASK_TITLE updated for', interactionId, '→', title);
      }
      break;
    }

    default:
      break;
  }
}
/* ── Start ───────────────────────────────────────────────────────────────── */

// Listen for TAB_FOCUSED messages from crm-proxy.html pages.
// When the agent switches to a CRM browser tab directly (not via the sidebar),
// the proxy fires a BroadcastChannel message. We forward it as CRM_TAB_SELECTED
// so the Desktop switches to the matching interaction.
//
// Echo suppression: when WE programmatically focus a tab (via openOrFocusCrmTab
// called from INTERACTION_SELECTED), the proxy's visibilitychange fires and
// would loop back. We suppress TAB_FOCUSED for 1 s after any programmatic focus.
let _suppressTabFocusUntil = 0;

function suppressTabFocusEcho() {
  _suppressTabFocusUntil = Date.now() + 1000;
}

try {
  const _tabFocusCh = new BroadcastChannel('crm-tab-focus');
  _tabFocusCh.onmessage = function (evt) {
    if (!evt.data || evt.data.type !== 'TAB_FOCUSED' || !evt.data.interactionId) return;
    if (Date.now() < _suppressTabFocusUntil) {
      console.log('[tab-manager] TAB_FOCUSED suppressed (echo guard) for', evt.data.interactionId);
      return;
    }
    const iid = evt.data.interactionId;
    console.log('[tab-manager] TAB_FOCUSED →', iid, '— sending CRM_TAB_SELECTED');
    sendWs({ type: 'CRM_TAB_SELECTED', interactionId: iid });
  };
} catch (e) {
  console.warn('[tab-manager] BroadcastChannel not available:', e.message);
}

connect();

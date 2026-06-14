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
    placementLabel:       'Embedded tab placement (Chrome)',
    placementSide:        'Side (left)',
    placementTop:         'Top',
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
    placementLabel:       'Position der eingebetteten Tabs (Chrome)',
    placementSide:        'Seitlich (links)',
    placementTop:         'Oben',
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
    placementLabel:       'Umístění vložených karet (Chrome)',
    placementSide:        'Po straně (vlevo)',
    placementTop:         'Nahoře',
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
  crmTabPlacement: 'side',
  ..._savedConfig,
};

// ── Display mode ───────────────────────────────────────────────────────────
// Firefox honours script-driven activation of a background browser tab, so we
// keep the lightweight "one real tab per customer" model there. Chromium-based
// browsers (Chrome, Edge, Brave, …) and Safari block raising a background tab
// from script, so Desktop→CRM switching cannot foreground the right tab. For
// those we render an EMBEDDED view: a single window hosting one iframe per
// customer with an in-window tab strip, which we can switch with no browser
// activation fight.
const _isFirefox = /firefox/i.test(navigator.userAgent || '');
const USE_EMBEDDED = !_isFirefox;

/* ── DOM refs ─────────────────────────────────────────────────────────────── */
// Form/list refs start pointing at #app-normal elements (correct for Firefox).
// After mode detection the USE_EMBEDDED block reassigns them to the #app-embedded
// equivalents (which have -emb IDs) so that getElementById duplicate ambiguity
// never bites us — the right elements are always read and written.

let wsUrlInput       = document.getElementById('ws-url-input');
let crmUrlInput      = document.getElementById('crm-url-input');
let autoCloseEl      = document.getElementById('auto-close-checkbox');
let placementSelect  = document.getElementById('placement-select');
let saveBtn          = document.getElementById('save-btn');
let interactionsList = document.getElementById('interactions-list');
// Firefox mode elements (may be null in embedded mode)
const configToggleEl   = document.getElementById('config-toggle');
const configBodyEl     = document.getElementById('config-body');
const configChevronEl  = document.getElementById('config-chevron');
// Status badge — different element in each mode, resolved after mode detection
let wsStatusEl = null;

/* ── Apply saved config to UI ─────────────────────────────────────────────── */
// Called AFTER mode detection so the refs point at the visible elements.

function applyConfigToUI() {
  if (wsUrlInput)       wsUrlInput.value      = config.wsUrl;
  if (crmUrlInput)      crmUrlInput.value     = config.crmUrlTemplate;
  if (autoCloseEl)      autoCloseEl.checked   = config.autoCloseOnWrapup;
  if (placementSelect)  placementSelect.value = config.crmTabPlacement || 'top';
}

/* ── Wire save button (called after refs are resolved) ───────────────────── */

function wireSaveBtn() {
  if (!saveBtn) return;
  saveBtn.addEventListener('click', () => {
    if (wsUrlInput)      config.wsUrl             = wsUrlInput.value.trim() || 'ws://localhost:3001';
    if (crmUrlInput)     config.crmUrlTemplate    = crmUrlInput.value.trim();
    if (autoCloseEl)     config.autoCloseOnWrapup = autoCloseEl.checked;
    if (placementSelect) config.crmTabPlacement   = placementSelect.value;
    saveConfig(config);
    reconnect();
  });
}

/* ── Config panel toggle (Firefox mode) ──────────────────────────────────── */

if (configToggleEl) {
  let configOpen = false;
  configToggleEl.addEventListener('click', () => {
    configOpen = !configOpen;
    configBodyEl.classList.toggle('collapsed', !configOpen);
    configChevronEl.innerHTML = configOpen ? '&#9660;' : '&#9658;';
  });
}

/* ── Tab registry (keyed by customer, not interaction) ───────────────────── */
// One CRM tab ("customer card") is shared by every interaction that resolves to
// the same customer. The registry is therefore keyed by a stable customer key,
// and each entry tracks the set of interaction IDs currently referencing it.
// The tab is only closed once the LAST referencing interaction is gone.
//
// Map<customerKey, { windowRef?, crmUrl, tabName, proxyUrl, title, interactionIds: Set<string> }>
const registry = new Map();

// Base URL for the proxy page — same origin as this Tab Manager page.
const PROXY_BASE = location.origin + '/crm-tab-manager/crm-proxy.html';

/* ── Embedded CRM view driver (Chrome) ───────────────────────────────────── */
// Renders one <iframe> per customer inside this window plus an in-window tab
// strip at the very top of the screen, so switching needs no browser tab
// activation. Keyed by customerKey to match the registry.
// Only used when USE_EMBEDDED is true.

const embTabsEl       = document.getElementById('emb-tabs');
const embSettingsBtnEl = document.getElementById('emb-settings-btn');
const embSettingsPanelEl = document.getElementById('emb-settings');
const crmFramesEl     = document.getElementById('crm-frames');

const embedded = {
  entries: new Map(), // customerKey → { iframe, btn, titleEl }
  activeKey: null,
  settingsActive: false,

  ensure(customerKey, proxyUrl, title) {
    let e = this.entries.get(customerKey);
    if (e) {
      if (title) this.setTitle(customerKey, title);
      return e;
    }
    const iframe = document.createElement('iframe');
    iframe.className = 'crm-frame';
    // embedded=1 tells the proxy NOT to emit TAB_FOCUSED (visibility of nested
    // iframes is inherited from this window, so all would fire at once on focus).
    iframe.src = proxyUrl + (proxyUrl.indexOf('?') !== -1 ? '&' : '?') + 'embedded=1';
    crmFramesEl.appendChild(iframe);

    const btn = document.createElement('button');
    btn.className = 'emb-tab';
    btn.dataset.key = customerKey;
    const titleEl = document.createElement('span');
    titleEl.className = 'emb-tab-title';
    titleEl.textContent = title || 'CRM';
    const closeEl = document.createElement('span');
    closeEl.className = 'emb-tab-close';
    closeEl.dataset.close = '1';
    closeEl.innerHTML = '&times;';
    btn.appendChild(titleEl);
    btn.appendChild(closeEl);
    embTabsEl.appendChild(btn);

    crmFramesEl.classList.add('has-frames');
    e = { iframe, btn, titleEl };
    this.entries.set(customerKey, e);
    return e;
  },

  setTitle(customerKey, title) {
    const e = this.entries.get(customerKey);
    if (e && title) e.titleEl.textContent = title;
  },

  show(customerKey) {
    this.activeKey = customerKey;
    this.settingsActive = false;
    if (embSettingsBtnEl)   embSettingsBtnEl.classList.remove('active');
    if (embSettingsPanelEl) embSettingsPanelEl.classList.remove('active');
    for (const [k, e] of this.entries.entries()) {
      const on = (k === customerKey);
      e.iframe.classList.toggle('active', on);
      e.btn.classList.toggle('active', on);
    }
  },

  showSettings() {
    this.settingsActive = true;
    this.activeKey = null;
    if (embSettingsBtnEl)   embSettingsBtnEl.classList.add('active');
    if (embSettingsPanelEl) embSettingsPanelEl.classList.add('active');
    for (const [, e] of this.entries.entries()) {
      e.iframe.classList.remove('active');
      e.btn.classList.remove('active');
    }
  },

  close(customerKey) {
    const e = this.entries.get(customerKey);
    if (!e) return;
    e.iframe.remove();
    e.btn.remove();
    this.entries.delete(customerKey);
    if (this.activeKey === customerKey) this.activeKey = null;
    if (this.entries.size === 0) crmFramesEl.classList.remove('has-frames');
  },
};

function applyCrmPlacement() { /* placement is always top in embedded mode */ }

if (USE_EMBEDDED) {
  document.body.classList.add('mode-embedded');
  // Resolve which badge element to use for connection status
  wsStatusEl = document.getElementById('ws-status');

  // Reassign form/list refs to the embedded settings panel elements.
  // The #app-normal elements have the same base IDs and appear first in the DOM,
  // so getElementById would otherwise always return those hidden elements.
  wsUrlInput       = document.getElementById('ws-url-input-emb')        || wsUrlInput;
  crmUrlInput      = document.getElementById('crm-url-input-emb')       || crmUrlInput;
  autoCloseEl      = document.getElementById('auto-close-checkbox-emb') || autoCloseEl;
  placementSelect  = document.getElementById('placement-select-emb')    || placementSelect;
  saveBtn          = document.getElementById('save-btn-emb')             || saveBtn;
  interactionsList = document.getElementById('interactions-list-emb')   || interactionsList;

  // Settings tab button
  if (embSettingsBtnEl) {
    embSettingsBtnEl.addEventListener('click', () => {
      if (embedded.settingsActive) {
        // toggle back to last CRM tab if any
        if (embedded.activeKey === null && embedded.entries.size > 0) {
          const firstKey = embedded.entries.keys().next().value;
          embedded.show(firstKey);
        } else {
          embedded.showSettings();
        }
      } else {
        embedded.showSettings();
      }
    });
  }

  // CRM tab strip: click tab → switch; click ✕ → close
  if (embTabsEl) {
    embTabsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.emb-tab');
      if (!btn) return;
      const key = btn.dataset.key;
      const entry = registry.get(key);
      if (!entry) return;

      if (e.target.closest('[data-close]')) {
        for (const iid of [...entry.interactionIds]) {
          closeCrmTab(iid);
          interactions.delete(iid);
        }
        renderInteractions();
        return;
      }

      const iid = [...entry.interactionIds][0];
      if (!iid) return;
      _desktopSelectedId = iid;
      embedded.show(key);
      sendWs({ type: 'CRM_TAB_SELECTED', interactionId: iid });
    });
  }
} else {
  // Firefox: use the normal-mode status badge
  wsStatusEl = document.getElementById('ws-status-normal');
}

// Apply config and i18n now that refs point at the right (visible) elements.
applyConfigToUI();
applyI18n();
wireSaveBtn();


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
  const proxyUrl    = buildProxyUrl(interactionId, crmUrl, title);
  const tabName     = tabNameFor(customerKey);

  // Ensure a registry entry for this customer; every interaction that resolves
  // to the same customer shares one CRM view ("customer card").
  let entry = registry.get(customerKey);
  if (!entry) {
    entry = { customerKey, crmUrl, proxyUrl, tabName, title: title || null, interactionIds: new Set() };
    registry.set(customerKey, entry);
  }
  entry.interactionIds.add(interactionId);
  if (title) entry.title = title;

  if (USE_EMBEDDED) {
    // In-window iframe + tab strip. Switching is reliable (no browser activation).
    embedded.ensure(customerKey, proxyUrl, title);
    embedded.show(customerKey);
    console.log('[tab-manager] Embedded CRM shown for customer', customerKey, '— interactions:', [...entry.interactionIds]);
    return;
  }

  // Separate-tab model (Firefox): reuse the existing tab or open a new one.
  if (entry.windowRef && !entry.windowRef.closed) {
    bringTabToFront(entry);
    console.log('[tab-manager] Reusing CRM tab for customer', customerKey, '— interactions:', [...entry.interactionIds]);
    return;
  }
  console.log('[tab-manager] Opening CRM tab for customer', customerKey, '→', proxyUrl);
  const windowRef = window.open(proxyUrl, tabName);
  if (!windowRef) {
    console.warn('[tab-manager] window.open blocked for', proxyUrl);
    showPopupBlockedWarning(false);
    return;
  }
  entry.windowRef = windowRef;
}

// Bring an already-open CRM tab to the foreground.
//
// In this browser, windowRef.focus() does NOT raise a background tab, but
// window.open(url, name) targeting an existing named tab DOES (that is exactly
// why opening a brand-new tab foregrounds it). We re-target the named tab here,
// appending a changing #fragment so the navigation is same-document — the proxy
// page and its CRM iframe are NOT reloaded, only the tab is brought to front.
function bringTabToFront(entry) {
  if (!entry || !entry.windowRef || entry.windowRef.closed) return;
  try {
    if (entry.proxyUrl) {
      const ref = window.open(entry.proxyUrl + '#sel=' + Date.now(), entry.tabName);
      if (ref) {
        entry.windowRef = ref;
        try { ref.focus(); } catch (e) { /* best effort */ }
        return;
      }
    }
    entry.windowRef.focus();
  } catch (e) {
    try { entry.windowRef.focus(); } catch (e2) { /* give up */ }
  }
}

function closeCrmTab(interactionId) {
  const found = findRegistryEntryByInteraction(interactionId);
  if (!found) return;
  const { key, entry } = found;

  // Drop this interaction's reference. Only close the actual view once no other
  // active interaction for the same customer still needs it.
  entry.interactionIds.delete(interactionId);
  if (entry.interactionIds.size === 0) {
    if (USE_EMBEDDED) {
      embedded.close(key);
    } else if (entry.windowRef && !entry.windowRef.closed) {
      entry.windowRef.close();
    }
    registry.delete(key);
    console.log('[tab-manager] Closed CRM view for customer', key, '— last interaction ended');
  } else {
    console.log('[tab-manager] Keeping CRM view open for customer', key, '— still', entry.interactionIds.size, 'active interaction(s)');
  }
}

function focusCrmTab(interactionId) {
  const found = findRegistryEntryByInteraction(interactionId);
  if (!found) return;
  if (USE_EMBEDDED) {
    embedded.ensure(found.key, found.entry.proxyUrl, found.entry.title);
    embedded.show(found.key);
  } else if (found.entry.windowRef && !found.entry.windowRef.closed) {
    bringTabToFront(found.entry);
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
  const html = `
    <div class="popup-warning">
      <strong>${title}</strong>
      <p>${msg}</p>
      <button onclick="this.closest('.popup-warning').remove(); warningShown=false;">${_t.dismiss}</button>
    </div>`;
  // In embedded mode the warning goes into the settings panel slot; otherwise
  // into the normal-mode slot (the two have distinct IDs now).
  const slot = document.getElementById(USE_EMBEDDED ? 'popup-warning-slot-emb' : 'popup-warning-slot');
  if (slot) slot.innerHTML = html;
}

/* ── Interaction state map ───────────────────────────────────────────────── */
// Map<interactionId, { ani, crmUrl, state: 'connected'|'wrapup'|'ended' }>
const interactions = new Map();
// Authoritative selection: the interaction the DESKTOP currently has selected
// (last INTERACTION_SELECTED received). The CRM tab focus mirrors this. Tracked
// so that opening a newly-ARRIVED tab (which steals focus) can immediately
// restore focus to the task the agent is actually working in the Desktop.
let _desktopSelectedId = null;
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
      _desktopSelectedId = id;
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
      _desktopSelectedId = id;
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
  if (!wsStatusEl) return;
  const cls = `badge ${connected ? 'badge--connected' : 'badge--disconnected'}`;
  const txt = connected ? _t.connected : _t.disconnected;
  wsStatusEl.textContent = txt;
  wsStatusEl.className = cls;
  // Also keep the settings-panel badge in sync (embedded mode only).
  const embStatus = document.getElementById('ws-status-emb');
  if (embStatus) { embStatus.textContent = txt; embStatus.className = cls; }
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
      // Opening/reusing a tab brings it to the front. If the Desktop is actually
      // showing a DIFFERENT task, restore focus to that task's tab so the CRM
      // window mirrors the Desktop (the single source of truth). Suppress the
      // arrived tab's transient focus echo so it does not switch the Desktop.
      if (_desktopSelectedId && _desktopSelectedId !== interactionId) {
        suppressTabFocusEcho(interactionId);
        focusCrmTab(_desktopSelectedId);
      }
      break;
    }

    case 'INTERACTION_SELECTED': {
      // Desktop-initiated task switch — this is the authoritative selection.
      // Record it and activate the corresponding CRM tab. The resulting
      // TAB_FOCUSED echo is absorbed by the per-id suppression window.
      _desktopSelectedId = msg.interactionId;
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

    case 'THEME_CHANGED': {
      applyTheme(msg.darkMode);
      break;
    }

    default:
      break;
  }
}
/* ── Theme (dark / light) ────────────────────────────────────────────────── */
// Sent by crm-sync-header via THEME_CHANGED. Defaults to dark so the UI looks
// right before the Desktop's first property push.

function applyTheme(dark) {
  const isDark = (dark === true || dark === 'true' || dark === 1);
  document.documentElement.classList.toggle('theme-dark', isDark);
  document.documentElement.classList.toggle('theme-light', !isDark);
  console.log('[tab-manager] theme →', isDark ? 'dark' : 'light');
}

// Start in dark mode (Desktop default); will be overridden once THEME_CHANGED arrives.
applyTheme(true);

/* ── Start ───────────────────────────────────────────────────────────────── */

// Listen for TAB_FOCUSED messages from crm-proxy.html pages.
//
// Loop-breaking is VALUE-BASED, not timing-based, so it is robust regardless of
// how many TAB_FOCUSED events a focus produces or which tab fires them:
//
//   A TAB_FOCUSED for the interaction the Desktop ALREADY has selected
//   (_desktopSelectedId) is, by definition, not a switch request — it is either
//   the echo of our own programmatic focus or a redundant signal. We drop it.
//   Only a TAB_FOCUSED for a DIFFERENT interaction is a genuine user switch, and
//   we forward exactly that as CRM_TAB_SELECTED, optimistically adopting it as
//   the new selection so its own echoes are immediately absorbed.
//
// A one-shot token additionally absorbs the transient TAB_FOCUSED produced when
// we open a NEW background tab (INTERACTION_ARRIVED) and then refocus the
// selected tab — that new tab's id differs from the selection but must not
// switch the Desktop.
const _suppressOnce = new Set(); // interactionIds whose next TAB_FOCUSED to drop

function suppressTabFocusEcho(interactionId) {
  if (interactionId) _suppressOnce.add(interactionId);
}

try {
  const _tabFocusCh = new BroadcastChannel('crm-tab-focus');
  _tabFocusCh.onmessage = function (evt) {
    if (!evt.data || evt.data.type !== 'TAB_FOCUSED' || !evt.data.interactionId) return;
    const iid = evt.data.interactionId;

    // 1) Transient one-shot suppression (new-tab-open / programmatic refocus).
    if (_suppressOnce.has(iid)) {
      _suppressOnce.delete(iid);
      console.log('[tab-manager] TAB_FOCUSED transient suppressed for', iid);
      return;
    }

    // 2) Value-based steady-state suppression: already the Desktop's selection.
    if (iid === _desktopSelectedId) {
      return;
    }

    // Genuine user-initiated switch → adopt it and tell the Desktop to follow.
    _desktopSelectedId = iid;
    console.log('[tab-manager] TAB_FOCUSED →', iid, '— sending CRM_TAB_SELECTED');
    sendWs({ type: 'CRM_TAB_SELECTED', interactionId: iid });
  };
} catch (e) {
  console.warn('[tab-manager] BroadcastChannel not available:', e.message);
}

connect();

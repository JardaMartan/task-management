/**
 * crm-sync-header.js
 *
 * Horizontal header widget for Webex CC Desktop (advancedHeader area).
 *
 * Responsibilities:
 *   - Relay WebSocket connection to the CRM relay server
 *   - Forwarding task lifecycle events (ARRIVED, WRAPUP, ENDED, TITLE) via relay
 *   - Opening and managing the CRM Tab Manager window
 *   - Displaying relay connection status + a Tab Manager open/focus button
 *
 * Placed in area.advancedHeader in the Desktop layout JSON:
 *
 *   {
 *     "comp": "crm-sync-header",
 *     "script": "https://<relay-host>/dist/crm-sync-header.js",
 *     "properties": {
 *       "task":        "$STORE.agentContact.taskSelected",
 *       "wsurl":       "wss://<relay-host>",
 *       "accesstoken": "$STORE.auth.accessToken",
 *       "workspaceid": "<JDS workspace id>",
 *       "datacenter":  "$STORE.app.datacenter"
 *     }
 *   }
 *
 * `workspaceid` + `datacenter` (with `accesstoken`) are optional but enable JDS
 * customer-email resolution so voice and email interactions for the same person
 * share a single CRM tab.
 *
 * This file is intentionally a plain IIFE (no bundler) so it can be served
 * as a static asset from the relay server and loaded via <script> tag.
 */
(function () {
  'use strict';

  /* ── Relay WebSocket state ──────────────────────────────────────────────── */

  var _relayWs            = null;
  var _relayWsUrl         = null;  // configured via the `wsurl` property (Desktop layout); no dev default
  var _relayReconnectTimer = null;
  var _relayReady         = false;
  var _titleQueue         = [];   // messages buffered before WS is open
  var _accessToken        = '';    // configured via the `accesstoken` property
  var _autoOpenManager    = false; // configured via the `autoopen` property
  var _jdsWorkspaceId     = '';    // configured via the `workspaceid` property; enables customer email resolution
  var _jdsDataCenter      = '';    // configured via the `datacenter` property (e.g. 'prodeu1')
  var _emailCache         = {};    // identity → resolved canonical email ('' if none / lookup failed)

  // Per-tab session id — isolates this agent's relay traffic from other agents
  // sharing the same relay. The relay forwards messages only between a webexcc
  // and a crm client that share the SAME sessionId, so both our REGISTER and the
  // Tab Manager URL must use this value.
  var _sessionId = (function () {
    function gen() {
      return (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
    }
    try {
      var id = sessionStorage.getItem('wx_sync_session');
      if (!id) { id = gen(); sessionStorage.setItem('wx_sync_session', id); }
      return id;
    } catch (e) {
      return gen();
    }
  })();

  /* ── CRM Tab Manager window ─────────────────────────────────────────────── */

  var _crmTabManagerWindow = null;

  /* ── Wrapup / ended detection state ─────────────────────────────────────── */

  var _aqmEndListenersReady = false;
  var _aqmEndedSent  = {};    // interactionId → true  (dedup guard)
  var _inWrapup      = {};    // interactionId → true  (wrapup in progress)
  var _wrapupWatchers = {};   // interactionId → watcher object

  // Tracks known active interactions for deduplication and CRM reconnect flush.
  // interactionId → { ani, customerId, displayUrl, title, state }
  var _activeInteractions = {};

  // Last interaction the agent had selected in the Desktop.
  // Used to detect task switches and emit INTERACTION_SELECTED to the Tab Manager.
  var _lastSelectedInteractionId = null;

  /* ── DOM helpers (used by DOM-watcher wrapup fallback) ───────────────────── */

  function findDeep(root, selector) {
    root = root || document.body;
    var el = root.querySelector(selector);
    if (el) return el;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        el = findDeep(all[i].shadowRoot, selector);
        if (el) return el;
      }
    }
    return null;
  }

  function findInteractionItem(root, interactionId) {
    function search(r) {
      var els = r.querySelectorAll('*');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var attrs = el.attributes;
        for (var j = 0; j < attrs.length; j++) {
          if (attrs[j].value && attrs[j].value.indexOf(interactionId) !== -1) return el;
        }
        if (el.shadowRoot) { var found = search(el.shadowRoot); if (found) return found; }
      }
      return null;
    }
    return search(root);
  }

  /* ── CRM Tab Manager ─────────────────────────────────────────────────────── */

  function _openCrmTabManager() {
    if (_crmTabManagerWindow && !_crmTabManagerWindow.closed) return;

    var wsUrl = _relayWsUrl;
    if (!wsUrl) {
      console.warn('[crm-sync-header] _openCrmTabManager: relay URL not configured (wsurl property missing)');
      return;
    }
    var managerUrl;
    try {
      var parsed = new URL(wsUrl);
      var scheme = parsed.protocol === 'wss:' ? 'https' : 'http';
      managerUrl = scheme + '://' + parsed.host + '/crm-tab-manager/';
    } catch (e) {
      console.warn('[crm-sync-header] _openCrmTabManager: cannot parse wsUrl', wsUrl);
      return;
    }

    var url = managerUrl + '?session=' + encodeURIComponent(_sessionId);
    var windowName = 'crm_manager_' + _sessionId;

    // Open WITHOUT a window-features string so the browser creates a normal
    // window/tab rather than a popup. Popup windows cannot host browser tabs,
    // so any window.open() called from a popup lands in the Desktop window
    // instead. Opening as a normal tab lets the agent drag it out to its own
    // browser window, after which every CRM page opened from the Tab Manager
    // will appear as a tab inside that same window.
    console.log('[crm-sync-header] Opening CRM Tab Manager at', url);
    _crmTabManagerWindow = window.open(url, windowName);
    if (!_crmTabManagerWindow) {
      console.warn('[crm-sync-header] Tab Manager window.open blocked');
    }
  }

  /* ── Relay WebSocket ─────────────────────────────────────────────────────── */

  function _relaySend(msg) {
    if (_relayReady && _relayWs && _relayWs.readyState === WebSocket.OPEN) {
      _relayWs.send(JSON.stringify(msg));
    } else {
      _titleQueue.push(msg);
      _relayConnect();
    }
  }

  function _relayConnect() {
    if (!_relayWsUrl) return; // wait until the `wsurl` property is configured
    if (_relayWs && (_relayWs.readyState === WebSocket.OPEN ||
                     _relayWs.readyState === WebSocket.CONNECTING)) return;
    clearTimeout(_relayReconnectTimer);
    try {
      _relayWs = new WebSocket(_relayWsUrl);
    } catch (e) {
      _relayReconnectTimer = setTimeout(_relayConnect, 5000);
      return;
    }

    _relayWs.onopen = function () {
      _relayReady = true;
      _relayWs.send(JSON.stringify({
        type: 'REGISTER', role: 'webexcc', sessionId: _sessionId, accessToken: _accessToken || '',
      }));
      // Auto-open the Tab Manager only when explicitly enabled via the `autoopen`
      // property. Otherwise the agent opens it manually with the header button so
      // they can place it on a second monitor first.
      if (_autoOpenManager) _openCrmTabManager();
      while (_titleQueue.length) _relayWs.send(JSON.stringify(_titleQueue.shift()));
      _tickStatus();
    };

    _relayWs.onmessage = function (evt) {
      try {
        var msg = JSON.parse(evt.data);

        if (msg && msg.type === 'CRM_TAB_SELECTED' && msg.interactionId) {
          // Forward to panel-layout-headless.js via BroadcastChannel so it can
          // click the correct task in the Desktop task list.
          try {
            var bc = new BroadcastChannel('crm-sync');
            bc.postMessage({ type: 'SELECT_INTERACTION', interactionId: msg.interactionId });
            bc.close();
          } catch (e) { /* BroadcastChannel unavailable */ }
        }

        if (msg && msg.type === 'CRM_CLIENT_CONNECTED') {
          // Tab Manager just (re)connected — re-send all active interactions so it
          // can rebuild its state without a full page reload.
          console.log('[crm-sync-header] CRM client connected — flushing', Object.keys(_activeInteractions).length, 'active interactions');
          Object.keys(_activeInteractions).forEach(function (interactionId) {
            var data = _activeInteractions[interactionId];
            if (data.state === 'ended') return;
            var msgType = data.state === 'wrapup' ? 'INTERACTION_WRAPUP' : 'INTERACTION_ARRIVED';
            _relaySend({ type: msgType, interactionId: interactionId, ani: data.ani,
              customerId: data.customerId, displayUrl: data.displayUrl, title: data.title, state: data.state });
            if (data.title) {
              _relaySend({ type: 'TASK_TITLE', interactionId: interactionId, title: data.title });
            }
          });
        }

      } catch (e) { /* ignore malformed messages */ }
    };

    _relayWs.onclose = function () {
      _relayReady = false;
      _relayWs = null;
      _relayReconnectTimer = setTimeout(_relayConnect, 5000);
      _tickStatus();
    };

    _relayWs.onerror = function () { /* onclose fires after onerror */ };
  }

  /* ── Task data helpers ───────────────────────────────────────────────────── */

  function _extractTitle(parsed) {
    var cad = parsed.callAssociatedData || {};
    var cad2 = parsed.callAssociatedDetails || {};

    // Helper: get a CAD field value whether it's a {value:...} object or plain string
    function cadVal(key) {
      return (cad[key] && cad[key].value) || cad2[key] || null;
    }

    // Compose firstName + lastName if both (or either) are present
    var firstName = cadVal('firstName') || cadVal('first_name');
    var lastName  = cadVal('lastName')  || cadVal('last_name');
    var fullName  = (firstName && lastName) ? (firstName + ' ' + lastName)
                  : (firstName || lastName || null);

    return (
      cadVal('title') ||
      cad2.title ||
      fullName ||
      cadVal('name') ||
      parsed.customerName ||
      cadVal('customerName') ||
      cad2.customerName ||
      (parsed.origin && parsed.origin.name) ||
      null
    );
  }

  /* ── Wrapup / end detection ──────────────────────────────────────────────── */

  function _sendInteractionEnded(interactionId, source) {
    if (_aqmEndedSent[interactionId]) return;
    _aqmEndedSent[interactionId] = true;
    delete _inWrapup[interactionId];
    delete _activeInteractions[interactionId];
    _stopWrapupWatcher(interactionId);
    console.log('[crm-sync-header] INTERACTION_ENDED via', source, 'for', interactionId);
    _relaySend({ type: 'INTERACTION_ENDED', interactionId: interactionId });
    setTimeout(function () { delete _aqmEndedSent[interactionId]; }, 30000);
  }

  function _initAqmEndListeners() {
    var svc;
    try { svc = (typeof AGENTX_SERVICE !== 'undefined') ? AGENTX_SERVICE : null; } catch (e) { svc = null; }
    svc = svc || window.AGENTX_SERVICE || null;
    var aqmContact = svc && svc.aqm && svc.aqm.contact;

    if (!svc || !svc.isInited || !aqmContact) {
      setTimeout(_initAqmEndListeners, 3000);
      return;
    }

    var hasWrappedUp = aqmContact.eAgentContactWrappedUp &&
                       typeof aqmContact.eAgentContactWrappedUp.listen === 'function';
    var hasEnded     = aqmContact.eAgentContactEnded &&
                       typeof aqmContact.eAgentContactEnded.listen === 'function';

    if (!hasWrappedUp && !hasEnded) return;

    if (hasWrappedUp) {
      aqmContact.eAgentContactWrappedUp.listen(function (msg) {
        try {
          var id = msg && msg.data && msg.data.interactionId;
          if (id) _sendInteractionEnded(id, 'eAgentContactWrappedUp');
        } catch (e) {}
      });
    }

    if (hasEnded) {
      aqmContact.eAgentContactEnded.listen(function (msg) {
        try {
          var id = msg && msg.data && msg.data.interactionId;
          if (!id) return;
          setTimeout(function () {
            if (_inWrapup[id]) return;
            _sendInteractionEnded(id, 'eAgentContactEnded');
          }, 500);
        } catch (e) {}
      });
    }

    _aqmEndListenersReady = true;
    console.log('[crm-sync-header] aqm-end-listeners registered | wrappedUp:', hasWrappedUp,
      '| ended:', hasEnded);
  }

  function _startWrapupWatcher(interactionId) {
    if (_aqmEndListenersReady) return;
    if (_wrapupWatchers[interactionId]) return;
    var watcher = { missCount: 0, attempts: 0, maxAttempts: 150, timer: null };
    _wrapupWatchers[interactionId] = watcher;

    function check() {
      if (!_wrapupWatchers[interactionId]) return;
      watcher.attempts++;
      if (watcher.attempts > watcher.maxAttempts) {
        delete _wrapupWatchers[interactionId];
        return;
      }
      var taskArea = findDeep(document.body, '.agentx-task-area') ||
                     findDeep(document.body, 'agentx-wc-task-list-panel-wrapper');
      if (taskArea) {
        var item = findInteractionItem(taskArea.shadowRoot || taskArea, interactionId);
        if (!item) {
          watcher.missCount++;
          if (watcher.missCount >= 2) {
            delete _wrapupWatchers[interactionId];
            _sendInteractionEnded(interactionId, 'DOM-watcher');
            return;
          }
        } else {
          watcher.missCount = 0;
        }
      }
      watcher.timer = setTimeout(check, 2000);
    }
    watcher.timer = setTimeout(check, 3000);
  }

  function _stopWrapupWatcher(interactionId) {
    var w = _wrapupWatchers[interactionId];
    if (w) { clearTimeout(w.timer); delete _wrapupWatchers[interactionId]; }
  }

  /* ── Customer identity resolution ───────────────────────────────────────── */

  function _isEmail(v) {
    return typeof v === 'string' && /\S+@\S+\.\S+/.test(v);
  }

  // Resolve a customer's canonical email from a phone/email identity via the JDS
  // person-alias lookup, so voice and email interactions for the same person
  // share a single CRM tab. Calls cb(email|null). Results are cached per identity.
  // Falls back to cb(null) when the identity is already an email or when JDS
  // config (workspace id / datacenter / access token) is unavailable.
  function _resolveCustomerEmail(identity, cb) {
    if (!identity) { cb(null); return; }
    if (_isEmail(identity)) { cb(identity); return; }
    if (Object.prototype.hasOwnProperty.call(_emailCache, identity)) {
      cb(_emailCache[identity] || null); return;
    }
    if (!_accessToken || !_jdsWorkspaceId || !_jdsDataCenter) { cb(null); return; }
    var url = 'https://api-jds.wxdap-' + _jdsDataCenter +
              '.webex.com/admin/v1/api/person/workspace-id/' + _jdsWorkspaceId +
              '/aliases/' + encodeURIComponent(identity);
    fetch(url, { headers: { Authorization: 'Bearer ' + _accessToken } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var person = j && j.data && j.data[0];
        var email = person && Array.isArray(person.email) ? person.email[0] : null;
        _emailCache[identity] = email || '';
        if (email) console.log('[crm-sync-header] resolved customer email', email, 'for', identity);
        cb(email || null);
      })
      .catch(function (e) {
        console.warn('[crm-sync-header] customer email lookup failed:', e && e.message);
        _emailCache[identity] = '';
        cb(null);
      });
  }

  /* ── Task sync handler ───────────────────────────────────────────────────── */

  function handleTaskSync(rawTask) {
    if (!rawTask) {
      // Task cleared — any interaction still in wrapup has completed.
      Object.keys(_inWrapup).forEach(function (id) {
        _sendInteractionEnded(id, 'task-null');
      });
      return;
    }

    var parsed = rawTask;
    if (typeof rawTask === 'string') {
      try { parsed = JSON.parse(rawTask); } catch (e) {
        console.warn('[crm-sync-header] could not parse task JSON:', e.message);
        return;
      }
    }

    // If Desktop switched to a different task, close any other in-wrapup interaction.
    if (parsed && parsed.interactionId) {
      Object.keys(_inWrapup).forEach(function (id) {
        if (id !== parsed.interactionId) _sendInteractionEnded(id, 'task-switch');
      });
    }

    if (!parsed || !parsed.interactionId) return;

    var title      = _extractTitle(parsed);
    var _rawAni    = parsed.ani || parsed.phoneNumber || null;
    var _mediaType = (parsed.mediaType || parsed.channelType || '').toLowerCase();
    var _isOutbound = (parsed.contactDirection || '').toUpperCase() === 'OUTBOUND' ||
                      (parsed.outboundType || '').toUpperCase() === 'OUTDIAL';

    // For workItem, prefer CAD email/phone over the internal UUID in ani.
    // For OUTBOUND telephony, `ani` is the agent's outbound caller ID, so the
    // customer number is the dialled destination (dnis / dn) instead.
    var _ani = (_mediaType === 'workitem')
      ? ((parsed.callAssociatedData && parsed.callAssociatedData.email &&
          parsed.callAssociatedData.email.value) ||
         (parsed.callAssociatedDetails && parsed.callAssociatedDetails.email) ||
         (parsed.callAssociatedData && parsed.callAssociatedData.phone &&
          parsed.callAssociatedData.phone.value) ||
         (parsed.callAssociatedDetails && parsed.callAssociatedDetails.phone) ||
         _rawAni)
      : (_isOutbound
          ? (parsed.dnis ||
             (parsed.callAssociatedDetails && parsed.callAssociatedDetails.dn) ||
             (parsed.callAssociatedData && parsed.callAssociatedData.dn &&
              parsed.callAssociatedData.dn.value) ||
             _rawAni)
          : _rawAni);

    var _displayUrl = (
      (parsed.callAssociatedData && parsed.callAssociatedData.displayUrl &&
       parsed.callAssociatedData.displayUrl.value) ||
      (parsed.callAssociatedDetails && parsed.callAssociatedDetails.displayUrl) ||
      null
    );

    var _state   = parsed.isWrapUp ? 'wrapup' : (parsed.isTerminated ? 'ended' : 'connected');
    var _msgType = _state === 'wrapup' ? 'INTERACTION_WRAPUP'
                 : _state === 'ended'  ? 'INTERACTION_ENDED'
                 : 'INTERACTION_ARRIVED';

    // Selection tracking: whenever the agent switches to a different (non-ended)
    // task in the Desktop, notify the Tab Manager so it can focus the right tab.
    // This is independent of the ARRIVED dedup below — switching back to an
    // already-known connected task also needs to propagate.
    if (_state !== 'ended' && _lastSelectedInteractionId !== parsed.interactionId) {
      _lastSelectedInteractionId = parsed.interactionId;
      _relaySend({ type: 'INTERACTION_SELECTED', interactionId: parsed.interactionId });
      console.log('[crm-sync-header] INTERACTION_SELECTED for', parsed.interactionId);
    }

    // Dedup: skip if the interaction state hasn't changed from what we last sent.
    var _existing = _activeInteractions[parsed.interactionId];
    if (_existing && _existing.state === _state && _state === 'connected') {
      // Still connected — just update the title if it changed, no need to resend ARRIVED.
      if (title && title !== _existing.title) {
        _existing.title = title;
        _relaySend({ type: 'TASK_TITLE', interactionId: parsed.interactionId, title: title });
      }
      return;
    }

    console.log('[crm-sync-header] sending', _msgType, 'for', parsed.interactionId);

    if (_state === 'ended') {
      delete _activeInteractions[parsed.interactionId];
      _sendInteractionEnded(parsed.interactionId, 'task-prop');
    } else {
      // Track the interaction synchronously so a rapid follow-up task prop hits
      // the dedup short-circuit above instead of triggering a second lookup/send.
      _activeInteractions[parsed.interactionId] = {
        ani: _ani, customerId: parsed.customerId || null,
        displayUrl: _displayUrl, title: title || null, state: _state,
      };
      // Resolve a unified customer email (preferred over phone) so voice and
      // email interactions for the same person share a single CRM tab. The
      // ARRIVED/WRAPUP message is sent only once resolution completes, to avoid
      // the Tab Manager opening a second tab keyed on the raw phone number.
      _resolveCustomerEmail(_ani, function (resolvedEmail) {
        var _customerId = resolvedEmail || parsed.customerId || null;
        var _entry = _activeInteractions[parsed.interactionId];
        if (_entry) _entry.customerId = _customerId;
        _relaySend({
          type: _msgType,
          interactionId: parsed.interactionId,
          ani: _ani,
          customerId: _customerId,
          displayUrl: _displayUrl,
          title: title || null,
          state: _state,
        });
      });
    }

    if (title) {
      _relaySend({ type: 'TASK_TITLE', interactionId: parsed.interactionId, title: title });
    }

    if (_state === 'wrapup') {
      _inWrapup[parsed.interactionId] = true;
      _startWrapupWatcher(parsed.interactionId);
    } else {
      delete _inWrapup[parsed.interactionId];
      _stopWrapupWatcher(parsed.interactionId);
    }
  }

  /* ── Status pill UI ──────────────────────────────────────────────────────── */

  var _shadowRoot = null;

  function _tickStatus() {
    if (!_shadowRoot) return;
    var dot = _shadowRoot.getElementById('dot');
    var btn = _shadowRoot.getElementById('open-btn');
    var connected = _relayReady && _relayWs && _relayWs.readyState === WebSocket.OPEN;

    if (dot) {
      dot.className = 'dot ' + (connected ? 'dot--connected' : 'dot--disconnected');
      dot.title = connected ? 'Relay connected' : 'Relay disconnected';
    }
    if (btn) {
      var winOpen = _crmTabManagerWindow && !_crmTabManagerWindow.closed;
      var lblEl = btn.querySelector('.btn-label');
      if (lblEl) lblEl.textContent = winOpen ? 'Focus CRM' : 'CRM Manager';
      btn.title = winOpen ? 'Focus CRM Tab Manager' : 'Open CRM Tab Manager';
    }
  }

  /* ── Start background listeners (relay connects once `wsurl` is set) ─────── */

  _initAqmEndListeners();

  /* ── Web Component ───────────────────────────────────────────────────────── */

  if (!customElements.get('crm-sync-header')) {
    customElements.define('crm-sync-header', class extends HTMLElement {

      connectedCallback() {
        // Guard against re-attach: Desktop header can call connectedCallback
        // multiple times on the same element instance when it re-renders the menu.
        var shadow = this.shadowRoot || this.attachShadow({ mode: 'open' });
        if (!shadow.getElementById('dot')) {
          shadow.innerHTML = [
            '<style>',
            '  :host { display: inline-flex; align-items: center; height: 100%; }',
            '  .pill {',
            '    display: inline-flex; align-items: center; gap: 6px;',
            '    padding: 0 10px; height: 28px; border-radius: 14px;',
            '    background: rgba(255,255,255,0.08);',
            '    border: 1px solid rgba(255,255,255,0.15);',
            '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
            '    font-size: 12px; color: #d8ddf0; cursor: default; user-select: none;',
            '    white-space: nowrap;',
            '  }',
            '  .dot {',
            '    width: 7px; height: 7px; border-radius: 50%;',
            '    background: #666; flex-shrink: 0; transition: background 0.3s;',
            '  }',
            '  .dot--connected    { background: #3ddc84; }',
            '  .dot--disconnected { background: #e05c5c; }',
            '  .label { font-weight: 500; letter-spacing: 0.02em; }',
            '  .open-btn {',
            '    display: inline-flex; align-items: center; justify-content: center; gap: 4px;',
            '    margin-left: 4px; padding: 0 8px; height: 20px; border-radius: 10px;',
            '    background: rgba(74,143,232,0.25); border: 1px solid rgba(74,143,232,0.5);',
            '    color: #7bb8f5; font-size: 11px; font-family: inherit; cursor: pointer;',
            '    transition: background 0.2s;',
            '  }',
            '  .open-btn:hover { background: rgba(74,143,232,0.45); }',
            '</style>',
            '<div class="pill">',
            '  <span class="dot" id="dot"></span>',
            '  <span class="label">CRM</span>',
            '  <button class="open-btn" id="open-btn" title="Open CRM Tab Manager">',
            '    <svg class="btn-icon" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">',
            '      <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>',
            '    </svg>',
            '    <span class="btn-label">CRM Manager</span>',
            '  </button>',
            '</div>',
          ].join('');

          shadow.getElementById('open-btn').addEventListener('click', function () {
            if (_crmTabManagerWindow && !_crmTabManagerWindow.closed) {
              _crmTabManagerWindow.focus();
            } else {
              _openCrmTabManager();
            }
          });
        }

        _shadowRoot = shadow;
        _tickStatus();
        clearInterval(this._tickInterval);
        this._tickInterval = setInterval(_tickStatus, 2000);
      }

      disconnectedCallback() {
        clearInterval(this._tickInterval);
        _shadowRoot = null;
      }

      /* Properties passed by Desktop via layout JSON "properties": { ... } */

      set task(value) {
        this._task = value;
        handleTaskSync(value);
      }
      get task() { return this._task; }

      set wsurl(value) {
        if (!value || value === _relayWsUrl) return;
        _relayWsUrl = value;
        if (_relayWs) { try { _relayWs.close(); } catch (_) {} }
        _relayConnect();
      }
      get wsurl() { return _relayWsUrl; }

      set accesstoken(value) { this._accesstoken = value; _accessToken = value || ''; }
      get accesstoken() { return this._accesstoken; }

      set autoopen(value) {
        _autoOpenManager = (value === true || value === 'true' || value === '' ||
                            value === 'autoopen' || value === '1');
        // If the relay is already connected when this is set, honour it immediately.
        if (_autoOpenManager && _relayReady) _openCrmTabManager();
      }
      get autoopen() { return _autoOpenManager; }

      set orgid(value) { this._orgid = value; }
      set datacenter(value) { this._datacenter = value; _jdsDataCenter = value || ''; }
      set workspaceid(value) { this._workspaceid = value; _jdsWorkspaceId = value || ''; }
    });
  }

})();

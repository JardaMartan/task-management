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

  /* ── Transport selection (Option E: peer-to-peer postMessage bridge) ─────── */
  // 'relay'  = WebSocket relay server (default, unchanged).
  // 'bridge' = direct window.postMessage to the opened Tab Manager window; no server.
  var _transport      = 'relay';  // configured via the `transport` property
  var _bridgePeer     = null;     // Tab Manager Window handle (bridge mode)
  var _bridgeOrigin   = '*';      // targetOrigin for postMessage to the peer
  var _bridgeReady    = false;    // true once the peer handshake (HELLO/ACK) completes
  var _bridgeListening = false;   // guards single window 'message' listener registration
  var _managerUrl     = null;     // explicit Tab Manager base URL (`managerurl` property); overrides wsurl-derived host
  var _autoCloseCrm   = null;     // `autoclose` property; null = leave the Tab Manager's own setting, else force it
  var _accessToken        = '';    // configured via the `accesstoken` property
  var _autoOpenManager    = false; // configured via the `autoopen` property
  var _jdsWorkspaceId     = '';    // configured via the `workspaceid` property; enables customer email resolution
  var _jdsDataCenter      = '';    // configured via the `datacenter` property (e.g. 'prodeu1')
  var _darkMode           = null;  // configured via the `darkmode` property; null = unknown (not yet set)
  var _emailCache         = {};    // identity → resolved canonical email ('' if none / lookup failed)
  var _nameCache          = {};    // identity → resolved display name ('' if none)

  /* ── Activity analytics emitter config ──────────────────────────────────── */
  // Feeds src/activity-emitter.js (window.__wxActivity). Configured via the
  // `activityurl`, `agentid` and `agentname` layout properties.
  var _activityUrl  = null;
  var _agentId      = null;
  var _agentName    = null;
  var _orgId        = null;   // captured from the `orgid` property for activity events

  /** Push the current config into the shared emitter (no-op if not loaded). */
  function _configureActivity() {
    if (!window.__wxActivity) return;
    window.__wxActivity.configure({
      ingestUrl:   _activityUrl,
      agentId:     _agentId || 'unknown',
      agentName:   _agentName,
      orgId:       _orgId || null,
      sessionId:   _sessionId,
      accessToken: _accessToken || '',
    });
  }

  /** Emit an activity event (no-op if the emitter is not present). */
  function _emitActivity(eventType, data) {
    if (window.__wxActivity) window.__wxActivity.emit(eventType, data);
  }


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
  // interactionId → { ani, email, customerId, displayUrl, title, state }
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

    var managerUrl = _managerUrl;
    if (!managerUrl) {
      var wsUrl = _relayWsUrl;
      if (!wsUrl) {
        console.warn('[crm-sync-header] _openCrmTabManager: no managerurl and no wsurl configured');
        return;
      }
      try {
        var parsed = new URL(wsUrl);
        var scheme = parsed.protocol === 'wss:' ? 'https' : 'http';
        managerUrl = scheme + '://' + parsed.host + '/crm-tab-manager/';
      } catch (e) {
        console.warn('[crm-sync-header] _openCrmTabManager: cannot parse wsUrl', wsUrl);
        return;
      }
    }

    var sep = managerUrl.indexOf('?') === -1 ? '?' : '&';
    var url = managerUrl + sep + 'session=' + encodeURIComponent(_sessionId);
    if (_transport === 'bridge') url += '&transport=bridge';
    if (_autoCloseCrm !== null) url += '&autoclose=' + (_autoCloseCrm ? '1' : '0');
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
    } else if (_transport === 'bridge') {
      // Seed the peer handle + origin; the handshake refines them on first message.
      _bridgePeer = _crmTabManagerWindow;
      try { _bridgeOrigin = new URL(managerUrl).origin; } catch (_) {}
    }
  }

  /* ── Relay WebSocket ─────────────────────────────────────────────────────── */

  function _relaySend(msg) {
    if (_transport === 'bridge') { _bridgeSend(msg); return; }
    if (_relayReady && _relayWs && _relayWs.readyState === WebSocket.OPEN) {
      _relayWs.send(JSON.stringify(msg));
    } else {
      _titleQueue.push(msg);
      _relayConnect();
    }
  }

  /* ── Peer-to-peer bridge (Option E) ──────────────────────────────────────── */

  function _bridgeSend(msg) {
    if (_bridgeReady && _bridgePeer && !_bridgePeer.closed) {
      try {
        _bridgePeer.postMessage({ __crmBridge: true, v: 1, sessionId: _sessionId, payload: msg }, _bridgeOrigin);
        return;
      } catch (e) { /* peer gone — fall through to queue */ }
    }
    _titleQueue.push(msg);
  }

  function _bridgeFlush() {
    while (_titleQueue.length && _bridgeReady && _bridgePeer && !_bridgePeer.closed) {
      _bridgeSend(_titleQueue.shift());
    }
  }

  function _bridgeOnMessage(evt) {
    var d = evt.data;
    if (!d || d.__crmBridge !== true) return;
    if (d.sessionId && _sessionId && d.sessionId !== _sessionId) return; // not our session
    // Adopt the peer handle + origin from the first valid inbound message.
    if (evt.source) _bridgePeer = evt.source;
    if (evt.origin && evt.origin !== 'null') _bridgeOrigin = evt.origin;

    if (d.kind === 'BRIDGE_HELLO') {
      _bridgeReady = true;
      try {
        _bridgePeer.postMessage({ __crmBridge: true, v: 1, kind: 'BRIDGE_ACK', sessionId: _sessionId }, _bridgeOrigin);
      } catch (e) { /* ignore */ }
      _bridgeFlush();
      _tickStatus();
      return; // the peer follows up with CRM_CLIENT_CONNECTED to trigger the flush
    }
    if (d.payload) _handleRelayMessage(d.payload);
  }

  function _bridgeStart() {
    if (_bridgeListening) return;
    _bridgeListening = true;
    window.addEventListener('message', _bridgeOnMessage);
    console.log('[crm-sync-header] transport = bridge (postMessage; no relay server)');
  }

  /* ── Inbound message handling (shared by relay + bridge transports) ──────── */

  function _handleRelayMessage(msg) {
    if (msg && msg.type === 'CRM_TAB_SELECTED' && msg.interactionId) {
      // The agent focused a CRM tab → ask panel-layout-headless to click the
      // matching task in the Desktop list. If the Desktop is ALREADY on this
      // task, do nothing (avoids a redundant click).
      //
      // We deliberately do NOT mutate _lastSelectedInteractionId here. When
      // the click lands, handleTaskSync() observes the new Desktop selection
      // and emits INTERACTION_SELECTED — which keeps the Tab Manager's own
      // authoritative _desktopSelectedId in sync. The loop is broken on the
      // Tab Manager side by per-id focus-echo suppression, not here.
      if (msg.interactionId !== _lastSelectedInteractionId) {
        try {
          var bc = new BroadcastChannel('crm-sync');
          bc.postMessage({ type: 'SELECT_INTERACTION', interactionId: msg.interactionId });
          bc.close();
        } catch (e) { /* BroadcastChannel unavailable */ }
      } else {
        console.log('[crm-sync-header] CRM_TAB_SELECTED already-selected — no click needed', msg.interactionId);
      }
    }

    if (msg && msg.type === 'CRM_CLIENT_CONNECTED') {
      // Tab Manager just (re)connected — re-send all active interactions so it
      // can rebuild its state without a full page reload.
      console.log('[crm-sync-header] CRM client connected — flushing', Object.keys(_activeInteractions).length, 'active interactions');
      // Also flush the current theme so the Tab Manager adopts the right mode.
      if (_darkMode !== null) {
        _relaySend({ type: 'THEME_CHANGED', darkMode: _darkMode });
      }
      Object.keys(_activeInteractions).forEach(function (interactionId) {
        var data = _activeInteractions[interactionId];
        if (data.state === 'ended') return;
        var msgType = data.state === 'wrapup' ? 'INTERACTION_WRAPUP' : 'INTERACTION_ARRIVED';
        _relaySend({ type: msgType, interactionId: interactionId, ani: data.ani,
          email: data.email, customerId: data.customerId, displayUrl: data.displayUrl, title: data.title, state: data.state });
        if (data.title) {
          _relaySend({ type: 'TASK_TITLE', interactionId: interactionId, title: data.title });
        }
      });
    }
  }

  function _relayConnect() {
    if (_transport === 'bridge') return; // bridge mode uses postMessage, not WebSocket
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
      try { _handleRelayMessage(JSON.parse(evt.data)); }
      catch (e) { /* ignore malformed messages */ }
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
    var _endedEntry = _activeInteractions[interactionId];
    delete _inWrapup[interactionId];
    delete _activeInteractions[interactionId];
    _clearEmailTouched(interactionId);
    _stopWrapupWatcher(interactionId);
    // Event-driven SLA check: a completed email may clear the critical pressure,
    // so re-evaluate focus immediately instead of waiting for the periodic tick.
    if (_endedEntry && String(_endedEntry.channel || '').toLowerCase() === 'email') {
      _slaCheckNow('email ended ' + interactionId);
    }
    console.log('[crm-sync-header] INTERACTION_ENDED via', source, 'for', interactionId);
    _relaySend({ type: 'INTERACTION_ENDED', interactionId: interactionId });
    // Activity analytics: close out the interaction's swim-lane. Emit focus_lost
    // first if the agent still had it focused, so time-on-task is bounded.
    if (_lastSelectedInteractionId === interactionId) {
      _emitActivity('focus_lost', {
        interactionId: interactionId, channel: _endedEntry && _endedEntry.channel,
      });
      _lastSelectedInteractionId = null;
    }
    _emitActivity('task_ended', {
      interactionId: interactionId, channel: _endedEntry && _endedEntry.channel,
    });
    _persistOpen();
    setTimeout(function () { delete _aqmEndedSent[interactionId]; }, 30000);
  }

  /* ── Reload reconciliation ───────────────────────────────────────────────
   * The set of open (accepted, not-yet-ended) interactions is persisted to
   * localStorage. When the widget reloads, in-memory tracking is lost, so any
   * task that ended DURING the reload gap would never emit task_ended and would
   * show as "still active" forever in the supervisor timeline. On load we
   * reconcile the persisted set against the Desktop's actual state and close out
   * the ones that are truly gone. */
  var _OPEN_KEY = 'wx_activity_open';

  function _persistOpen() {
    try {
      var map = {};
      Object.keys(_activeInteractions).forEach(function (id) {
        var e = _activeInteractions[id] || {};
        map[id] = { channel: e.channel || null, customerId: e.customerId || null };
      });
      localStorage.setItem(_OPEN_KEY, JSON.stringify(map));
    } catch (e) { /* quota / denied */ }
  }

  function _loadPersistedOpen() {
    try { return JSON.parse(localStorage.getItem(_OPEN_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  function _reconcileOnReload() {
    var persisted = _loadPersistedOpen();
    var ids = Object.keys(persisted || {});
    if (!ids.length) return;
    console.log('[crm-sync-header] reload reconcile: checking', ids.length, 'persisted open interaction(s)');
    // Give the Desktop time to re-apply the current task prop(s) and render the
    // task list before deciding an interaction is gone.
    setTimeout(function () {
      ids.forEach(function (id) {
        if (_activeInteractions[id]) return; // re-confirmed live by a fresh task prop
        var present = findInteractionItem(document.body, id); // still in the desktop task list?
        if (present) {
          // Genuinely still open — seed tracking so its real end is captured later.
          _activeInteractions[id] = {
            channel: persisted[id].channel || null,
            customerId: persisted[id].customerId || null,
            state: 'connected',
          };
          return;
        }
        // Neither re-sent nor present in the DOM → it ended during the reload gap.
        console.log('[crm-sync-header] reload reconcile: closing stale interaction', id);
        _sendInteractionEnded(id, 'reload-reconcile');
      });
      _persistOpen();
    }, 10000);
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

    // Auto-submit the configured wrap-up code for tasks we requeued, the moment
    // they enter wrap-up, so the requeue doesn't wait for a manual wrap-up.
    if (aqmContact.eAgentWrapup && typeof aqmContact.eAgentWrapup.listen === 'function') {
      aqmContact.eAgentWrapup.listen(function (msg) {
        try {
          var id = msg && msg.data && msg.data.interactionId;
          if (id && _rqAutoWrapupIds[id]) _rqSubmitWrapup(id, 0);
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
    if (!identity) { cb(null, null); return; }
    if (_isEmail(identity)) { cb(identity, null); return; }
    if (Object.prototype.hasOwnProperty.call(_emailCache, identity)) {
      cb(_emailCache[identity] || null, _nameCache[identity] || null); return;
    }
    if (!_accessToken || !_jdsWorkspaceId || !_jdsDataCenter) { cb(null, null); return; }
    var url = 'https://api-jds.wxdap-' + _jdsDataCenter +
              '.webex.com/admin/v1/api/person/workspace-id/' + _jdsWorkspaceId +
              '/aliases/' + encodeURIComponent(identity);
    fetch(url, { headers: { Authorization: 'Bearer ' + _accessToken } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var person = j && j.data && j.data[0];
        var email = person && Array.isArray(person.email) ? person.email[0] : null;
        var displayName = person
          ? (person.name || (((person.firstName || '') + (person.lastName ? ' ' + person.lastName : '')).trim()) || null)
          : null;
        _emailCache[identity] = email || '';
        _nameCache[identity] = displayName || '';
        if (email) console.log('[crm-sync-header] resolved customer email', email, 'for', identity);
        if (displayName) console.log('[crm-sync-header] resolved customer name', displayName, 'for', identity);
        cb(email || null, displayName || null);
      })
      .catch(function (e) {
        console.warn('[crm-sync-header] customer email lookup failed:', e && e.message);
        _emailCache[identity] = '';
        _nameCache[identity] = '';
        cb(null, null);
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
    var _slaExpiresAt = _extractSlaExpiry(parsed);
    var _isOutbound = (parsed.contactDirection || '').toUpperCase() === 'OUTBOUND' ||
                      (parsed.outboundType || '').toUpperCase() === 'OUTDIAL';

    // "email" CAD variable: collected by the IVR flow (e.g. for guest/unknown callers).
    // Used as the primary customer identity in place of ANI — both for JDS lookup and
    // for what is sent to CRM.
    var _cadEmail = (parsed.callAssociatedData && parsed.callAssociatedData.email &&
                     parsed.callAssociatedData.email.value) ||
                    (parsed.callAssociatedDetails && parsed.callAssociatedDetails.email) ||
                    null;

    // Compute the effective customer identity (_ani) used for JDS lookup and sent
    // to the Tab Manager / CRM:
    //   • workItem:        prefer CAD email, then CAD phone, then raw ANI
    //   • OUTBOUND voice:  customer number is DNIS (agent's outbound line ≠ customer)
    //   • INBOUND voice:   prefer "email" CAD variable over raw ANI (phone);
    //                      if no email CAD the raw phone ANI is used and JDS will
    //                      attempt to resolve an email from it.
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
          : (_cadEmail || _rawAni));

    // Explicit customer email sent alongside `ani` so the CRM URL template can
    // use {email} as an alternative lookup key to {ani}. Prefer the CAD email,
    // then the effective identity when it is itself an email address. When JDS
    // resolves an email below, this is upgraded to the resolved value.
    var _email = _isEmail(_cadEmail) ? _cadEmail
               : (_isEmail(_ani) ? _ani : null);

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
      var _prevSelected = _lastSelectedInteractionId;
      _lastSelectedInteractionId = parsed.interactionId;
      _relaySend({ type: 'INTERACTION_SELECTED', interactionId: parsed.interactionId });
      console.log('[crm-sync-header] INTERACTION_SELECTED for', parsed.interactionId);
      // Activity analytics: the agent switched focus. focus_lost on the previously
      // selected interaction (the interruption) + focus_gained on the new one.
      // Together these yield true time-on-task and interruption counts.
      if (_prevSelected) {
        var _prevEntry = _activeInteractions[_prevSelected];
        _emitActivity('focus_lost', {
          interactionId: _prevSelected,
          channel: _prevEntry && _prevEntry.channel,
        });
      }
      _emitActivity('focus_gained', {
        interactionId: parsed.interactionId,
        channel: _mediaType,
      });
    }

    // Dedup: skip if the interaction state hasn't changed from what we last sent.
    var _existing = _activeInteractions[parsed.interactionId];
    var _prevState = _existing ? _existing.state : null;
    if (_existing && _existing.state === _state && _state === 'connected') {
      // Recompute the SLA expiry every time: the `slavariable` property may have
      // been applied by the Desktop AFTER the first `task` prop, or the CAD may
      // have been updated. Without this the dedup short-circuit would keep a stale
      // (often null) slaExpiresAt and focus mode would never see a critical task.
      var _slaWasKnown = !!_existing.slaExpiresAt;
      if (_existing.slaExpiresAt !== _slaExpiresAt) {
        _existing.slaExpiresAt = _slaExpiresAt;
        console.log('[crm-sync-header] SLA (re)captured for', parsed.interactionId, '\u2192',
          _slaExpiresAt ? new Date(_slaExpiresAt).toISOString() : '(none)');
      }
      // Event-driven SLA check: engage focus immediately once the SLA becomes
      // known (the slavariable prop can arrive after the task prop).
      if (!_slaWasKnown && _existing.slaExpiresAt && _mediaType === 'email') {
        _slaCheckNow('SLA captured ' + parsed.interactionId);
      }
      // Still connected — just update the title if it changed, no need to resend ARRIVED.
      if (title && title !== _existing.title) {
        _existing.title = title;
        _relaySend({ type: 'TASK_TITLE', interactionId: parsed.interactionId, title: title });
      }
      return;
    }

    console.log('[crm-sync-header] sending', _msgType, 'for', parsed.interactionId);

    // Activity analytics: emit lifecycle transitions (state-change guarded so a
    // repeated task prop for the same state does not double-count).
    if (_state === 'connected' && _prevState !== 'connected') {
      _emitActivity('task_accepted', {
        interactionId: parsed.interactionId, channel: _mediaType,
      });
    } else if (_state === 'wrapup' && _prevState !== 'wrapup') {
      _emitActivity('wrapup', {
        interactionId: parsed.interactionId, channel: _mediaType,
      });
    }

    if (_state === 'ended') {
      delete _activeInteractions[parsed.interactionId];
      _sendInteractionEnded(parsed.interactionId, 'task-prop');
    } else {
      // Track the interaction synchronously so a rapid follow-up task prop hits
      // the dedup short-circuit above instead of triggering a second lookup/send.
      _activeInteractions[parsed.interactionId] = {
        ani: _ani, email: _email, customerId: parsed.customerId || null,
        displayUrl: _displayUrl, title: title || null, state: _state, channel: _mediaType,
        slaExpiresAt: _slaExpiresAt,
      };
      _persistOpen();
      if (_slaExpiresAt) {
        console.log('[crm-sync-header] SLA captured for', parsed.interactionId, '\u2192',
          new Date(_slaExpiresAt).toISOString());
      } else if (_slaVariable) {
        console.log('[crm-sync-header] no SLA value in CAD for', parsed.interactionId, '(var', _slaVariable + ')');
      }
      // Event-driven SLA check on an email lifecycle transition (accept / wrapup),
      // so the agent state flips without waiting for the next periodic tick.
      if (_mediaType === 'email' && _state !== _prevState) {
        _slaCheckNow('email ' + _state + ' ' + parsed.interactionId);
      }
      // Resolve a unified customer email (preferred over phone) so voice and
      // email interactions for the same person share a single CRM tab. The
      // ARRIVED/WRAPUP message is sent only once resolution completes, to avoid
      // the Tab Manager opening a second tab keyed on the raw phone number.
      // _ani already carries the CAD email for inbound voice (when available),
      // so _resolveCustomerEmail short-circuits immediately without a JDS call.
      _resolveCustomerEmail(_ani, function (resolvedEmail, resolvedName) {
        var _customerId = resolvedEmail || parsed.customerId || null;
        var _finalEmail = resolvedEmail || _email || null;
        var _resolvedTitle = title || resolvedName || null;
        var _entry = _activeInteractions[parsed.interactionId];
        if (_entry) {
          _entry.customerId = _customerId;
          _entry.email = _finalEmail;
          if (!_entry.title && _resolvedTitle) _entry.title = _resolvedTitle;
        }
        _relaySend({
          type: _msgType,
          interactionId: parsed.interactionId,
          ani: _ani,
          email: _finalEmail,
          customerId: _customerId,
          displayUrl: _displayUrl,
          title: _resolvedTitle,
          state: _state,
        });
        // If we derived the title from JDS (no CAD title), also send TASK_TITLE
        // so existing tab-manager entries get the name even if ARRIVED was already received.
        if (!title && _resolvedTitle) {
          _relaySend({ type: 'TASK_TITLE', interactionId: parsed.interactionId, title: _resolvedTitle });
        }
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
    var connected = (_transport === 'bridge')
      ? (_bridgeReady && _bridgePeer && !_bridgePeer.closed)
      : (_relayReady && _relayWs && _relayWs.readyState === WebSocket.OPEN);

    if (dot) {
      dot.className = 'dot ' + (connected ? 'dot--connected' : 'dot--disconnected');
      dot.title = connected ? 'Relay connected' : 'Relay disconnected';
    }
    if (btn) {
      var winOpen = _crmTabManagerWindow && !_crmTabManagerWindow.closed;
      btn.title = winOpen ? _t('focusCrm') : _t('openCrm');
    }
  }

  // Apply the light/dark theme class to the header pill (called on darkmode change).
  function _applyPillTheme() {
    if (!_shadowRoot) return;
    var pill = _shadowRoot.getElementById('pill');
    if (!pill) return;
    if (_darkMode) pill.classList.add('md--dark');
    else pill.classList.remove('md--dark');
  }

  /* ── SLA focus-mode + end-of-shift controller ───────────────────────────── */
  //
  // Central, cross-task watcher. Evaluates every active interaction's SLA and,
  // per the agent's focus settings (configured in the CRM Tab Manager, synced
  // over the relay), moves the agent to Not Available while ANY task is
  // SLA-critical so no NEW tasks route — returning to Available when the
  // pressure clears. Also handles the manual "End shift" action: requeue every
  // pending SLA-critical task. This supersedes the old per-task controller that
  // lived inside the Customer360 widget.

  var _slaVariable      = '';    // CAD var holding SLA epoch-ms (via `slavariable` prop)
  var _slaThresholdMin  = 15;    // imminent window in minutes (via `slathresholdminutes` prop)
  var _focusSettings    = null;  // { enabled, triggerOn, idleCode:{id,name} } — from Tab Manager / LS
  var _slaAgentState    = null;  // last known { subStatus, auxCodeId } from eAgentStateChangeSuccess
  var _focusEngaged     = false; // we moved the agent to Not Available
  var _focusOverride    = false; // agent manually left our Not Available → stop managing
  var _focusAuxId       = null;  // aux code id we set (to recognise our own change)
  var _focusChannels    = null;  // channel types we set Not Available on (for release)
  var _slaTickTimer     = null;
  var _slaAgentListenerReady = false;
  var _slaDbgTs         = 0;     // throttle for the focus-tick diagnostic log
  var _focusEngageInFlight = false;
  var _focusEngageFailedTs = 0;
  var _focusFallbackTimer  = null;
  var _syncListenBc        = null;
  var _endShiftActive      = false; // agent ended shift → suppress focus auto-manage
  var _touchedEmailIds     = null;  // { [interactionId]: true } — emails the agent has drafted
  // Centralized SLA requeue (offer/auto) state — covers ALL eligible email tasks.
  var _rqOfferEl        = null;
  var _rqShownIds       = {};   // eligible ids already presented (to detect new ones)
  var _rqSel            = {};    // id → checkbox selection in the offer
  var _rqDismissed      = false; // agent dismissed the offer; reopen only on a new task
  var _rqRenderedKey    = '';
  var _rqToastEl        = null;
  var _rqAutoTimer      = null;
  var _rqAutoSecs       = 0;
  var _rqAutoActive     = false;
  var _rqAutoDismissed  = false;
  var _rqManualOpen     = false; // agent opened the requeue dialog from the header button
  var _rqAutoWrapupIds  = {};    // ids we requeued that still need the configured wrap-up auto-submitted

  var FOCUS_LS_PREFIX    = 'wx_c360_focus_';
  var SETTINGS_LS_PREFIX = 'wx_c360_settings_';
  var CATALOG_LS_PREFIX  = 'wx_c360_catalog_';
  var TOUCHED_LS_PREFIX  = 'wx_c360_email_touched_';

  function _lsRead(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function _lsWrite(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val || {})); } catch (e) { /* quota/denied */ }
  }
  function _agentKey(prefix) { return prefix + (_agentId || 'anon'); }

  // Focus settings: prefer the live relayed value, else the watcher-owned LS key.
  function _getFocusSettings() {
    if (_focusSettings) return _focusSettings;
    return _lsRead(_agentKey(FOCUS_LS_PREFIX));
  }

  // The idle-code / queue catalog + requeue settings live in React-owned keys.
  function _getCatalog()  { return _lsRead(_agentKey(CATALOG_LS_PREFIX))  || { idleCodes: [], queues: [] }; }
  function _getRequeueQueue() {
    var s = _lsRead(_agentKey(SETTINGS_LS_PREFIX));
    return (s && s.sla && s.sla.queues && s.sla.queues.email) || null;
  }

  // "Touched" (draft) email tracking. The React email widget latches a task as
  // touched once the agent drafts a reply and broadcasts EMAIL_TOUCHED on the
  // 'crm-sync' channel; we persist the set so it survives a header reload.
  function _getTouchedEmailIds() {
    if (!_touchedEmailIds) _touchedEmailIds = _lsRead(_agentKey(TOUCHED_LS_PREFIX)) || {};
    return _touchedEmailIds;
  }
  function _markEmailTouched(id) {
    if (!id) return;
    var m = _getTouchedEmailIds();
    if (!m[id]) { m[id] = true; _lsWrite(_agentKey(TOUCHED_LS_PREFIX), m); }
  }
  function _clearEmailTouched(id) {
    if (!id) return;
    var m = _getTouchedEmailIds();
    if (m[id]) { delete m[id]; _lsWrite(_agentKey(TOUCHED_LS_PREFIX), m); }
  }

  function _extractSlaExpiry(parsed) {
    if (!_slaVariable) return null;
    var cad  = parsed.callAssociatedData || {};
    var cad2 = parsed.callAssociatedDetails || {};
    var raw = (cad[_slaVariable] && cad[_slaVariable].value) || cad2[_slaVariable] || null;
    if (raw == null || raw === '') return null;
    var n = Number(raw);
    if (isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n; // seconds → ms if needed
    var d = Date.parse(raw);
    return isNaN(d) ? null : d;
  }

  function _svc() {
    var svc;
    try { svc = (typeof AGENTX_SERVICE !== 'undefined') ? AGENTX_SERVICE : null; } catch (e) { svc = null; }
    return svc || window.AGENTX_SERVICE || null;
  }
  function _aqmAgent()   { var s = _svc(); return (s && s.isInited && s.aqm && s.aqm.agent) ? s.aqm.agent : null; }
  function _aqmContact() { var s = _svc(); return (s && s.isInited && s.aqm && s.aqm.contact) ? s.aqm.contact : null; }

  function _statusIsNotAvailable(sub) {
    var s = String(sub || '').toLowerCase();
    return s.indexOf('idle') !== -1 || s.indexOf('notavail') !== -1 ||
           s.indexOf('not_avail') !== -1 || s.indexOf('unavail') !== -1;
  }

  // Any active interaction SLA-critical for the given trigger?
  function _hasCriticalTask(triggerOn) {
    var now = Date.now();
    var thMs = (_slaThresholdMin || 0) * 60000;
    var ids = Object.keys(_activeInteractions);
    for (var i = 0; i < ids.length; i++) {
      var e = _activeInteractions[ids[i]];
      if (!e || e.state === 'ended' || !e.slaExpiresAt) continue;
      var triggerAt = triggerOn === 'expired' ? e.slaExpiresAt : (e.slaExpiresAt - thMs);
      if (now >= triggerAt) return true;
    }
    return false;
  }

  // Ask the Customer360 widget (which has the fully-initialized Desktop SDK) to
  // change the agent state. The header widget's raw AGENTX_SERVICE.aqm.agent
  // call is unreliable from a third-party header context, so we delegate over the
  // shared 'crm-sync' BroadcastChannel and fall back to the raw call if no reply.
  function _postSync(msg) {
    try { var bc = new BroadcastChannel('crm-sync'); bc.postMessage(msg); bc.close(); } catch (e) { /* ignore */ }
  }
  // Channel set for the state change. 'realtime' = interruptive channels only
  // (voice, chat, custom messaging); 'all' = every routable channel.
  function _channelsFor(mode) {
    return (mode === 'realtime')
      ? ['telephony', 'chat', 'customMessaging']
      : ['telephony', 'chat', 'email', 'social', 'workItem', 'customMessaging'];
  }
  function _requestAgentState(state, auxId, name, channelType) {
    _postSync({ type: 'FOCUS_STATE', state: state, auxCodeId: auxId, name: name || '', channelType: channelType || null });
  }

  // Listen for the Customer360 result so we know whether the change succeeded.
  // Merge the full open-task list (from React's Desktop.actions.getTaskMap poll)
  // so the requeue/focus checks cover EVERY task, not just the focused one the
  // Desktop pushes via the `task` prop. Map-sourced entries are marked _fromMap
  // and never overwrite a real entry built by handleTaskSync.
  function _mergeTaskMap(tasks) {
    var present = {}, i, t, id, e;
    for (i = 0; i < tasks.length; i++) {
      t = tasks[i];
      if (!t || !t.interactionId) continue;
      id = t.interactionId; present[id] = true;
      e = _activeInteractions[id];
      if (e && !e._fromMap) { if (t.slaExpiresAt && e.slaExpiresAt !== t.slaExpiresAt) e.slaExpiresAt = t.slaExpiresAt; continue; }
      if (!e) {
        _activeInteractions[id] = {
          ani: t.email || null, email: t.email || null, customerId: t.email || null,
          displayUrl: null, title: t.title || t.email || null, state: 'connected',
          channel: String(t.channel || '').toLowerCase(), slaExpiresAt: t.slaExpiresAt || null, _fromMap: true,
        };
      } else {
        e.slaExpiresAt = t.slaExpiresAt || e.slaExpiresAt;
        if (t.title) e.title = t.title;
        e.channel = String(t.channel || '').toLowerCase();
        e.email = t.email || e.email;
      }
    }
    // Drop map-only tasks that are no longer open (ended / requeued elsewhere).
    Object.keys(_activeInteractions).forEach(function (aid) {
      var a = _activeInteractions[aid];
      if (a && a._fromMap && !present[aid]) delete _activeInteractions[aid];
    });
    _slaCheckNow('task-map');
  }

  function _initFocusResultListener() {
    if (_syncListenBc) return;
    try {
      _syncListenBc = new BroadcastChannel('crm-sync');
      _syncListenBc.onmessage = function (e) {
        var d = e && e.data;
        if (!d) return;
        if (d.type === 'EMAIL_TOUCHED' && d.interactionId) { _markEmailTouched(d.interactionId); return; }
        if (d.type === 'TASK_MAP' && d.tasks) { _mergeTaskMap(d.tasks); return; }
        if (d.type === 'CATALOG_UPDATED') {
          // Fresh catalog written by React — refresh the open panel's queue list,
          // preserving the current selection and any in-progress filter text.
          if (_slaPanelEl && _slaPanelEl.style.display !== 'none') {
            var cat = _getCatalog();
            _slaFillQueue(_mergeQueues(cat.queues || [], _queueItems), _queueSelId);
            _slaFill(_slaRefs.focusIdle, _t('selectReason'), cat.idleCodes,
              _slaRefs.focusIdle ? _slaRefs.focusIdle.value : '');
            _slaFill(_slaRefs.rqWrapup, _t('selectWrapup'), cat.wrapUpCodes,
              _slaRefs.rqWrapup ? _slaRefs.rqWrapup.value : '');
            if (_queueIsOpen()) { _queuePosition(); _queueRender(_queueFiltered(_slaRefs.rqQueueSearch ? _slaRefs.rqQueueSearch.value : '')); }
          }
          return;
        }
        if (d.type !== 'FOCUS_STATE_RESULT') return;
        clearTimeout(_focusFallbackTimer);
        _focusEngageInFlight = false;
        if (d.ok) {
          if (d.state === 'Idle') { _focusEngaged = true; console.log('[crm-sync-header] focus: Not Available applied via Customer360'); }
          else { console.log('[crm-sync-header] focus: Available applied via Customer360'); }
        } else {
          _focusEngageFailedTs = Date.now();
          console.warn('[crm-sync-header] focus: Customer360 stateChange failed:', d.error);
        }
      };
    } catch (e) { /* ignore */ }
  }

  function _focusEngage(idleCode) {
    // Never override a Not Available the agent set themselves.
    if (_slaAgentState && _statusIsNotAvailable(_slaAgentState.subStatus)) return;
    if (_focusEngageInFlight) return;
    if (Date.now() - _focusEngageFailedTs < 30000) return; // back off after a failure
    // Resolve a VALID (non-system) idle code. A stale selection (e.g. a system
    // code that no longer appears in the catalog) is self-healed to the default.
    var codes = (_getCatalog().idleCodes) || [];
    var chosen = null;
    if (idleCode && idleCode.id) {
      for (var i = 0; i < codes.length; i++) {
        if (String(codes[i].id) === String(idleCode.id)) { chosen = codes[i]; break; }
      }
    }
    if (!chosen) {
      for (var j = 0; j < codes.length; j++) { if (codes[j].isDefault) { chosen = codes[j]; break; } }
      if (!chosen) chosen = codes[0] || null;
      if (chosen) {
        console.warn('[crm-sync-header] focus: configured idle code invalid/stale — using',
          chosen.name, '(' + chosen.id + ')');
      }
    }
    if (!chosen) { console.warn('[crm-sync-header] focus: no valid idle code available — pick a Not Available reason in the SLA panel'); return; }
    var auxId = String(chosen.id);
    _focusAuxId = auxId;
    _focusChannels = _channelsFor((_getFocusSettings() || {}).channels);
    _focusEngageInFlight = true;
    // Primary: delegate to Customer360. Fallback: raw aqm call if no reply in 6s.
    _requestAgentState('Idle', auxId, chosen.name, _focusChannels);
    clearTimeout(_focusFallbackTimer);
    _focusFallbackTimer = setTimeout(function () { _stateChangeDirect('Idle', auxId, _focusChannels); }, 2500);
  }

  function _focusRelease() {
    var wasEngaged = _focusEngaged;
    _focusEngaged = false;
    _focusAuxId = null;
    if (!wasEngaged || _focusOverride) return; // agent already took control
    var channels = _focusChannels || _channelsFor((_getFocusSettings() || {}).channels);
    console.log('[crm-sync-header] focus: releasing → Available (no more SLA-critical tasks)');
    _requestAgentState('Available', '0', '', channels);
    clearTimeout(_focusFallbackTimer);
    // Short fallback: on release the task is gone and the Customer360 delegate is
    // often already unmounted, so fall through to the direct state change quickly.
    _focusFallbackTimer = setTimeout(function () { _stateChangeDirect('Available', '0', channels); }, 1500);
  }

  // Fallback path: change state directly via the raw routing service (prefer the
  // channel-based stateChangeV2 required by granular-state-control orgs).
  function _stateChangeDirect(state, auxId, channelType) {
    var agent = _aqmAgent();
    if (!agent) {
      _focusEngageInFlight = false;
      if (state === 'Idle') _focusEngageFailedTs = Date.now();
      console.warn('[crm-sync-header] focus: no Customer360 reply and aqm.agent unavailable for', state);
      return;
    }
    var channels = (channelType && channelType.length) ? channelType : ['telephony', 'chat', 'email', 'social'];
    console.log('[crm-sync-header] focus: no Customer360 reply — trying direct', state, channels.join('+'));
    var call;
    if (typeof agent.stateChangeV2 === 'function') {
      call = agent.stateChangeV2({ data: { state: state, auxCodeId: auxId, channelType: channels } });
    } else if (typeof agent.stateChange === 'function') {
      call = agent.stateChange({ data: { state: state, auxCodeIdArray: auxId, lastStateChangeReason: 'SLA focus mode' } });
    } else {
      _focusEngageInFlight = false;
      if (state === 'Idle') _focusEngageFailedTs = Date.now();
      return;
    }
    Promise.resolve(call).then(function (res) {
      _focusEngageInFlight = false;
      if (state === 'Idle') _focusEngaged = true;
      console.log('[crm-sync-header] focus: ' + state + ' applied (direct)', res);
    }).catch(function (err) {
      _focusEngageInFlight = false;
      if (state === 'Idle') _focusEngageFailedTs = Date.now();
      var detail; try { detail = JSON.stringify(err); } catch (e) { detail = String(err); }
      console.warn('[crm-sync-header] focus: direct stateChange ' + state + ' failed | err=', err, '| detail=', detail);
    });
  }

  // Event-driven SLA re-check: run the focus tick immediately on an email task
  // lifecycle change (accept / SLA-captured / complete) so the agent state flips
  // with minimal delay. Cheap + idempotent (_slaTick self-guards focus enabled,
  // end-shift, in-flight and cooldown).
  function _slaCheckNow(reason) {
    console.log('[crm-sync-header] SLA event-driven check —', reason);
    try { _slaTick(); } catch (e) { /* ignore */ }
  }

  function _slaTick() {
    if (_endShiftActive) return; // end-shift latched Not Ready — leave the agent alone
    var focus = _getFocusSettings();
    if (!focus || !focus.enabled) {
      if (_focusEngaged) _focusRelease();
      _focusOverride = false;
    } else {
      var critical = _hasCriticalTask(focus.triggerOn || 'imminent');
      var now = Date.now();
      if (now - _slaDbgTs > 30000) {
        _slaDbgTs = now;
        console.log('[crm-sync-header] focus tick | enabled | trigger=', focus.triggerOn || 'imminent',
          '| critical=', critical, '| engaged=', _focusEngaged, '| override=', _focusOverride,
          '| tasks=', _slaDbgSummary());
      }
      if (critical && !_focusEngaged && !_focusOverride) {
        _focusEngage(focus.idleCode || null);
      } else if (!critical) {
        if (_focusEngaged) _focusRelease();
        _focusOverride = false; // pressure cleared → fresh slate for next time
      }
    }
    _rqTick(); // requeue offer/auto is independent of focus mode
  }

  function _slaDbgSummary() {
    var ids = Object.keys(_activeInteractions);
    if (!ids.length) return '(no active tasks)';
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var e = _activeInteractions[ids[i]];
      out.push(ids[i].slice(0, 8) + ':' + (e.slaExpiresAt ? new Date(e.slaExpiresAt).toISOString() : 'no-sla') + '/' + e.state);
    }
    return out.join(', ');
  }

  // ── Centralized SLA requeue: offer / auto for ALL eligible email tasks ──────
  // Runs on every periodic tick and event-driven check, independent of focus
  // mode, so eligible tasks are presented whether or not the agent has them open.
  function _rqSettings() {
    var s = _lsRead(_agentKey(SETTINGS_LS_PREFIX)) || {};
    return s.sla || {};
  }
  function _rqEligible() {
    var sla = _rqSettings();
    var triggerOn = sla.triggerOn || 'imminent';
    var thMs = (_slaThresholdMin || 0) * 60000;
    var touched = _getTouchedEmailIds();
    var now = Date.now();
    var out = [];
    var ids = Object.keys(_activeInteractions);
    for (var i = 0; i < ids.length; i++) {
      var e = _activeInteractions[ids[i]];
      if (!e || e.state === 'ended' || !e.slaExpiresAt) continue;
      if (String(e.channel || '').toLowerCase() !== 'email') continue;
      if (touched[ids[i]]) continue; // agent already started it → not requeue-eligible
      var triggerAt = triggerOn === 'expired' ? e.slaExpiresAt : (e.slaExpiresAt - thMs);
      if (now >= triggerAt) out.push({ id: ids[i], title: _bestTitle(e), slaExpiresAt: e.slaExpiresAt });
    }
    out.sort(function (a, b) { return a.slaExpiresAt - b.slaExpiresAt; });
    return out;
  }
  function _rqSlaLabel(exp) {
    if (!exp) return '';
    var ms = exp - Date.now();
    if (ms <= 0) return _t('rqOverdue');
    var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return (m > 0 ? m + 'm ' : '') + s + 's';
  }
  // Prefer a real name over a bare email — and, for same-sender tasks, reuse a
  // name another task already resolved so identities are consistent in the offer.
  function _bestTitle(e) {
    var title = e.title || e.email || e.customerId || '';
    if (title && title.indexOf('@') !== -1 && e.email) {
      var ids = Object.keys(_activeInteractions);
      for (var i = 0; i < ids.length; i++) {
        var o = _activeInteractions[ids[i]];
        if (o && o !== e && String(o.email || '').toLowerCase() === String(e.email).toLowerCase()) {
          if (o.title && o.title.indexOf('@') === -1) return o.title;
        }
      }
    }
    return title;
  }
  function _rqRequeueOne(id) {
    var q = _getRequeueQueue();
    var contact = _aqmContact();
    if (!q || !q.vteamId || !contact || typeof contact.vteamTransfer !== 'function') return Promise.resolve(false);
    return Promise.resolve(contact.vteamTransfer({ interactionId: id, data: { vteamId: q.vteamId, vteamType: q.vteamType || 'inboundqueue' } }))
      .then(function () {
        console.log('[crm-sync-header] SLA requeue: transferred', id, '→', q.vteamId);
        _rqAutoWrapupIds[id] = true;
        _rqSubmitWrapup(id, 0); // the transfer drops the task into wrap-up
        return true;
      })
      .catch(function (err) { console.warn('[crm-sync-header] SLA requeue failed for', id, err && err.message); return false; });
  }
  function _rqRequeue(id) { _rqRequeueOne(id); return true; }
  // Requeue ids one after another — firing several transfers/wrap-ups at once can
  // stall the platform, so process sequentially.
  function _rqProcessQueue(ids, i) {
    if (!ids || i >= ids.length) return;
    _rqRequeueOne(ids[i]).then(function () { setTimeout(function () { _rqProcessQueue(ids, i + 1); }, 500); });
  }
  // Configured wrap-up reason (auto-submitted on requeue so the task doesn't wait).
  function _rqWrapup() {
    var s = _lsRead(_agentKey(SETTINGS_LS_PREFIX));
    return (s && s.sla && s.sla.wrapUp) || null;
  }
  function _rqSubmitWrapup(id, attempt) {
    if (!_rqAutoWrapupIds[id]) return;
    var wrap = _rqWrapup();
    var contact = _aqmContact();
    if (!wrap || !wrap.auxCodeId) { console.warn('[crm-sync-header] auto-wrapup: no wrap-up reason configured'); return; }
    if (!contact || typeof contact.wrapup !== 'function') return;
    Promise.resolve(contact.wrapup({ interactionId: id, data: {
      wrapUpReason: wrap.name || 'Auto wrap-up', auxCodeId: String(wrap.auxCodeId), isAutoWrapup: 'false',
    } })).then(function () {
      console.log('[crm-sync-header] auto-wrapup submitted for', id, '(' + (wrap.name || wrap.auxCodeId) + ')');
      delete _rqAutoWrapupIds[id];
    }).catch(function (err) {
      attempt = attempt || 0;
      if (attempt < 8) { setTimeout(function () { _rqSubmitWrapup(id, attempt + 1); }, 1500); } // task may not be in wrap-up yet
      else { delete _rqAutoWrapupIds[id]; console.warn('[crm-sync-header] auto-wrapup failed for', id, err && err.message); }
    });
  }

  function _rqBuildOffer() {
    if (_rqOfferEl) return;
    _injectSlaStyles();
    var el = document.createElement('div');
    el.className = 'wxsla-dialog' + (_darkMode ? ' md--dark' : '');
    el.style.display = 'none';
    document.body.appendChild(el);
    _rqOfferEl = el;
    // Manual (button-opened) dialog closes on an outside click, like the settings panel.
    document.addEventListener('mousedown', function (e) {
      if (!_rqManualOpen || !_rqOfferEl || _rqOfferEl.style.display === 'none') return;
      var path = (e.composedPath && e.composedPath()) || [];
      if (path.indexOf(_rqOfferEl) !== -1) return; // inside the dialog
      var btn = _shadowRoot && _shadowRoot.getElementById('requeue-btn');
      if (btn && path.indexOf(btn) !== -1) return; // the button toggles it
      _rqCloseOffer(false);
    });
  }
  function _rqCloseOffer(dismissed) {
    if (dismissed) _rqDismissed = true;
    _rqManualOpen = false;
    if (_rqOfferEl) _rqOfferEl.style.display = 'none';
    _rqRenderedKey = '';
  }
  function _rqOpenOffer(eligible) {
    _rqBuildOffer();
    var q = _getRequeueQueue();
    var hasQueue = !!(q && q.vteamId);
    var rows = '';
    for (var i = 0; i < eligible.length; i++) {
      var t = eligible[i];
      rows += '<label class="wxrq-row"><input type="checkbox" class="wxrq-cb" data-id="' + _slaEsc(t.id) + '"' + (_rqSel[t.id] ? ' checked' : '') + '>'
        + '<span class="wxrq-title" title="' + _slaEsc(t.title) + '">' + _slaEsc(t.title) + '</span>'
        + '<span class="wxrq-sla">' + _slaEsc(_rqSlaLabel(t.slaExpiresAt)) + '</span></label>';
    }
    _rqOfferEl.innerHTML = [
      '<div class="wxsla-h">' + _slaEsc(_t('rqOfferTitle')) + '</div>',
      '<p>' + _slaEsc(_t('rqOfferMsg')) + '</p>',
      '<div class="wxrq-list">' + (rows || '<div class="wxrq-row" style="justify-content:center;opacity:.6;">—</div>') + '</div>',
      hasQueue ? '' : '<p class="wxrq-warn">' + _slaEsc(_t('rqNoQueue')) + '</p>',
      '<div class="wxsla-actions"><button id="wxrq-dismiss" class="wxsla-btn">' + _slaEsc(_t('rqDismiss')) + '</button>',
      '<button id="wxrq-go" class="wxsla-btn wxsla-btn--primary"' + (hasQueue ? '' : ' disabled') + '>' + _slaEsc(_t('rqRequeueSelected')) + '</button></div>',
    ].join('');
    var cbs = _rqOfferEl.querySelectorAll('.wxrq-cb');
    for (var c = 0; c < cbs.length; c++) {
      (function (cb) { cb.addEventListener('change', function () { _rqSel[cb.getAttribute('data-id')] = cb.checked; }); })(cbs[c]);
    }
    _rqOfferEl.querySelector('#wxrq-dismiss').addEventListener('click', function () { _rqCloseOffer(true); });
    var go = _rqOfferEl.querySelector('#wxrq-go');
    if (go && hasQueue) go.addEventListener('click', _rqRequeueSelected);
    _rqOfferEl.className = 'wxsla-dialog' + (_darkMode ? ' md--dark' : '');
    _rqOfferEl.style.display = 'block';
  }
  function _rqRequeueSelected() {
    var ids = [];
    Object.keys(_rqSel).forEach(function (id) { if (_rqSel[id] && _activeInteractions[id]) ids.push(id); });
    for (var i = 0; i < ids.length; i++) { delete _rqSel[ids[i]]; delete _rqShownIds[ids[i]]; }
    _rqCloseOffer(true);
    _rqProcessQueue(ids, 0); // process all selected, one after another
  }
  // All open, not-yet-started email tasks (for the manual header button), newest
  // SLA first; tasks without an SLA sort last.
  function _rqAllEmailTasks() {
    var touched = _getTouchedEmailIds();
    var out = [], ids = Object.keys(_activeInteractions);
    for (var i = 0; i < ids.length; i++) {
      var e = _activeInteractions[ids[i]];
      if (!e || e.state === 'ended') continue;
      if (String(e.channel || '').toLowerCase() !== 'email') continue;
      if (touched[ids[i]]) continue;
      out.push({ id: ids[i], title: _bestTitle(e), slaExpiresAt: e.slaExpiresAt || 0 });
    }
    out.sort(function (a, b) { return (a.slaExpiresAt || Infinity) - (b.slaExpiresAt || Infinity); });
    return out;
  }
  function _rqOpenManual() {
    if (_rqManualOpen && _rqOfferEl && _rqOfferEl.style.display !== 'none') { _rqCloseOffer(false); return; }
    if (_slaPanelEl) _slaPanelEl.style.display = 'none';
    if (_slaConfirmEl) _slaConfirmEl.style.display = 'none';
    _rqManualOpen = true;
    _rqRenderedKey = '__init__';
    _rqRefreshOpen(_rqAllEmailTasks());
  }
  // Keep an OPEN dialog in sync with the given task list: prune gone tasks, add
  // new ones (pre-checking those past their trigger), and re-render on change so
  // an empty dialog picks up a newly eligible task.
  function _rqRefreshOpen(tasks) {
    var present = {}, i;
    for (i = 0; i < tasks.length; i++) present[tasks[i].id] = true;
    Object.keys(_rqShownIds).forEach(function (id) { if (!present[id]) { delete _rqShownIds[id]; delete _rqSel[id]; } });
    var sla = _rqSettings(), triggerOn = sla.triggerOn || 'imminent', thMs = (_slaThresholdMin || 0) * 60000, now = Date.now();
    for (i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      if (!(t.id in _rqSel)) { _rqSel[t.id] = !!(t.slaExpiresAt && now >= (triggerOn === 'expired' ? t.slaExpiresAt : t.slaExpiresAt - thMs)); }
      _rqShownIds[t.id] = true;
    }
    var key = tasks.map(function (x) { return x.id; }).sort().join('|');
    if (key === _rqRenderedKey) return;
    _rqRenderedKey = key;
    _rqOpenOffer(tasks);
  }
  function _rqOfferTick(eligible) {
    var eligIds = {}, newIds = false, i, id;
    for (i = 0; i < eligible.length; i++) { eligIds[eligible[i].id] = true; if (!_rqShownIds[eligible[i].id]) newIds = true; }
    Object.keys(_rqShownIds).forEach(function (sid) { if (!eligIds[sid]) { delete _rqShownIds[sid]; delete _rqSel[sid]; } });
    if (!eligible.length) { _rqDismissed = false; _rqCloseOffer(false); return; }
    for (i = 0; i < eligible.length; i++) { id = eligible[i].id; if (!(id in _rqSel)) _rqSel[id] = true; _rqShownIds[id] = true; }
    if (newIds) _rqDismissed = false; // a newly eligible task re-presents the offer
    var isOpen = _rqOfferEl && _rqOfferEl.style.display !== 'none';
    if (_rqDismissed && !isOpen) return;
    var key = eligible.map(function (t) { return t.id; }).sort().join('|');
    if (isOpen && key === _rqRenderedKey) return; // set unchanged → keep current dialog
    _rqRenderedKey = key;
    _rqOpenOffer(eligible);
  }

  function _rqBuildToast() {
    if (_rqToastEl) return;
    _injectSlaStyles();
    var el = document.createElement('div');
    el.className = 'wxrq-toast';
    el.style.display = 'none';
    document.body.appendChild(el);
    _rqToastEl = el;
  }
  function _rqShowToast(n, secs) {
    _rqBuildToast();
    var msg = _t('rqAutoMsg').replace('{n}', String(n)).replace('{s}', String(secs));
    _rqToastEl.innerHTML = '<span>' + _slaEsc(msg) + '</span><button id="wxrq-cancel">' + _slaEsc(_t('cancel')) + '</button>';
    _rqToastEl.querySelector('#wxrq-cancel').addEventListener('click', function () { _rqCancelAuto(true); });
    _rqToastEl.style.display = 'flex';
  }
  function _rqCancelAuto(dismissed) {
    if (_rqAutoTimer) { clearInterval(_rqAutoTimer); _rqAutoTimer = null; }
    _rqAutoActive = false;
    if (dismissed) _rqAutoDismissed = true;
    if (_rqToastEl) _rqToastEl.style.display = 'none';
  }
  function _rqSyncShown(eligible) {
    var eligIds = {};
    for (var i = 0; i < eligible.length; i++) { eligIds[eligible[i].id] = true; _rqShownIds[eligible[i].id] = true; }
    Object.keys(_rqShownIds).forEach(function (id) { if (!eligIds[id]) delete _rqShownIds[id]; });
  }
  function _rqAutoTick(eligible) {
    var q = _getRequeueQueue();
    if (!eligible.length || !(q && q.vteamId)) { _rqCancelAuto(false); _rqAutoDismissed = false; return; }
    if (_rqAutoDismissed) {
      var grew = false;
      for (var i = 0; i < eligible.length; i++) { if (!_rqShownIds[eligible[i].id]) grew = true; }
      _rqSyncShown(eligible);
      if (!grew) return; // stay dismissed until a new task becomes eligible
      _rqAutoDismissed = false;
    }
    _rqSyncShown(eligible);
    if (_rqAutoActive) return;
    _rqAutoActive = true;
    _rqAutoSecs = _rqSettings().autoCountdownSec || 15;
    _rqShowToast(eligible.length, _rqAutoSecs);
    _rqAutoTimer = setInterval(function () {
      _rqAutoSecs--;
      var elig = _rqEligible();
      if (!elig.length) { _rqCancelAuto(false); return; }
      if (_rqAutoSecs <= 0) {
        _rqCancelAuto(false);
        _rqProcessQueue(elig.map(function (t) { return t.id; }), 0);
      } else {
        _rqShowToast(elig.length, _rqAutoSecs);
      }
    }, 1000);
  }

  function _rqTick() {
    if (_rqManualOpen) {
      // Keep the manually-opened dialog live (empty list picks up new tasks).
      if (_rqOfferEl && _rqOfferEl.style.display !== 'none') _rqRefreshOpen(_rqAllEmailTasks());
      else _rqManualOpen = false;
      return;
    }
    var action = _rqSettings().action || 'none';
    if (action === 'none' || _endShiftActive) {
      _rqCloseOffer(false); _rqCancelAuto(false);
      _rqDismissed = false; _rqAutoDismissed = false;
      return;
    }
    var eligible = _rqEligible();
    if (action === 'auto') { _rqCloseOffer(false); _rqAutoTick(eligible); }
    else { _rqCancelAuto(false); _rqOfferTick(eligible); }
  }

  // End-of-shift: requeue every NEW (untouched) email task to the configured
  // email queue, then set the agent to the configured Not Ready state on ALL
  // channels so no new interactions route while they finish their current work.
  function _endShiftRequeue() {
    var queue = _getRequeueQueue();
    var contact = _aqmContact();
    var touched = _getTouchedEmailIds();
    var canRequeue = !!(contact && typeof contact.vteamTransfer === 'function' && queue && queue.vteamId);
    var ids = Object.keys(_activeInteractions);
    var toRequeue = [];
    var skipped = 0;
    ids.forEach(function (id) {
      var e = _activeInteractions[id];
      if (!e || e.state === 'ended') return;
      if (String(e.channel || '').toLowerCase() !== 'email') return; // emails only
      if (touched[id]) return;                                       // skip drafts (in-progress)
      if (!canRequeue) { skipped++; return; }
      toRequeue.push(id);
    });
    _rqProcessQueue(toRequeue, 0); // transfer + auto-wrap-up each, one after another
    var count = toRequeue.length;
    if (skipped) {
      console.warn('[crm-sync-header] end-shift:', skipped,
        'new email(s) NOT requeued — no email queue configured or vteamTransfer unavailable');
    }
    // Block new interactions on every channel.
    _endShiftGoNotReady();
    _relaySend({ type: 'END_SHIFT_RESULT', requeued: count });
    console.log('[crm-sync-header] end-shift: requeued', count,
      'new email(s); setting Not Ready on all channels');
  }

  // Put the agent into the configured Not Ready state on ALL channels. Unlike
  // focus mode this is a deliberate, terminal action, so we latch _endShiftActive
  // to stop the SLA tick from releasing the agent back to Available.
  function _endShiftGoNotReady() {
    var codes = (_getCatalog().idleCodes) || [];
    var cfg = (_getFocusSettings() || {}).idleCode;
    var chosen = null;
    if (cfg && cfg.id) {
      for (var i = 0; i < codes.length; i++) { if (String(codes[i].id) === String(cfg.id)) { chosen = codes[i]; break; } }
    }
    if (!chosen) {
      for (var j = 0; j < codes.length; j++) { if (codes[j].isDefault) { chosen = codes[j]; break; } }
      if (!chosen) chosen = codes[0] || null;
    }
    if (!chosen) {
      console.warn('[crm-sync-header] end-shift: no valid idle code — cannot set Not Ready (pick a Not Available reason in the SLA panel)');
      return;
    }
    var auxId = String(chosen.id);
    var channels = _channelsFor('all');
    _endShiftActive = true;
    _focusOverride = false;
    _focusAuxId = auxId;
    _focusChannels = channels;
    console.log('[crm-sync-header] end-shift: Not Ready on all channels →', chosen.name, '(' + auxId + ')');
    _requestAgentState('Idle', auxId, chosen.name, channels);
    clearTimeout(_focusFallbackTimer);
    _focusFallbackTimer = setTimeout(function () { _stateChangeDirect('Idle', auxId, channels); }, 2500);
  }


  // Track live agent state so we (a) don't override a manual Not Available and
  // (b) detect when the agent manually leaves our focus-mode Not Available.
  function _initSlaAgentListener() {
    if (_slaAgentListenerReady) return;
    var agent = _aqmAgent();
    if (!agent) { setTimeout(_initSlaAgentListener, 3000); return; }
    if (agent.eAgentStateChangeSuccess && typeof agent.eAgentStateChangeSuccess.listen === 'function') {
      agent.eAgentStateChangeSuccess.listen(function (msg) {
        try {
          var d = (msg && msg.data) || {};
          _slaAgentState = { subStatus: d.subStatus, auxCodeId: d.auxCodeId };
          var subS = String(d.subStatus || '').toLowerCase();
          // If the agent manually goes Available again, end-shift mode is over.
          if (_endShiftActive && subS === 'available') {
            _endShiftActive = false;
            console.log('[crm-sync-header] end-shift: agent went Available — resuming normal auto-manage');
          }
          if (_focusEngaged) {
            var sub = String(d.subStatus || '').toLowerCase();
            var differentAux = d.auxCodeId && _focusAuxId && String(d.auxCodeId) !== _focusAuxId;
            if (sub === 'available' || differentAux) {
              _focusOverride = true;
              _focusEngaged = false;
              console.log('[crm-sync-header] focus: manual state override detected — pausing auto-manage');
            }
          }
          // Re-evaluate SLA on every agent-state change (e.g. returning from an
          // auto-wrapup) so a release/engage isn't deferred to the periodic tick.
          _slaCheckNow('agent-state ' + subS);
        } catch (e) { /* ignore */ }
      });
      _slaAgentListenerReady = true;
      console.log('[crm-sync-header] SLA agent-state listener registered');
    } else {
      setTimeout(_initSlaAgentListener, 3000);
    }
  }

  function _startSlaController() {
    if (_slaTickTimer) return;
    _focusSettings = _getFocusSettings();
    _initSlaAgentListener();
    _initFocusResultListener();
    _slaTickTimer = setInterval(_slaTick, 5000);
    console.log('[crm-sync-header] SLA focus controller started | threshold',
      _slaThresholdMin, 'min | var', _slaVariable || '(unset)');
  }

  // Notify the Customer360 widget (same origin, different context) that the
  // centrally-edited requeue settings changed, so it re-hydrates from localStorage.
  function _broadcastSettingsChanged() {
    try {
      var bc = new BroadcastChannel('crm-sync');
      bc.postMessage({ type: 'SLA_SETTINGS_CHANGED' });
      bc.close();
    } catch (e) { /* BroadcastChannel unavailable */ }
  }

  /* ── In-header SLA / Focus settings UI + End-shift ───────────────────────── */
  //
  // The settings and the End-shift action live in THIS widget (the Desktop
  // header), not in the CRM Tab Manager. A gear + End-shift button on the header
  // pill open a floating panel / confirm dialog appended to document.body so they
  // are not clipped by the header. Options come from the localStorage catalog the
  // Customer360 widget provisions; focus + requeue settings are read/written to
  // the same localStorage keys the watcher already uses.

  var _slaPanelEl = null;
  var _slaConfirmEl = null;
  var _slaRefs = {};
  var _queueItems = [];     // searchable requeue-queue list [{id,name,type}]
  var _queueSelId = '';     // currently selected queue id
  var _queueActiveIdx = -1; // keyboard-highlighted option index
  var _slaSel = { focusEnabled: false, focusTrigger: 'imminent', rqAction: 'none', rqTrigger: 'imminent', channels: 'all' };
  var _slaStylesInjected = false;

  // Minimal i18n for panel strings the React bundle can't reach (this file is
  // copied raw, not bundled). Mirrors the supported locales in src/i18n.
  var _slaLocaleCache = null;
  var _SLA_I18N = {
    en: {
      panelTitle: 'Focus / SLA',
      focusMode: 'Focus mode — go Not Available while an SLA-critical task is open',
      focusTrigger: 'Focus trigger',
      withinThreshold: 'Within threshold',
      afterExpiration: 'After expiration',
      reason: 'Not Available reason',
      channelsLabel: 'Apply to all channels',
      channelsHint: '(off = voice, chat & messaging only)',
      requeueTitle: 'SLA requeue',
      whenReached: 'When SLA is reached',
      actionNone: 'No action',
      actionOffer: 'Offer',
      actionAuto: 'Auto',
      requeueTrigger: 'Requeue trigger',
      requeueTo: 'Requeue to (email)',
      wrapup: 'Wrap-up reason (auto-submitted)',
      autoCountdown: 'Auto countdown (seconds)',
      apply: 'Apply',
      saved: 'Saved',
      selectReason: 'Select a reason…',
      selectQueue: 'Select a queue…',
      selectWrapup: 'Select a wrap-up reason…',
      search: 'Type to search…',
      rqOfferTitle: 'Requeue expiring emails',
      rqOfferMsg: 'These new emails are near or past their SLA. Choose which to requeue.',
      rqRequeueSelected: 'Requeue selected',
      rqDismiss: 'Dismiss',
      rqNoQueue: 'Set a requeue queue in settings first.',
      rqOverdue: 'overdue',
      rqAutoMsg: 'Requeuing {n} expiring email(s) in {s}s…',
      requeueBtn: 'Requeue tasks',
      endShiftTitle: 'End shift?',
      endShiftMsg: 'This will requeue every new (unedited) email to the configured queue and set you to Not Ready on all channels so you can finish your current work. Continue?',
      cancel: 'Cancel',
      endShiftConfirm: 'Requeue & end shift',
      openCrm: 'Open CRM Tab Manager',
      focusCrm: 'Focus CRM Tab Manager',
      slaSettings: 'SLA / Focus settings',
      endShiftTip: 'End shift — requeue pending SLA tasks',
      endShiftLabel: 'End shift',
      relayStatus: 'Relay status',
    },
    de: {
      panelTitle: 'Fokus / SLA',
      focusMode: 'Fokusmodus — Nicht verfügbar, solange eine SLA-kritische Aufgabe offen ist',
      focusTrigger: 'Fokus-Auslöser',
      withinThreshold: 'Innerhalb Schwelle',
      afterExpiration: 'Nach Ablauf',
      reason: 'Grund „Nicht verfügbar“',
      channelsLabel: 'Auf alle Kanäle anwenden',
      channelsHint: '(aus = nur Sprache, Chat & Messaging)',
      requeueTitle: 'SLA-Rückstellung',
      whenReached: 'Wenn SLA erreicht ist',
      actionNone: 'Keine Aktion',
      actionOffer: 'Anbieten',
      actionAuto: 'Automatisch',
      requeueTrigger: 'Rückstellungs-Auslöser',
      requeueTo: 'Rückstellen an (E-Mail)',
      wrapup: 'Nachbearbeitungsgrund (automatisch)',
      autoCountdown: 'Auto-Countdown (Sekunden)',
      apply: 'Anwenden',
      saved: 'Gespeichert',
      selectReason: 'Grund wählen…',
      selectQueue: 'Warteschlange wählen…',
      selectWrapup: 'Nachbearbeitungsgrund wählen…',
      search: 'Zum Suchen tippen…',
      rqOfferTitle: 'Ablaufende E-Mails rückstellen',
      rqOfferMsg: 'Diese neuen E-Mails haben ihr SLA fast oder bereits überschritten. Wählen Sie, welche rückgestellt werden sollen.',
      rqRequeueSelected: 'Auswahl rückstellen',
      rqDismiss: 'Schließen',
      rqNoQueue: 'Legen Sie zuerst eine Rückstell-Warteschlange in den Einstellungen fest.',
      rqOverdue: 'überfällig',
      rqAutoMsg: 'Rückstellung von {n} ablaufenden E-Mail(s) in {s}s…',
      requeueBtn: 'Aufgaben rückstellen',
      endShiftTitle: 'Schicht beenden?',
      endShiftMsg: 'Dadurch wird jede neue (unbearbeitete) E-Mail an die konfigurierte Warteschlange zurückgestellt und Sie werden auf allen Kanälen auf Nicht bereit gesetzt, damit Sie Ihre aktuelle Arbeit abschließen können. Fortfahren?',
      cancel: 'Abbrechen',
      endShiftConfirm: 'Rückstellen & Schicht beenden',
      openCrm: 'CRM-Tab-Manager öffnen',
      focusCrm: 'CRM-Tab-Manager fokussieren',
      slaSettings: 'SLA-/Fokus-Einstellungen',
      endShiftTip: 'Schicht beenden — ausstehende SLA-Aufgaben zurückstellen',
      endShiftLabel: 'Schicht beenden',
      relayStatus: 'Relay-Status',
    },
    cs: {
      panelTitle: 'Soustředění / SLA',
      focusMode: 'Režim soustředění — nastavit Nedostupný, dokud je otevřený úkol kritický pro SLA',
      focusTrigger: 'Spouštěč soustředění',
      withinThreshold: 'V rámci prahu',
      afterExpiration: 'Po vypršení',
      reason: 'Důvod „Nedostupný“',
      channelsLabel: 'Použít na všechny kanály',
      channelsHint: '(vypnuto = pouze hlas, chat a zprávy)',
      requeueTitle: 'Přeřazení SLA',
      whenReached: 'Když je dosaženo SLA',
      actionNone: 'Žádná akce',
      actionOffer: 'Nabídnout',
      actionAuto: 'Automaticky',
      requeueTrigger: 'Spouštěč přeřazení',
      requeueTo: 'Přeřadit do (e-mail)',
      wrapup: 'Důvod uzavření (automaticky)',
      autoCountdown: 'Automatické odpočítávání (sekundy)',
      apply: 'Použít',
      saved: 'Uloženo',
      selectReason: 'Vyberte důvod…',
      selectQueue: 'Vyberte frontu…',
      selectWrapup: 'Vyberte důvod uzavření…',
      search: 'Začněte psát pro vyhledávání…',
      rqOfferTitle: 'Přeřadit vypršující e-maily',
      rqOfferMsg: 'Tyto nové e-maily se blíží svému SLA nebo jej překročily. Vyberte, které přeřadit.',
      rqRequeueSelected: 'Přeřadit vybrané',
      rqDismiss: 'Zavřít',
      rqNoQueue: 'Nejprve nastavte frontu pro přeřazení v nastavení.',
      rqOverdue: 'po termínu',
      rqAutoMsg: 'Přeřazení {n} vypršujících e-mailů za {s}s…',
      requeueBtn: 'Přeřadit úkoly',
      endShiftTitle: 'Ukončit směnu?',
      endShiftMsg: 'Tímto se každý nový (neupravený) e-mail přeřadí do nakonfigurované fronty a na všech kanálech budete nastaveni na Nedostupný, abyste mohli dokončit svou aktuální práci. Pokračovat?',
      cancel: 'Zrušit',
      endShiftConfirm: 'Přeřadit a ukončit směnu',
      openCrm: 'Otevřít správce karet CRM',
      focusCrm: 'Zaměřit správce karet CRM',
      slaSettings: 'Nastavení SLA / soustředění',
      endShiftTip: 'Ukončit směnu — přeřadit nevyřízené úkoly SLA',
      endShiftLabel: 'Ukončit směnu',
      relayStatus: 'Stav relay',
    },
  };
  function _slaLocale() {
    if (_slaLocaleCache) return _slaLocaleCache;
    var lang = '';
    try {
      var host = document.querySelector('crm-sync-header');
      if (host && host.getAttribute('locale')) lang = host.getAttribute('locale');
      if (!lang) {
        var tm = document.querySelector('task-management');
        if (tm && tm.getAttribute('locale')) lang = tm.getAttribute('locale');
      }
      if (!lang) lang = navigator.language || navigator.userLanguage || 'en';
    } catch (e) { lang = 'en'; }
    var primary = String(lang).toLowerCase().split(/[-_]/)[0];
    _slaLocaleCache = _SLA_I18N[primary] ? primary : 'en';
    return _slaLocaleCache;
  }
  function _t(key) {
    var d = _SLA_I18N[_slaLocale()] || _SLA_I18N.en;
    return (d && d[key] != null) ? d[key] : (_SLA_I18N.en[key] != null ? _SLA_I18N.en[key] : key);
  }

  function _slaEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _slaFind(list, id) {
    for (var i = 0; i < (list || []).length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }
  function _slaFill(sel, placeholder, items, currentId) {
    if (!sel) return;
    var html = '<option value="">' + _slaEsc(placeholder) + '</option>';
    (items || []).forEach(function (it) {
      html += '<option value="' + _slaEsc(it.id) + '">' + _slaEsc(it.name) + '</option>';
    });
    sel.innerHTML = html;
    if (currentId) sel.value = String(currentId);
  }

  // ---- Searchable requeue-queue dropdown (trigger + popup with search box) ----
  var _SVG_CHEV = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M4.24 6.24a1 1 0 0 1 1.42 0L8 8.59l2.34-2.35a1 1 0 1 1 1.42 1.42l-3.05 3.05a1 1 0 0 1-1.42 0L4.24 7.66a1 1 0 0 1 0-1.42z"/></svg>';
  var _SVG_CHECK = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M6.2 11.3L2.8 7.9l1.4-1.4 2 2 4.6-4.6 1.4 1.4z"/></svg>';
  var _SVG_SEARCH = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M11.74 10.34l2.96 2.96a1 1 0 0 1-1.41 1.41l-2.96-2.96a5.5 5.5 0 1 1 1.41-1.41zM7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>';

  function _queueSelectedName() {
    for (var i = 0; i < _queueItems.length; i++) {
      if (String(_queueItems[i].id) === String(_queueSelId)) return _queueItems[i].name || '';
    }
    return '';
  }
  function _queueSyncTrigger() {
    var val = _slaRefs.rqQueueVal;
    if (!val) return;
    var name = _queueSelectedName();
    val.textContent = name || _t('selectQueue');
    val.className = 'wxss-trigger-val' + (name ? '' : ' is-placeholder');
  }
  // Set the queue list + current selection; called on populate and on refresh.
  function _slaFillQueue(items, currentId) {
    _queueItems = items || [];
    _queueSelId = currentId ? String(currentId) : '';
    _queueSyncTrigger();
  }
  function _queueFiltered(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return _queueItems.slice();
    return _queueItems.filter(function (it) {
      return String(it.name || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  function _queuePosition() {
    var pop = _slaRefs.rqQueuePop, trg = _slaRefs.rqQueueTrigger;
    if (!pop || !trg) return;
    var r = trg.getBoundingClientRect();
    pop.style.left = r.left + 'px';
    pop.style.top = (r.bottom + 4) + 'px';
    pop.style.width = r.width + 'px';
  }
  function _queueRender(list) {
    var menu = _slaRefs.rqQueueMenu;
    if (!menu) return;
    if (!list.length) { menu.innerHTML = '<div class="wxss-opt wxss-opt--empty">' + _slaEsc(_t('selectQueue')) + '</div>'; return; }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var sel = String(list[i].id) === String(_queueSelId);
      var active = (i === _queueActiveIdx) ? ' is-active' : '';
      html += '<div class="wxss-opt' + (sel ? ' is-selected' : '') + active + '" data-id="' + _slaEsc(list[i].id) + '">'
        + '<span class="wxss-opt-label">' + _slaEsc(list[i].name) + '</span>'
        + (sel ? '<span class="wxss-opt-check">' + _SVG_CHECK + '</span>' : '') + '</div>';
    }
    menu.innerHTML = html;
  }
  function _queueIsOpen() {
    return !!(_slaRefs.rqQueuePop && _slaRefs.rqQueuePop.className.indexOf('is-open') !== -1);
  }
  function _queueOpen() {
    var pop = _slaRefs.rqQueuePop;
    if (!pop) return;
    pop.className = 'wxss-pop is-open' + (_darkMode ? ' md--dark' : '');
    if (_slaRefs.rqQueueTrigger) _slaRefs.rqQueueTrigger.classList.add('is-open');
    _queueActiveIdx = -1;
    if (_slaRefs.rqQueueSearch) _slaRefs.rqQueueSearch.value = '';
    _queuePosition();
    _queueRender(_queueFiltered(''));
    if (_slaRefs.rqQueueSearch) { try { _slaRefs.rqQueueSearch.focus(); } catch (e) { /* ignore */ } }
  }
  function _queueClose() {
    var pop = _slaRefs.rqQueuePop;
    if (pop) pop.className = 'wxss-pop' + (_darkMode ? ' md--dark' : '');
    if (_slaRefs.rqQueueTrigger) _slaRefs.rqQueueTrigger.classList.remove('is-open');
    _queueActiveIdx = -1;
  }
  function _queuePick(id) {
    _queueSelId = id ? String(id) : '';
    _queueSyncTrigger();
    _queueClose();
  }
  function _slaWireQueueSelect() {
    var trg = _slaRefs.rqQueueTrigger, search = _slaRefs.rqQueueSearch, menu = _slaRefs.rqQueueMenu;
    if (!trg || !menu) return;
    trg.addEventListener('click', function (e) { e.preventDefault(); if (_queueIsOpen()) _queueClose(); else _queueOpen(); });
    if (search) {
      search.addEventListener('input', function () {
        _queueActiveIdx = -1;
        _queueRender(_queueFiltered(search.value));
      });
      search.addEventListener('keydown', function (e) {
        var list = _queueFiltered(search.value);
        if (e.key === 'ArrowDown') { e.preventDefault(); _queueActiveIdx = Math.min(_queueActiveIdx + 1, list.length - 1); _queueRender(list); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); _queueActiveIdx = Math.max(_queueActiveIdx - 1, 0); _queueRender(list); }
        else if (e.key === 'Enter') { e.preventDefault(); if (_queueActiveIdx >= 0 && list[_queueActiveIdx]) _queuePick(list[_queueActiveIdx].id); }
        else if (e.key === 'Escape') { e.preventDefault(); _queueClose(); }
      });
    }
    menu.addEventListener('mousedown', function (e) {
      var opt = e.target && e.target.closest ? e.target.closest('.wxss-opt') : null;
      if (!opt || opt.className.indexOf('wxss-opt--empty') !== -1) return;
      e.preventDefault();
      _queuePick(opt.getAttribute('data-id'));
    });
  }

  // Merge queue lists, de-duplicating by id (first wins), sorted by name.
  function _mergeQueues(a, b) {
    var seen = {}, out = [], all = (a || []).concat(b || []);
    for (var i = 0; i < all.length; i++) {
      var q = all[i];
      if (!q || !q.id || seen[q.id]) continue;
      seen[q.id] = true;
      out.push(q);
    }
    out.sort(function (x, y) { return String(x.name || '').localeCompare(String(y.name || '')); });
    return out;
  }
  function _configBase() {
    var dc = String(_jdsDataCenter || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    var regions = ['anz1', 'eu1', 'eu2', 'us1', 'ca1', 'jp1', 'in1', 'sg1'];
    var region = 'us1';
    for (var i = 0; i < regions.length; i++) { if (dc.indexOf(regions[i]) !== -1) { region = regions[i]; break; } }
    return 'https://api.wxcc-' + region + '.cisco.com';
  }
  // Fetch every email queue directly from the Config API (works regardless of
  // whether the Customer360 widget is mounted). Includes transfer-only queues
  // that agentContact.vteamList omits. Never throws; calls back with [] on error.
  function _fetchQueuesFromConfig(cb) {
    if (!_accessToken || !_orgId || typeof fetch !== 'function') { cb([]); return; }
    var base = _configBase();
    var url = base + '/organization/' + encodeURIComponent(_orgId) + '/contact-service-queue?page=0&pageSize=200';
    fetch(url, { headers: { Authorization: 'Bearer ' + _accessToken, Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) { console.warn('[crm-sync-header] contact-service-queue fetch failed', r.status, 'on', base, '(token scope / region?)'); return null; }
        return r.json();
      })
      .then(function (json) {
        if (!json) { cb([]); return; }
        var list = (json && json.length !== undefined) ? json : (json && json.data && json.data.length !== undefined ? json.data : []);
        var out = [], sample = list[0] || null;
        for (var i = 0; i < list.length; i++) {
          var q = list[i];
          var ch = String(q.channelType || q.mediaType || '').toLowerCase();
          if (ch.indexOf('email') !== -1) out.push({ id: q.id, name: q.name, type: 'inboundqueue' });
        }
        console.log('[crm-sync-header] config queues: fetched', list.length, 'CSQ(s),', out.length, 'email');
        if (!out.length && sample) console.log('[crm-sync-header] config queues: sample keys', Object.keys(sample), '| channelType=', sample.channelType);
        cb(out);
      })
      .catch(function (e) { console.warn('[crm-sync-header] contact-service-queue error', e && e.message); cb([]); });
  }

  function _injectSlaStyles() {
    if (_slaStylesInjected) return;
    _slaStylesInjected = true;
    var css = [
      '.wxsla-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-start;justify-content:flex-end;}',
      '.wxsla-panel{position:fixed;top:52px;right:16px;z-index:100001;width:320px;max-height:80vh;overflow:auto;',
      'background:#fff;color:#0a2236;border:1px solid #dbe3ec;border-radius:10px;padding:16px;',
      'box-shadow:0 12px 40px rgba(0,0,0,.28);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;}',
      '.wxsla-panel.md--dark{background:#1a2733;color:#e6edf5;border-color:#31424f;}',
      '.wxsla-h{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#5b6b7b;margin:0 0 10px;}',
      '.wxsla-panel.md--dark .wxsla-h{color:#9db2c6;}',
      '.wxsla-row{display:flex;align-items:flex-start;gap:8px;margin:0 0 12px;line-height:1.4;cursor:pointer;}',
      '.wxsla-field{display:flex;flex-direction:column;gap:4px;margin:0 0 12px;}',
      '.wxsla-field>span{font-size:11px;font-weight:600;color:#5b6b7b;}',
      '.wxsla-panel.md--dark .wxsla-field>span{color:#9db2c6;}',
      // Momentum-style toggle switch (focus mode)
      '.wxsw-row{display:flex;align-items:center;gap:10px;margin:0 0 14px;line-height:1.4;}',
      '.wxsw-label{font-size:12px;}',
      '.wxsw{position:relative;flex:0 0 auto;width:34px;height:18px;border-radius:9px;border:none;padding:0;cursor:pointer;background:#c4cdd6;transition:background .15s;}',
      '.wxsw .wxsw-k{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:left .15s;}',
      '.wxsw.is-on{background:#0e7fc1;}',
      '.wxsw.is-on .wxsw-k{left:18px;}',
      '.wxsla-panel.md--dark .wxsw{background:#4a5a68;}',
      '.wxsla-panel.md--dark .wxsw.is-on{background:#2b9be0;}',
      // Segmented pill button-group (mirrors src-report .pill-seg)
      '.wxseg{display:flex;width:100%;box-sizing:border-box;padding:3px;gap:3px;background:#f4f7fa;border:1px solid #dbe3ec;border-radius:18px;}',
      '.wxseg button{flex:1 1 0;min-width:0;height:26px;padding:0 6px;border:none;border-radius:15px;background:transparent;color:#5b6b7b;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .12s,color .12s;}',
      '.wxseg button:hover{color:#0a2236;}',
      '.wxseg button.is-active{background:#fff;color:#0e7fc1;box-shadow:0 1px 3px rgba(0,0,0,.14);}',
      '.wxsla-panel.md--dark .wxseg{background:#22303c;border-color:#31424f;}',
      '.wxsla-panel.md--dark .wxseg button{color:#9db2c6;}',
      '.wxsla-panel.md--dark .wxseg button:hover{color:#e6edf5;}',
      '.wxsla-panel.md--dark .wxseg button.is-active{background:#0f1c26;color:#4db2ee;}',
      '.wxsla-field select,.wxsla-field input:not(.wxss-search-input){height:30px;box-sizing:border-box;padding:0 8px;border:1px solid #dbe3ec;',
      'border-radius:8px;background:#fff;color:inherit;font-family:inherit;font-size:13px;}',
      '.wxsla-panel.md--dark .wxsla-field select,.wxsla-panel.md--dark .wxsla-field input:not(.wxss-search-input){background:#22303c;border-color:#31424f;color:#e6edf5;}',
      // Searchable dropdown (requeue queue): trigger button + popup with a search box.
      // The popup is position:fixed so it escapes the panel's scroll clip; it stays a
      // DOM child of the .wxss container so outside-click logic keeps the panel open.
      '.wxss{position:relative;}',
      '.wxss-trigger{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;height:32px;box-sizing:border-box;padding:0 10px 0 13px;border:1px solid #dbe3ec;border-radius:16px;background:#fff;color:inherit;font-family:inherit;font-size:13px;cursor:pointer;text-align:left;transition:border-color .12s,box-shadow .12s;}',
      '.wxss-trigger:hover{border-color:#0e7fc1;}',
      '.wxss-trigger:focus-visible,.wxss-trigger.is-open{outline:none;border-color:#0e7fc1;box-shadow:0 0 0 3px rgba(14,127,193,.18);}',
      '.wxss-trigger-val{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
      '.wxss-trigger-val.is-placeholder{color:#8a99a8;}',
      '.wxss-trigger-chev{flex:0 0 auto;display:inline-flex;color:#8a99a8;}',
      '.wxsla-panel.md--dark .wxss-trigger{background:#22303c;border-color:#31424f;color:#e6edf5;}',
      '.wxsla-panel.md--dark .wxss-trigger:hover{border-color:#4db2ee;}',
      '.wxsla-panel.md--dark .wxss-trigger:focus-visible,.wxsla-panel.md--dark .wxss-trigger.is-open{border-color:#4db2ee;box-shadow:0 0 0 3px rgba(77,178,238,.25);}',
      '.wxss-pop{position:fixed;z-index:100002;background:#fff;border:1px solid #dbe3ec;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.22);display:none;overflow:hidden;}',
      '.wxss-pop.is-open{display:block;}',
      '.wxss-pop.md--dark{background:#1a2733;border-color:#31424f;color:#e6edf5;}',
      '.wxss-search{display:flex;align-items:center;gap:7px;margin:8px;padding:0 12px;height:30px;box-sizing:border-box;border:1px solid #dbe3ec;border-radius:15px;background:#f4f7fa;transition:border-color .12s,box-shadow .12s;}',
      '.wxss-search:focus-within{border-color:#0e7fc1;box-shadow:0 0 0 3px rgba(14,127,193,.15);}',
      '.wxss-pop.md--dark .wxss-search{background:#0f1c26;border-color:#31424f;}',
      '.wxss-search-icon{display:inline-flex;color:#8a99a8;}',
      '.wxss-search-input{flex:1 1 auto;min-width:0;height:24px;border:none;outline:none;background:transparent;color:inherit;font-family:inherit;font-size:13px;}',
      '.wxss-search-input:focus,.wxss-search-input:focus-visible{outline:none;box-shadow:none;}',
      '.wxss-list{max-height:200px;overflow:auto;padding:6px;}',
      '.wxss-opt{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:9px;cursor:pointer;font-size:13px;}',
      '.wxss-opt-label{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
      '.wxss-opt-check{flex:0 0 auto;display:inline-flex;color:#0e7fc1;}',
      '.wxss-opt:hover,.wxss-opt.is-active{background:#eef4fb;}',
      '.wxss-opt.is-selected{color:#0e7fc1;font-weight:600;}',
      '.wxss-pop.md--dark .wxss-opt:hover,.wxss-pop.md--dark .wxss-opt.is-active{background:#0f1c26;}',
      '.wxss-pop.md--dark .wxss-opt.is-selected{color:#4db2ee;}',
      '.wxss-pop.md--dark .wxss-opt-check{color:#4db2ee;}',
      '.wxss-opt--empty{color:#8a99a8;cursor:default;}',
      '.wxsla-sep{height:1px;background:#dbe3ec;margin:4px 0 12px;}',
      '.wxsla-panel.md--dark .wxsla-sep{background:#31424f;}',
      '.wxsla-actions{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:4px;}',
      '.wxsla-btn{height:30px;padding:0 14px;border-radius:15px;border:1px solid #dbe3ec;background:#fff;color:#0a2236;',
      'font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;}',
      '.wxsla-btn--primary{background:#0e7fc1;border-color:#0e7fc1;color:#fff;}',
      '.wxsla-btn--danger{background:#d5493f;border-color:#d5493f;color:#fff;}',
      '.wxsla-status{font-size:12px;color:#0e7fc1;}',
      '.wxsla-dialog{position:fixed;top:52px;right:16px;width:320px;background:#fff;color:#0a2236;border:1px solid #dbe3ec;',
      'border-radius:10px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.28);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
      '.wxsla-dialog.md--dark{background:#1a2733;color:#e6edf5;border-color:#31424f;}',
      '.wxsla-dialog p{font-size:13px;line-height:1.5;margin:0 0 16px;}',
      // Centralized SLA requeue offer + auto toast.
      '.wxrq-list{max-height:240px;overflow:auto;margin:0 0 14px;border:1px solid #dbe3ec;border-radius:8px;}',
      '.wxsla-dialog.md--dark .wxrq-list{border-color:#31424f;}',
      '.wxrq-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #eef2f6;cursor:pointer;font-size:13px;}',
      '.wxrq-row:last-child{border-bottom:none;}',
      '.wxsla-dialog.md--dark .wxrq-row{border-bottom-color:#2a3742;}',
      '.wxrq-cb{flex:0 0 auto;width:15px;height:15px;accent-color:#0e7fc1;cursor:pointer;}',
      '.wxrq-title{flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
      '.wxrq-sla{flex:0 0 auto;font-size:11px;font-weight:600;color:#d5493f;}',
      '.wxrq-warn{color:#d5493f;font-size:12px;margin:0 0 12px;}',
      '.wxrq-toast{position:fixed;top:52px;right:16px;z-index:100001;max-width:320px;display:flex;align-items:center;gap:12px;',
      'background:#1a2733;color:#e6edf5;border-radius:10px;padding:12px 14px;box-shadow:0 12px 40px rgba(0,0,0,.3);',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;}',
      '.wxrq-toast button{flex:0 0 auto;height:26px;padding:0 12px;border-radius:13px;border:1px solid rgba(255,255,255,.35);',
      'background:transparent;color:#fff;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;}',
    ].join('');
    var style = document.createElement('style');
    style.id = 'wxsla-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function _buildSlaPanel() {
    if (_slaPanelEl) return;
    _injectSlaStyles();
    var el = document.createElement('div');
    el.className = 'wxsla-panel' + (_darkMode ? ' md--dark' : '');
    el.style.display = 'none';
    el.innerHTML = [
      '<div class="wxsla-h">' + _slaEsc(_t('panelTitle')) + '</div>',
      '<div class="wxsw-row"><button class="wxsw" id="wxsla-focus-enabled" role="switch" aria-checked="false"><span class="wxsw-k"></span></button>',
      '<span class="wxsw-label">' + _slaEsc(_t('focusMode')) + '</span></div>',
      '<div id="wxsla-focus-when">',
      '  <div class="wxsla-field"><span>' + _slaEsc(_t('focusTrigger')) + '</span><div class="wxseg" data-group="focusTrigger">',
      '    <button data-val="imminent">' + _slaEsc(_t('withinThreshold')) + '</button><button data-val="expired">' + _slaEsc(_t('afterExpiration')) + '</button></div></div>',
      '  <div class="wxsla-field"><span>' + _slaEsc(_t('reason')) + '</span><select id="wxsla-focus-idle"></select></div>',
      '  <div class="wxsw-row"><button class="wxsw" id="wxsla-channels" role="switch" aria-checked="true"><span class="wxsw-k"></span></button>',
      '  <span class="wxsw-label">' + _slaEsc(_t('channelsLabel')) + ' <small style="opacity:.7">' + _slaEsc(_t('channelsHint')) + '</small></span></div>',
      '</div>',
      '<div class="wxsla-sep"></div>',
      '<div class="wxsla-h">' + _slaEsc(_t('requeueTitle')) + '</div>',
      '<div class="wxsla-field"><span>' + _slaEsc(_t('whenReached')) + '</span><div class="wxseg" data-group="rqAction">',
      '  <button data-val="none">' + _slaEsc(_t('actionNone')) + '</button><button data-val="offer">' + _slaEsc(_t('actionOffer')) + '</button><button data-val="auto">' + _slaEsc(_t('actionAuto')) + '</button></div></div>',
      '<div id="wxsla-rq-when">',
      '  <div class="wxsla-field"><span>' + _slaEsc(_t('requeueTrigger')) + '</span><div class="wxseg" data-group="rqTrigger">',
      '    <button data-val="imminent">' + _slaEsc(_t('withinThreshold')) + '</button><button data-val="expired">' + _slaEsc(_t('afterExpiration')) + '</button></div></div>',
      '  <div class="wxsla-field"><span>' + _slaEsc(_t('requeueTo')) + '</span>',
      '    <div class="wxss" id="wxsla-rq-queue">',
      '      <button type="button" class="wxss-trigger" id="wxsla-rq-queue-trigger"><span class="wxss-trigger-val is-placeholder" id="wxsla-rq-queue-val">' + _slaEsc(_t('selectQueue')) + '</span><span class="wxss-trigger-chev">' + _SVG_CHEV + '</span></button>',
      '      <div class="wxss-pop" id="wxsla-rq-queue-pop"><div class="wxss-search"><span class="wxss-search-icon">' + _SVG_SEARCH + '</span><input type="text" id="wxsla-rq-queue-search" class="wxss-search-input" autocomplete="off" spellcheck="false" placeholder="' + _slaEsc(_t('search')) + '"></div><div class="wxss-list" id="wxsla-rq-queue-menu"></div></div>',
      '    </div></div>',
      '  <div class="wxsla-field"><span>' + _slaEsc(_t('wrapup')) + '</span><select id="wxsla-rq-wrapup"></select></div>',
      '</div>',
      '<div class="wxsla-field" id="wxsla-rq-countdown-field"><span>' + _slaEsc(_t('autoCountdown')) + '</span><input type="number" id="wxsla-rq-countdown" min="3" max="120" value="15"></div>',
      '<div class="wxsla-actions"><span id="wxsla-status" class="wxsla-status"></span>',
      '<button id="wxsla-apply" class="wxsla-btn wxsla-btn--primary">' + _slaEsc(_t('apply')) + '</button></div>',
    ].join('');
    document.body.appendChild(el);
    _slaPanelEl = el;
    _slaRefs = {
      focusSwitch: el.querySelector('#wxsla-focus-enabled'),
      focusWhen: el.querySelector('#wxsla-focus-when'),
      focusIdle: el.querySelector('#wxsla-focus-idle'),
      channelsSwitch: el.querySelector('#wxsla-channels'),
      rqWhen: el.querySelector('#wxsla-rq-when'),
      rqQueue: el.querySelector('#wxsla-rq-queue'),
      rqQueueTrigger: el.querySelector('#wxsla-rq-queue-trigger'),
      rqQueueVal: el.querySelector('#wxsla-rq-queue-val'),
      rqQueuePop: el.querySelector('#wxsla-rq-queue-pop'),
      rqQueueSearch: el.querySelector('#wxsla-rq-queue-search'),
      rqQueueMenu: el.querySelector('#wxsla-rq-queue-menu'),
      rqWrapup: el.querySelector('#wxsla-rq-wrapup'),
      rqCountdown: el.querySelector('#wxsla-rq-countdown'),
      rqCountdownField: el.querySelector('#wxsla-rq-countdown-field'),
      apply: el.querySelector('#wxsla-apply'),
      status: el.querySelector('#wxsla-status'),
    };
    _slaRefs.apply.addEventListener('click', _slaApply);
    _slaRefs.focusSwitch.addEventListener('click', function () { _slaSetSwitch(!_slaSel.focusEnabled); });
    _slaRefs.channelsSwitch.addEventListener('click', function () { _slaSetChannelsSwitch(_slaSel.channels !== 'all'); });
    _slaWireQueueSelect();
    // Segmented button-groups: one delegated listener per group.
    var segs = el.querySelectorAll('.wxseg');
    for (var s = 0; s < segs.length; s++) {
      (function (seg) {
        seg.addEventListener('click', function (e) {
          var b = e.target.closest('button');
          if (!b || !seg.contains(b)) return;
          _slaSegClick(seg.getAttribute('data-group'), b.getAttribute('data-val'));
        });
      })(segs[s]);
    }
    // Close when clicking outside the panel.
    document.addEventListener('mousedown', function (e) {
      if (!_slaPanelEl || _slaPanelEl.style.display === 'none') return;
      // Close the searchable queue menu when the click is outside its container.
      if (_slaRefs.rqQueue && !_slaRefs.rqQueue.contains(e.target)) _queueClose();
      if (!_slaPanelEl.contains(e.target) && !_isHeaderControl(e.target)) {
        _slaPanelEl.style.display = 'none';
      }
    });
  }

  // Segmented group + switch state helpers.
  function _slaSyncSeg(group) {
    if (!_slaPanelEl) return;
    var wrap = _slaPanelEl.querySelector('.wxseg[data-group="' + group + '"]');
    if (!wrap) return;
    var btns = wrap.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = (btns[i].getAttribute('data-val') === String(_slaSel[group])) ? 'is-active' : '';
    }
  }
  function _slaSegClick(group, val) {
    if (!group || val == null) return;
    _slaSel[group] = val;
    _slaSyncSeg(group);
    _slaUpdateVisibility();
  }
  function _slaSetSwitch(on) {
    _slaSel.focusEnabled = !!on;
    var sw = _slaRefs.focusSwitch;
    if (sw) {
      sw.className = 'wxsw' + (on ? ' is-on' : '');
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    _slaUpdateVisibility();
  }
  function _slaSetChannelsSwitch(on) {
    _slaSel.channels = on ? 'all' : 'realtime';
    var sw = _slaRefs.channelsSwitch;
    if (sw) {
      sw.className = 'wxsw' + (on ? ' is-on' : '');
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }
  function _slaUpdateVisibility() {
    var show = function (el, v) { if (el) el.style.display = v ? '' : 'none'; };
    show(_slaRefs.focusWhen, _slaSel.focusEnabled);
    show(_slaRefs.rqWhen, _slaSel.rqAction !== 'none');
    show(_slaRefs.rqCountdownField, _slaSel.rqAction === 'auto');
  }

  function _isHeaderControl(node) {
    // Clicks on our header buttons are handled separately; don't treat as outside.
    try {
      var root = _shadowRoot;
      return !!(root && (root.getElementById('sla-btn') === node || root.getElementById('endshift-btn') === node || root.getElementById('requeue-btn') === node));
    } catch (e) { return false; }
  }

  function _slaPopulateForm() {
    var cat = _getCatalog();
    var focus = _getFocusSettings() || {};
    var settings = _lsRead(_agentKey(SETTINGS_LS_PREFIX)) || {};
    var rq = settings.sla || {};
    _slaSel.focusEnabled = !!focus.enabled;
    _slaSel.focusTrigger = focus.triggerOn || 'imminent';
    _slaSel.channels = focus.channels === 'realtime' ? 'realtime' : 'all';
    _slaSel.rqAction = rq.action || 'none';
    _slaSel.rqTrigger = rq.triggerOn || 'imminent';
    _slaSetSwitch(_slaSel.focusEnabled);
    _slaSetChannelsSwitch(_slaSel.channels === 'all');
    _slaSyncSeg('focusTrigger');
    _slaSyncSeg('rqAction');
    _slaSyncSeg('rqTrigger');
    if (_slaRefs.rqCountdown) _slaRefs.rqCountdown.value = rq.autoCountdownSec || 15;
    _slaFill(_slaRefs.focusIdle, _t('selectReason'), cat.idleCodes, focus.idleCode && focus.idleCode.id);
    var q = rq.queues && rq.queues.email;
    _slaFillQueue(cat.queues, q && q.vteamId);
    _slaFill(_slaRefs.rqWrapup, _t('selectWrapup'), cat.wrapUpCodes, rq.wrapUp && rq.wrapUp.auxCodeId);
    _slaUpdateVisibility();
  }

  function _slaApply() {
    var cat = _getCatalog();
    var idle = _slaFind(cat.idleCodes, _slaRefs.focusIdle ? _slaRefs.focusIdle.value : '');
    _focusSettings = {
      enabled: _slaSel.focusEnabled,
      triggerOn: _slaSel.focusTrigger,
      idleCode: idle ? { id: idle.id, name: idle.name } : null,
      channels: _slaSel.channels,
    };
    _lsWrite(_agentKey(FOCUS_LS_PREFIX), _focusSettings);

    var q = _slaFind(_queueItems, _queueSelId);
    var wc = _slaFind(cat.wrapUpCodes, _slaRefs.rqWrapup ? _slaRefs.rqWrapup.value : '');
    var sla = {
      action: _slaSel.rqAction,
      triggerOn: _slaSel.rqTrigger,
      autoCountdownSec: _slaRefs.rqCountdown ? (parseInt(_slaRefs.rqCountdown.value, 10) || 15) : 15,
      queues: { email: q ? { vteamId: q.id, vteamType: q.type || 'inboundqueue', name: q.name } : null },
      wrapUp: wc ? { auxCodeId: wc.id, name: wc.name } : null,
    };
    var existing = _lsRead(_agentKey(SETTINGS_LS_PREFIX)) || {};
    existing.sla = sla;
    _lsWrite(_agentKey(SETTINGS_LS_PREFIX), existing);

    console.log('[crm-sync-header] SLA settings applied (in-header)', _focusSettings, sla);
    _slaTick();
    _broadcastSettingsChanged();
    if (_slaRefs.status) {
      _slaRefs.status.textContent = _t('saved');
      setTimeout(function () { if (_slaRefs.status) _slaRefs.status.textContent = ''; }, 2000);
    }
  }

  function _toggleSlaPanel() {
    _buildSlaPanel();
    if (_slaConfirmEl) _slaConfirmEl.style.display = 'none';
    var showing = _slaPanelEl.style.display !== 'none';
    if (showing) { _queueClose(); _slaPanelEl.style.display = 'none'; return; }
    _slaPanelEl.className = 'wxsla-panel' + (_darkMode ? ' md--dark' : '');
    _slaPopulateForm();
    _slaPanelEl.style.display = 'block';
    // Refresh the catalog (queues especially) every time the panel opens. The
    // React widget re-fetches and writes localStorage, then replies CATALOG_UPDATED.
    _postSync({ type: 'PROVISION_CATALOG' });
    // Also fetch ALL email queues directly from the Config API here — this works
    // even when the Customer360 widget isn't mounted, and surfaces transfer-only
    // queues that vteamList omits. Merge with the catalog + keep the selection.
    _fetchQueuesFromConfig(function (cfg) {
      if (!_slaPanelEl || _slaPanelEl.style.display === 'none') return;
      var cat = _getCatalog();
      _slaFillQueue(_mergeQueues(cfg, cat.queues || []), _queueSelId);
      if (_queueIsOpen()) _queueRender(_queueFiltered(_slaRefs.rqQueueSearch ? _slaRefs.rqQueueSearch.value : ''));
    });
  }

  function _buildEndShiftConfirm() {
    if (_slaConfirmEl) return;
    _injectSlaStyles();
    var el = document.createElement('div');
    el.className = 'wxsla-dialog' + (_darkMode ? ' md--dark' : '');
    el.style.display = 'none';
    el.innerHTML = [
      '<div class="wxsla-h">' + _slaEsc(_t('endShiftTitle')) + '</div>',
      '<p>' + _slaEsc(_t('endShiftMsg')) + '</p>',
      '<div class="wxsla-actions"><button id="wxsla-es-cancel" class="wxsla-btn">' + _slaEsc(_t('cancel')) + '</button>',
      '<button id="wxsla-es-ok" class="wxsla-btn wxsla-btn--danger">' + _slaEsc(_t('endShiftConfirm')) + '</button></div>',
    ].join('');
    document.body.appendChild(el);
    _slaConfirmEl = el;
    el.querySelector('#wxsla-es-cancel').addEventListener('click', function () { el.style.display = 'none'; });
    el.querySelector('#wxsla-es-ok').addEventListener('click', function () {
      el.style.display = 'none';
      _endShiftRequeue();
    });
  }

  function _openEndShiftConfirm() {
    _buildEndShiftConfirm();
    if (_slaPanelEl) _slaPanelEl.style.display = 'none';
    _slaConfirmEl.className = 'wxsla-dialog' + (_darkMode ? ' md--dark' : '');
    _slaConfirmEl.style.display = 'block';
  }

  /* ── Start background listeners (relay connects once `wsurl` is set) ─────── */

  _initAqmEndListeners();
  _startSlaController();
  _reconcileOnReload();

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
            '    display: inline-flex; align-items: center; gap: 5px;',
            '    padding: 0 7px; height: 26px; border-radius: 13px;',
            '    background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.12);',
            '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
            '    font-size: 11px; color: #243240; user-select: none; white-space: nowrap;',
            '  }',
            '  .pill.md--dark { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); color: #d8ddf0; }',
            '  .dot {',
            '    width: 7px; height: 7px; border-radius: 50%;',
            '    background: #999; flex-shrink: 0; transition: background 0.3s;',
            '  }',
            '  .dot--connected    { background: #2bb673; }',
            '  .dot--disconnected { background: #e05c5c; }',
            '  .hbtn {',
            '    display: inline-flex; align-items: center; justify-content: center; gap: 4px;',
            '    height: 20px; padding: 0 8px; border-radius: 10px; cursor: pointer;',
            '    font-family: inherit; font-size: 11px; font-weight: 600; line-height: 1;',
            '    background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.16); color: #2b3a48;',
            '    transition: background 0.15s;',
            '  }',
            '  .hbtn:hover { background: rgba(0,0,0,0.10); }',
            '  .hbtn--icon { padding: 0 6px; }',
            '  .hbtn--primary { background: rgba(14,127,193,0.14); border-color: rgba(14,127,193,0.55); color: #0a6aa8; }',
            '  .hbtn--primary:hover { background: rgba(14,127,193,0.26); }',
            '  .hbtn--end { background: rgba(197,73,63,0.14); border-color: rgba(197,73,63,0.55); color: #b0362c; }',
            '  .hbtn--end:hover { background: rgba(197,73,63,0.26); }',
            '  .pill.md--dark .hbtn { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.22); color: #e6edf5; }',
            '  .pill.md--dark .hbtn:hover { background: rgba(255,255,255,0.20); }',
            '  .pill.md--dark .hbtn--primary { background: rgba(74,143,232,0.32); border-color: rgba(74,143,232,0.6); color: #cfe0ee; }',
            '  .pill.md--dark .hbtn--primary:hover { background: rgba(74,143,232,0.46); }',
            '  .pill.md--dark .hbtn--end { background: rgba(213,73,63,0.34); border-color: rgba(213,73,63,0.6); color: #f0b6b0; }',
            '  .pill.md--dark .hbtn--end:hover { background: rgba(213,73,63,0.50); }',
            '</style>',
            '<div class="pill' + (_darkMode ? ' md--dark' : '') + '" id="pill">',
            '  <span class="dot" id="dot" title="' + _slaEsc(_t('relayStatus')) + '"></span>',
            '  <button class="hbtn hbtn--primary" id="open-btn" title="' + _slaEsc(_t('openCrm')) + '">',
            '    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">',
            '      <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>',
            '    </svg>',
            '    <span class="btn-label">CRM</span>',
            '  </button>',
            '  <button class="hbtn hbtn--icon" id="requeue-btn" title="' + _slaEsc(_t('requeueBtn')) + '">',
            '    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">',
            '      <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>',
            '    </svg>',
            '  </button>',
            '  <button class="hbtn hbtn--end" id="endshift-btn" title="' + _slaEsc(_t('endShiftTip')) + '">',
            '    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">',
            '      <path d="M16 17v-2H9v-2h7V9l4 4-4 4zM14 2a2 2 0 012 2v3h-2V4H5v16h9v-3h2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V4a2 2 0 012-2h9z"/>',
            '    </svg>',
            '    <span>' + _slaEsc(_t('endShiftLabel')) + '</span>',
            '  </button>',
            '  <button class="hbtn hbtn--icon" id="sla-btn" title="' + _slaEsc(_t('slaSettings')) + '">',
            '    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">',
            '      <path d="M19.14 12.94a7.6 7.6 0 000-1.88l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.61-.22l-2.39.96a7 7 0 00-1.62-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.58.24-1.12.56-1.62.94l-2.39-.96a.5.5 0 00-.61.22L2.68 8.84a.5.5 0 00.12.64l2.03 1.58a7.6 7.6 0 000 1.88l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.14.24.42.32.61.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .45-.18.5-.42l.36-2.54c.58-.24 1.12-.56 1.62-.94l2.39.96c.19.1.47.02.61-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z"/>',
            '    </svg>',
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
          shadow.getElementById('sla-btn').addEventListener('click', _toggleSlaPanel);
          shadow.getElementById('endshift-btn').addEventListener('click', _openEndShiftConfirm);
          shadow.getElementById('requeue-btn').addEventListener('click', _rqOpenManual);
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

      // Explicit Tab Manager base URL (static host). Overrides the wsurl-derived
      // host; lets the relay leave the serving path entirely.
      set managerurl(value) { _managerUrl = value || null; }
      get managerurl() { return _managerUrl; }

      // Auto-close the CRM view when its interaction ends. Forwarded to the Tab
      // Manager as ?autoclose=1|0 so it is layout-driven, not dependent on the
      // Tab Manager origin's localStorage (which resets when the host changes).
      set autoclose(value) {
        if (value === null || value === undefined || value === '') { _autoCloseCrm = null; return; }
        _autoCloseCrm = (value === true || value === 'true' || value === '1' || value === 'autoclose');
      }
      get autoclose() { return _autoCloseCrm; }

      // Transport selector: 'relay' (default) or 'bridge' (peer-to-peer postMessage).
      set transport(value) {
        var v = String(value || '').toLowerCase();
        var mode = (v === 'bridge' || v === 'postmessage' || v === 'p2p') ? 'bridge' : 'relay';
        if (mode === _transport) return;
        _transport = mode;
        if (mode === 'bridge') {
          if (_relayWs) { try { _relayWs.close(); } catch (_) {} _relayWs = null; _relayReady = false; }
          _bridgeStart();
          if (_autoOpenManager) _openCrmTabManager();
        }
        _tickStatus();
      }
      get transport() { return _transport; }

      set accesstoken(value) { this._accesstoken = value; _accessToken = value || ''; _configureActivity(); }
      get accesstoken() { return this._accesstoken; }

      set autoopen(value) {
        _autoOpenManager = (value === true || value === 'true' || value === '' ||
                            value === 'autoopen' || value === '1');
        // If a transport is already connected when this is set, honour it immediately.
        if (_autoOpenManager && (_relayReady || _transport === 'bridge')) _openCrmTabManager();
      }
      get autoopen() { return _autoOpenManager; }

      set darkmode(value) {
        var isDark = (value === true || value === 'true' || value === '1');
        if (_darkMode === isDark) return; // no change
        _darkMode = isDark;
        _applyPillTheme();
        _relaySend({ type: 'THEME_CHANGED', darkMode: _darkMode });
      }
      get darkmode() { return _darkMode; }

      set orgid(value) { this._orgid = value; _orgId = value || null; _configureActivity(); }
      set datacenter(value) { this._datacenter = value; _jdsDataCenter = value || ''; }
      set workspaceid(value) { this._workspaceid = value; _jdsWorkspaceId = value || ''; }

      /* ── SLA focus-mode properties ─────────────────────────────────────── */
      // Map in the Desktop layout, e.g.:
      //   "slavariable":         "Jmartan_SLAExpires",
      //   "slathresholdminutes": "15"
      set slavariable(value) {
        this._slavariable = value;
        _slaVariable = value || '';
        // The Desktop may apply `slavariable` AFTER `task`; re-capture the current
        // task's SLA now that the CAD variable name is known.
        if (this._task) { try { handleTaskSync(this._task); } catch (e) { /* ignore */ } }
      }
      get slavariable() { return _slaVariable; }

      set slathresholdminutes(value) {
        this._slathresholdminutes = value;
        var n = Number(value);
        if (isFinite(n) && n > 0) _slaThresholdMin = n;
      }
      get slathresholdminutes() { return _slaThresholdMin; }

      /* ── Activity analytics properties ─────────────────────────────────── */
      // Map in the Desktop layout, e.g.:
      //   "activityurl": "https://<region>-<project>.cloudfunctions.net/activity",
      //   "agentid":     "$STORE.agent.agentId",
      //   "agentname":   "$STORE.agent.agentName"
      set activityurl(value) { this._activityurl = value; _activityUrl = value || null; _configureActivity(); }
      get activityurl() { return _activityUrl; }

      set agentid(value) { this._agentid = value; _agentId = value || null; _configureActivity(); }
      get agentid() { return _agentId; }

      set agentname(value) { this._agentname = value; _agentName = value || null; _configureActivity(); }
      get agentname() { return _agentName; }
    });
  }

})();

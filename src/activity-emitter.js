/**
 * activity-emitter.js
 *
 * Shared, dependency-free activity-event emitter for the Webex CC Desktop
 * headless widgets (crm-sync-header.js + panel-layout-headless.js).
 *
 * It captures two event streams that together drive the agent activity
 * timeline analytics:
 *   1. Interaction lifecycle  — task_offered | task_accepted | wrapup |
 *                               task_ended | rona | declined   (the swim-lane bars)
 *   2. Focus / attention      — focus_gained | focus_lost      (interruptions +
 *                               true time-on-task, i.e. which interaction the
 *                               agent was actually looking at)
 *
 * Events are batched and POSTed to the ingest endpoint (a GCP Cloud Function)
 * as `{ events: [ ... ] }`. When no ingest URL is configured the emitter runs
 * in DEMO mode: it logs each event and keeps a ring buffer retrievable via
 * `window.__wxActivity.dump()` — useful for the standalone dev harness.
 *
 * This file is intentionally a plain ES5 IIFE (no bundler) so it can be served
 * as a static asset alongside the other headless scripts and loaded via a
 * <script> tag in the Desktop layout JSON. It MUST be loaded before the other
 * headless scripts so `window.__wxActivity` exists when they emit.
 *
 * Desktop layout usage (area.headless):
 *   { "comp": "activity-emitter", "script": "https://<host>/dist/activity-emitter.js" }
 *
 * Configuration is applied by crm-sync-header.js via its `activityurl`,
 * `agentid`, `agentname`, `orgid` and `accesstoken` properties, which call
 * window.__wxActivity.configure({ ... }).
 */
(function () {
  'use strict';

  if (window.__wxActivity) return; // idempotent — never double-install

  var VALID_EVENTS = {
    task_offered: 1, task_accepted: 1, focus_gained: 1, focus_lost: 1,
    wrapup: 1, task_ended: 1, rona: 1, declined: 1,
  };

  var MAX_BATCH   = 20;     // flush when this many events are queued
  var FLUSH_MS    = 2000;   // …or after this idle interval
  var MAX_RING    = 500;    // demo-mode ring buffer size
  var MAX_RETRY   = 5;      // per-batch retry attempts before dropping

  var _config = {
    ingestUrl:   null,
    agentId:     'unknown',
    agentName:   null,
    orgId:       null,
    sessionId:   null,
    accessToken: '',
    enabled:     true,
  };

  var _queue      = [];     // pending events awaiting flush
  var _ring       = [];     // demo-mode last-N buffer
  var _flushTimer = null;
  var _retryTimer = null;
  var _retries    = 0;

  function _genId() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
  }

  // Per-load session id (approximates an agent shift). Overridable via configure().
  var _defaultSession = (function () {
    try {
      var id = sessionStorage.getItem('wx_activity_session');
      if (!id) { id = _genId(); sessionStorage.setItem('wx_activity_session', id); }
      return id;
    } catch (e) {
      return _genId();
    }
  })();
  _config.sessionId = _defaultSession;

  function configure(opts) {
    if (!opts) return;
    if (opts.ingestUrl   !== undefined) _config.ingestUrl   = opts.ingestUrl || null;
    if (opts.agentId     !== undefined) _config.agentId     = opts.agentId || 'unknown';
    if (opts.agentName   !== undefined) _config.agentName   = opts.agentName || null;
    if (opts.orgId       !== undefined) _config.orgId       = opts.orgId || null;
    if (opts.sessionId   !== undefined) _config.sessionId   = opts.sessionId || _defaultSession;
    if (opts.accessToken !== undefined) _config.accessToken = opts.accessToken || '';
    if (opts.enabled     !== undefined) _config.enabled     = opts.enabled !== false;
    console.log('[activity-emitter] configured | ingest:', _config.ingestUrl ? 'live' : 'demo',
      '| agent:', _config.agentId);
  }

  /**
   * Emit an activity event.
   * @param {string} eventType one of VALID_EVENTS
   * @param {object} data      { interactionId, channel, customerId, queue }
   */
  function emit(eventType, data) {
    if (!_config.enabled) return;
    if (!VALID_EVENTS[eventType]) {
      console.warn('[activity-emitter] ignoring unknown event type:', eventType);
      return;
    }
    data = data || {};
    var event = {
      event_ts:       new Date().toISOString(),
      agent_id:       _config.agentId,
      agent_name:     _config.agentName,
      session_id:     _config.sessionId,
      interaction_id: data.interactionId || null,
      channel:        (data.channel || '').toLowerCase() || null,
      event_type:     eventType,
      customer_id:    data.customerId || null,
      queue:          data.queue || null,
      org_id:         _config.orgId,
    };

    _pushRing(event);

    if (!_config.ingestUrl) {
      // Demo mode — surface the event for the dev harness / console.
      console.log('[activity-emitter][demo]', eventType, event);
      return;
    }

    _queue.push(event);
    if (_queue.length >= MAX_BATCH) {
      _flush();
    } else {
      _scheduleFlush();
    }
  }

  function _pushRing(event) {
    _ring.push(event);
    if (_ring.length > MAX_RING) _ring.shift();
  }

  function _scheduleFlush() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(function () { _flushTimer = null; _flush(); }, FLUSH_MS);
  }

  function _flush() {
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
    if (!_config.ingestUrl || _queue.length === 0) return;

    var batch = _queue.splice(0, _queue.length);
    var headers = { 'Content-Type': 'application/json' };
    if (_config.accessToken) headers.Authorization = 'Bearer ' + _config.accessToken;

    fetch(_config.ingestUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    }).then(function (res) {
      if (!res.ok) throw new Error('ingest HTTP ' + res.status);
      _retries = 0;
    }).catch(function (err) {
      // Re-queue the failed batch and back off; drop after MAX_RETRY to avoid
      // unbounded growth if the endpoint is down for the whole shift.
      console.warn('[activity-emitter] flush failed:', err.message);
      if (_retries >= MAX_RETRY) {
        console.warn('[activity-emitter] dropping', batch.length, 'events after', MAX_RETRY, 'retries');
        _retries = 0;
        return;
      }
      _retries++;
      _queue = batch.concat(_queue);
      if (_retryTimer) clearTimeout(_retryTimer);
      _retryTimer = setTimeout(_flush, Math.min(1000 * _retries, 10000));
    });
  }

  // Best-effort flush on page hide/unload so end-of-shift events are not lost.
  function _beaconFlush() {
    if (!_config.ingestUrl || _queue.length === 0) return;
    try {
      var batch = _queue.splice(0, _queue.length);
      var blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' });
      if (navigator.sendBeacon && navigator.sendBeacon(_config.ingestUrl, blob)) return;
      _queue = batch.concat(_queue); // beacon unavailable/failed — restore for a normal flush
      _flush();
    } catch (e) { /* ignore */ }
  }

  window.addEventListener('pagehide', _beaconFlush);
  window.addEventListener('beforeunload', _beaconFlush);

  window.__wxActivity = {
    configure: configure,
    emit: emit,
    flush: _flush,
    dump: function () { return _ring.slice(); },
    getConfig: function () {
      // Never expose the access token.
      return {
        ingestUrl: _config.ingestUrl, agentId: _config.agentId, agentName: _config.agentName,
        orgId: _config.orgId, sessionId: _config.sessionId, enabled: _config.enabled,
        queued: _queue.length, buffered: _ring.length,
      };
    },
  };

  console.log('[activity-emitter] ready (demo mode until configured with an ingest URL)');
})();

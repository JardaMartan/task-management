'use strict';

/**
 * activity.js
 *
 * Agent activity analytics ingest + query for the Webex CC activity timeline.
 *
 * Two responsibilities:
 *   1. ingestEvents()      — validate a batch of activity events from the
 *                            headless widget emitter (src/activity-emitter.js)
 *                            and persist them to BigQuery (historical analytics)
 *                            and Firestore (live per-agent stream).
 *   2. queryAgentEvents()  — fetch an agent's events for a time range from
 *                            BigQuery, powering the reporting widget's
 *                            HISTORICAL timeline.
 *
 * Clients are lazily initialised so the module loads even without GCP
 * credentials (e.g. local dev / demo): in that case writes are logged and
 * skipped rather than throwing.
 *
 * Env vars:
 *   BQ_DATASET   BigQuery dataset id      (default: agent_activity)
 *   BQ_TABLE     BigQuery table id        (default: events)
 *   FS_COLLECTION Firestore root collection (default: agent_activity_live)
 *   FS_LIVE_TTL_MS  Optional: max age of live docs to keep (informational)
 */

const VALID_EVENTS = new Set([
  'task_offered', 'task_accepted', 'focus_gained', 'focus_lost',
  'wrapup', 'task_ended', 'rona', 'declined',
]);

const BQ_DATASET    = process.env.BQ_DATASET    || 'agent_activity';
const BQ_TABLE      = process.env.BQ_TABLE      || 'events';
const FS_COLLECTION = process.env.FS_COLLECTION || 'agent_activity_live';

let _bq = null;
let _bqReady;
let _fs = null;
let _fsReady;

function _getBigQuery() {
  if (_bqReady !== undefined) return _bq;
  try {
    const { BigQuery } = require('@google-cloud/bigquery');
    _bq = new BigQuery();
    _bqReady = true;
  } catch (err) {
    console.warn('[activity] BigQuery unavailable — historical writes disabled:', err.message);
    _bq = null;
    _bqReady = false;
  }
  return _bq;
}

function _getFirestore() {
  if (_fsReady !== undefined) return _fs;
  try {
    const { Firestore } = require('@google-cloud/firestore');
    _fs = new Firestore();
    _fsReady = true;
  } catch (err) {
    console.warn('[activity] Firestore unavailable — live stream disabled:', err.message);
    _fs = null;
    _fsReady = false;
  }
  return _fs;
}

/**
 * Normalise + validate a single raw event. Returns a clean row or null if the
 * event is malformed (missing type / interaction id).
 */
function _normalizeEvent(raw, ingestTs) {
  if (!raw || typeof raw !== 'object') return null;
  if (!VALID_EVENTS.has(raw.event_type)) return null;
  if (!raw.interaction_id) return null;

  // Coerce event_ts to a valid ISO timestamp; fall back to ingest time.
  let eventTs = raw.event_ts;
  const parsed = eventTs ? Date.parse(eventTs) : NaN;
  if (Number.isNaN(parsed)) eventTs = ingestTs;

  // Privacy: only opaque task-related data is persisted. Customer identity
  // (id / name / phone) is deliberately NOT stored — it is resolved live from the
  // Webex CC Search API at query time when the timeline is assembled.
  return {
    event_ts:       eventTs,
    agent_id:       String(raw.agent_id || 'unknown'),
    agent_name:     raw.agent_name != null ? String(raw.agent_name) : null,
    session_id:     raw.session_id != null ? String(raw.session_id) : null,
    interaction_id: String(raw.interaction_id),
    channel:        raw.channel != null ? String(raw.channel).toLowerCase() : null,
    event_type:     raw.event_type,
    queue:          raw.queue != null ? String(raw.queue) : null,
    org_id:         raw.org_id != null ? String(raw.org_id) : null,
    ingest_ts:      ingestTs,
  };
}

/**
 * Ingest a batch of activity events.
 * @param {Array<object>} events raw events from the emitter
 * @returns {Promise<{accepted:number, rejected:number, bigquery:boolean, firestore:boolean}>}
 */
async function ingestEvents(events) {
  if (!Array.isArray(events)) {
    throw new Error('events must be an array');
  }
  const ingestTs = new Date().toISOString();
  const rows = [];
  let rejected = 0;
  for (const raw of events) {
    const row = _normalizeEvent(raw, ingestTs);
    if (row) rows.push(row);
    else rejected++;
  }

  if (rows.length === 0) {
    return { accepted: 0, rejected, bigquery: false, firestore: false };
  }

  const [bqOk, fsOk] = await Promise.all([
    _writeBigQuery(rows).catch((err) => {
      console.error('[activity] BigQuery insert failed:', err.message);
      return false;
    }),
    _writeFirestore(rows).catch((err) => {
      console.error('[activity] Firestore write failed:', err.message);
      return false;
    }),
  ]);

  return { accepted: rows.length, rejected, bigquery: bqOk, firestore: fsOk };
}

async function _writeBigQuery(rows) {
  const bq = _getBigQuery();
  if (!bq) {
    console.log('[activity][demo] would insert', rows.length, 'rows into BigQuery', `${BQ_DATASET}.${BQ_TABLE}`);
    return false;
  }
  await bq.dataset(BQ_DATASET).table(BQ_TABLE).insert(rows);
  console.log('[activity] inserted', rows.length, 'rows into', `${BQ_DATASET}.${BQ_TABLE}`);
  return true;
}

async function _writeFirestore(rows) {
  const fs = _getFirestore();
  if (!fs) {
    console.log('[activity][demo] would stream', rows.length, 'events to Firestore', FS_COLLECTION);
    return false;
  }
  // Live stream: append each event under agent_activity_live/{agentId}/events.
  // The reporting widget subscribes to this subcollection (ordered by event_ts).
  const batch = fs.batch();
  for (const row of rows) {
    const ref = fs
      .collection(FS_COLLECTION)
      .doc(row.agent_id)
      .collection('events')
      .doc();
    batch.set(ref, row);
    // Keep a lightweight "latest" doc per agent for quick presence/overview.
    const agentRef = fs.collection(FS_COLLECTION).doc(row.agent_id);
    batch.set(
      agentRef,
      { agent_id: row.agent_id, agent_name: row.agent_name, last_event_ts: row.event_ts, last_event_type: row.event_type },
      { merge: true }
    );
  }
  await batch.commit();
  console.log('[activity] streamed', rows.length, 'events to Firestore', FS_COLLECTION);
  return true;
}

/**
 * Query an agent's events for a time range (historical timeline).
 * @param {object} p
 * @param {string} p.agentId   required
 * @param {string} [p.from]    ISO start (default: 24h ago)
 * @param {string} [p.to]      ISO end   (default: now)
 * @param {number} [p.limit]   max rows  (default: 5000)
 * @returns {Promise<Array<object>>}
 */
async function queryAgentEvents({ agentId, agentIds, from, to, limit } = {}) {
  const ids = (Array.isArray(agentIds) && agentIds.length)
    ? [...new Set(agentIds.filter(Boolean))]
    : (agentId ? [agentId] : []);
  if (!ids.length) throw new Error('agentId is required');
  const bq = _getBigQuery();
  if (!bq) {
    console.log('[activity][demo] would query events for', ids.join(','));
    return [];
  }
  const fromTs = from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const toTs   = to || new Date().toISOString();
  const maxRows = Math.min(Number(limit) || 5000, 20000);

  const query = `
    SELECT event_ts, agent_id, agent_name, session_id, interaction_id,
           channel, event_type, queue, org_id
    FROM \`${BQ_DATASET}.${BQ_TABLE}\`
    WHERE agent_id IN UNNEST(@agentIds)
      AND event_ts >= TIMESTAMP(@fromTs)
      AND event_ts <= TIMESTAMP(@toTs)
    ORDER BY event_ts ASC
    LIMIT @maxRows`;

  const [job] = await bq.createQueryJob({
    query,
    params: { agentIds: ids, fromTs, toTs, maxRows },
    types: { agentIds: ['STRING'], fromTs: 'STRING', toTs: 'STRING', maxRows: 'INT64' },
  });
  const [rows] = await job.getQueryResults();
  return rows.map((r) => ({
    ...r,
    event_ts: r.event_ts && r.event_ts.value ? r.event_ts.value : r.event_ts,
  }));
}

/**
 * Query ALL agents' events for a time range (team occupancy view).
 * @param {object} p
 * @param {string} [p.from]  ISO start (default: 24h ago)
 * @param {string} [p.to]    ISO end   (default: now)
 * @param {number} [p.limit] max rows  (default: 20000)
 * @returns {Promise<Array<object>>}
 */
async function queryTeamEvents({ from, to, limit } = {}) {
  const bq = _getBigQuery();
  if (!bq) {
    console.log('[activity][demo] would query team events');
    return [];
  }
  const fromTs = from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const toTs   = to || new Date().toISOString();
  const maxRows = Math.min(Number(limit) || 20000, 50000);

  const query = `
    SELECT event_ts, agent_id, agent_name, session_id, interaction_id,
           channel, event_type, queue, org_id
    FROM \`${BQ_DATASET}.${BQ_TABLE}\`
    WHERE event_ts >= TIMESTAMP(@fromTs)
      AND event_ts <= TIMESTAMP(@toTs)
    ORDER BY agent_id ASC, event_ts ASC
    LIMIT @maxRows`;

  const [job] = await bq.createQueryJob({ query, params: { fromTs, toTs, maxRows } });
  const [rows] = await job.getQueryResults();
  return rows.map((r) => ({
    ...r,
    event_ts: r.event_ts && r.event_ts.value ? r.event_ts.value : r.event_ts,
  }));
}

/**
 * List distinct agents that have activity events (for the reporting picker).
 * @param {object} [p]
 * @param {number} [p.days] look-back window in days (default: 30)
 * @returns {Promise<Array<{id:string, name:string}>>}
 */
async function queryAgents({ days, from, to } = {}) {
  const bq = _getBigQuery();
  if (!bq) {
    console.log('[activity][demo] would list agents');
    return [];
  }
  // Explicit [from, to] window (range-scoped roster) takes precedence; otherwise
  // fall back to a rolling look-back in days.
  if (from || to) {
    const fromTs = from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const toTs = to || new Date().toISOString();
    const query = `
      SELECT agent_id, ANY_VALUE(agent_name) AS agent_name, MAX(event_ts) AS last_ts
      FROM \`${BQ_DATASET}.${BQ_TABLE}\`
      WHERE event_ts >= TIMESTAMP(@fromTs) AND event_ts <= TIMESTAMP(@toTs)
      GROUP BY agent_id
      ORDER BY last_ts DESC`;
    const [job] = await bq.createQueryJob({ query, params: { fromTs, toTs } });
    const [rows] = await job.getQueryResults();
    return rows.map((r) => ({ id: r.agent_id, name: r.agent_name || r.agent_id }));
  }
  const lookback = Math.min(Math.max(Number(days) || 30, 1), 365);
  const query = `
    SELECT agent_id, ANY_VALUE(agent_name) AS agent_name, MAX(event_ts) AS last_ts
    FROM \`${BQ_DATASET}.${BQ_TABLE}\`
    WHERE event_ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @lookback DAY)
    GROUP BY agent_id
    ORDER BY last_ts DESC`;
  const [job] = await bq.createQueryJob({ query, params: { lookback } });
  const [rows] = await job.getQueryResults();
  return rows.map((r) => ({ id: r.agent_id, name: r.agent_name || r.agent_id }));
}

module.exports = { ingestEvents, queryAgentEvents, queryTeamEvents, queryAgents, VALID_EVENTS };

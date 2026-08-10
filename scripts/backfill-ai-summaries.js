#!/usr/bin/env node
/*
 * Backfill AI interaction wrap-up summaries into JDS — ANY channel.
 *
 * WHY: the AI post-call summary text is only served by the ai-assistant
 * `summary/list` endpoint, which has a short retention window (~1-2 days) and
 * covers every channel (voice, email, chat, social, work-item). Once it expires
 * the summary is gone for good (Webex CC Search exposes sentiment / CSAT / topic
 * / wrap-up code, but NOT the summary text). This script pulls the summaries
 * that are STILL available for the most recent interactions and writes them to
 * JDS as `task:wrapup-summary` events — the exact shape the widget reads
 * (pickStoredSummaryForTask) and writes (persistTaskSummaryToJds) — so they
 * survive indefinitely and show up in the History and Voice panels.
 *
 * Credentials are read from env vars — the token is a secret, never commit it.
 *
 * Usage:
 *   WXCC_TOKEN=<desktop bearer token> \
 *   node scripts/backfill-ai-summaries.js [--limit 500] [--days 3] [--channel telephony] [--dry-run]
 *
 * Optional env overrides:
 *   WS_ID     JDS workspace id      (default 6682a446abe8cf671b34f47c)
 *   ORG_ID    org id                (default: derived from the token tail)
 *   REGION    Webex CC region       (default eu1)  -> api.wxcc-<REGION>.cisco.com
 *   AI_DC     ai-assistant dc       (default prodeu1) -> api-ai-assistant.<AI_DC>.ciscoccservice.com
 */

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const DRY_RUN = args.includes('--dry-run');
const LIMIT = parseInt(flag('limit', '500'), 10);
const DAYS = parseInt(flag('days', '3'), 10);
// Optional single-channel filter (telephony|email|chat|social|workItem); all channels by default.
const CHANNEL = flag('channel', null);

const TOKEN = process.env.WXCC_TOKEN;
const WS = process.env.WS_ID || '6682a446abe8cf671b34f47c';
const REGION = process.env.REGION || 'eu1';
const AI_DC = process.env.AI_DC || 'prodeu1';
// The org id is the last underscore-delimited segment of the desktop token.
const ORG = process.env.ORG_ID || (TOKEN ? TOKEN.split('_').pop() : null);

const SEARCH_HOST = `https://api.wxcc-${REGION}.cisco.com`;
const AI_HOST = `https://api-ai-assistant.${AI_DC}.ciscoccservice.com`;

if (!TOKEN) {
  console.error('ERROR: set WXCC_TOKEN (the Webex CC desktop bearer token) in the environment.');
  process.exit(1);
}
if (!ORG) {
  console.error('ERROR: could not derive ORG_ID from the token — set ORG_ID explicitly.');
  process.exit(1);
}

const authHeaders = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

/** Human-readable labels for the summary text stored in JDS (matches the widget). */
const LABELS = {
  initialContactReason: 'Contact reason',
  additionalContext: 'Details',
  additionalContactReasons: 'Additional topics',
  keyActionsTaken: 'Actions taken',
  nextSteps: 'Next steps',
};

/** Convert an ai-assistant POST_CALL summary into the JDS { sections, text } shape. */
const toJdsPayload = (summary) => {
  const sections = {
    initialContactReason: summary.initialContactReason || '',
    additionalContext: summary.additionalContext || '',
    additionalContactReasons: summary.additionalContactReasons || '',
    keyActionsTaken: summary.keyActionsTaken || '',
    nextSteps: summary.nextSteps || '',
  };
  const text = Object.keys(LABELS)
    .filter((k) => sections[k] && String(sections[k]).trim())
    .map((k) => `${LABELS[k]}: ${sections[k]}`)
    .join('\n');
  return { sections, text };
};

/** The N most recent interactions (id + customer origin) via Search, any channel. */
async function fetchRecentInteractions(limit, days, channel) {
  const now = Date.now();
  const from = now - days * 86400000;
  const filterArg = channel ? `, filter:{channelType:{equals: ${channel}}}` : '';
  const query =
    `query T($from: Long!, $to: Long!){ taskDetails(from:$from,to:$to${filterArg})` +
    '{ tasks { id createdTime channelType direction origin lastWrapupCodeName } } }';
  const res = await fetch(`${SEARCH_HOST}/search`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ query, variables: { from, to: now } }),
  });
  const json = await res.json();
  if (!res.ok || json.error || json.errors) {
    throw new Error(`Search failed: ${JSON.stringify(json.error || json.errors || json).slice(0, 300)}`);
  }
  const tasks = json.data?.taskDetails?.tasks || [];
  return tasks
    .filter((t) => t.id)
    .sort((a, b) => (b.createdTime || 0) - (a.createdTime || 0))
    .slice(0, limit);
}

/** Fetch the POST_CALL summary for one interaction, or null when unavailable/expired. */
async function fetchSummary(interactionId) {
  const res = await fetch(`${AI_HOST}/summary/list`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ orgId: ORG, interactionId, searchType: 'INTERACTION' }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const pc = data?.summaries?.POST_CALL;
  const key = pc && Object.keys(pc)[0];
  return key ? pc[key] : null;
}

/**
 * taskIds that already have a stored wrap-up summary (either our backfilled
 * task:wrapup-summary or the widget's own email:wrapup-summary) — skip those so
 * we never write a duplicate for an interaction that already has one.
 */
async function fetchAlreadyStoredTaskIds() {
  const stored = new Set();
  for (const type of ['task:wrapup-summary', 'email:wrapup-summary']) {
    for (let page = 1; page <= 5; page += 1) {
      const url =
        `${SEARCH_HOST}/v1/api/events/workspace-id/${WS}` +
        `?filter=${encodeURIComponent(`type==${type}`)}&page=${page}&pageSize=100`;
      const res = await fetch(url, { headers: authHeaders });
      if (!res.ok) break;
      const data = await res.json();
      const rows = data?.data || (Array.isArray(data) ? data : []);
      if (!rows.length) break;
      rows.forEach((e) => { const id = e?.data?.taskId; if (id) stored.add(id); });
      if (rows.length < 100) break;
    }
  }
  return stored;
}

/** Publish a task:wrapup-summary CloudEvent to JDS (identity = customer number). */
async function publishSummary({ taskId, identity, sections, text }) {
  const identitytype = String(identity).includes('@') ? 'email' : 'phone';
  const event = {
    id: (globalThis.crypto?.randomUUID?.() || require('crypto').randomUUID()),
    specversion: '1.0',
    type: 'task:wrapup-summary',
    source: 'task-management-backfill',
    time: new Date().toISOString(),
    eventTime: Date.now(),
    identity,
    identitytype,
    datacontenttype: 'application/json',
    data: { summary: text, sections, taskId },
  };
  const res = await fetch(`${SEARCH_HOST}/publish/v1/api/event?workspaceId=${WS}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    throw new Error(`publish ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

async function main() {
  console.log(`Backfill AI wrap-up summaries -> JDS  (region=${REGION}, ai-dc=${AI_DC}, ws=${WS})`);
  console.log(`limit=${LIMIT}  window=${DAYS}d  channel=${CHANNEL || 'ALL'}  ${DRY_RUN ? '[DRY RUN — no writes]' : ''}\n`);

  const calls = await fetchRecentInteractions(LIMIT, DAYS, CHANNEL);
  console.log(`Found ${calls.length} recent interaction(s).`);
  if (!calls.length) return;

  const alreadyStored = await fetchAlreadyStoredTaskIds();
  if (alreadyStored.size) console.log(`${alreadyStored.size} already have a stored summary (will skip).\n`);

  let saved = 0; let expired = 0; let skipped = 0; let failed = 0;
  for (const call of calls) {
    const when = call.createdTime ? new Date(call.createdTime).toISOString().slice(0, 16) : '?';
    const ch = String(call.channelType || '?').padEnd(9);
    const tag = `${when}  ${ch} ${call.id}`;

    if (alreadyStored.has(call.id)) { console.log(`⏭  ${tag}  already stored`); skipped += 1; continue; }

    let summary = null;
    try { summary = await fetchSummary(call.id); }
    catch (err) { console.log(`✖  ${tag}  summary error: ${err.message}`); failed += 1; continue; }

    if (!summary) { console.log(`·  ${tag}  no summary (expired / never generated)`); expired += 1; continue; }

    const { sections, text } = toJdsPayload(summary);
    if (!text) { console.log(`·  ${tag}  summary empty after normalise`); expired += 1; continue; }

    const identity = call.origin;
    if (!identity || !(String(identity).includes('@') || /\d/.test(String(identity)))) {
      console.log(`⚠  ${tag}  no usable customer identity (origin='${identity}') — cannot key event`);
      skipped += 1; continue;
    }

    if (DRY_RUN) {
      console.log(`✓  ${tag}  WOULD SAVE (identity=${identity}) :: ${text.replace(/\n/g, ' | ').slice(0, 90)}…`);
      saved += 1; continue;
    }
    try {
      await publishSummary({ taskId: call.id, identity, sections, text });
      console.log(`✓  ${tag}  SAVED (identity=${identity})`);
      saved += 1;
    } catch (err) {
      console.log(`✖  ${tag}  publish failed: ${err.message}`);
      failed += 1;
    }
  }

  console.log(`\nDone. saved=${saved}  expired/none=${expired}  skipped=${skipped}  failed=${failed}`);
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });

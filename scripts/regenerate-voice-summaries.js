#!/usr/bin/env node
/*
 * Regenerate AI wrap-up summaries for voice calls whose native summary has
 * EXPIRED, and store them durably in JDS.
 *
 * The ai-assistant `summary/list` endpoint only keeps summaries ~1-2 days. Once
 * gone they cannot be re-queried. This script rebuilds them from the durable
 * call TRANSCRIPT (Captures API, via the deployed transcript proxy) using the
 * same Gemini model + structured wrap-up prompt the widget uses, then writes a
 * `task:wrapup-summary` CloudEvent to JDS — the shape the History/Voice panels
 * read (pickStoredSummaryForTask). Regenerated summaries are flagged in the
 * event data (`regenerated: true`).
 *
 * Credentials are read from env vars — the token is a secret, never commit it.
 *
 * Usage:
 *   WXCC_TOKEN=<desktop bearer token> \
 *   node scripts/regenerate-voice-summaries.js [--limit 20] [--days 30] [--dry-run] [--force]
 *
 * Env overrides:
 *   WS_ID, ORG_ID, REGION(eu1), AI_DC(prodeu1),
 *   TRANSCRIPT_URL(https://transcript-xmsnecntoq-uc.a.run.app),
 *   TOKEN_BROKER_URL(https://auth-xmsnecntoq-uc.a.run.app),
 *   GEMINI_MODEL(gemini-2.5-flash)
 */

const { randomUUID } = require('crypto');

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force'); // regenerate even if a summary is already stored/available
const LIMIT = parseInt(flag('limit', '20'), 10);
const DAYS = parseInt(flag('days', '30'), 10);

const TOKEN = process.env.WXCC_TOKEN;
const WS = process.env.WS_ID || '6682a446abe8cf671b34f47c';
const REGION = process.env.REGION || 'eu1';
const AI_DC = process.env.AI_DC || 'prodeu1';
const ORG = process.env.ORG_ID || (TOKEN ? TOKEN.split('_').pop() : null);
const TRANSCRIPT_URL = process.env.TRANSCRIPT_URL || 'https://transcript-xmsnecntoq-uc.a.run.app';
const TOKEN_BROKER_URL = process.env.TOKEN_BROKER_URL || 'https://auth-xmsnecntoq-uc.a.run.app';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SEARCH_HOST = `https://api.wxcc-${REGION}.cisco.com`;
const AI_HOST = `https://api-ai-assistant.${AI_DC}.ciscoccservice.com`;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

if (!TOKEN) { console.error('ERROR: set WXCC_TOKEN in the environment.'); process.exit(1); }
if (!ORG) { console.error('ERROR: could not derive ORG_ID from the token — set ORG_ID.'); process.exit(1); }

const authHeaders = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const SECTION_KEYS = ['initialContactReason', 'additionalContext', 'additionalContactReasons', 'keyActionsTaken', 'nextSteps'];
const LABELS = {
  initialContactReason: 'Contact reason',
  additionalContext: 'Details',
  additionalContactReasons: 'Additional topics',
  keyActionsTaken: 'Actions taken',
  nextSteps: 'Next steps',
};

/** Structured wrap-up prompt for a voice call transcript (matches the widget's fields). */
const buildVoicePrompt = (transcriptText) => `You are filling a structured wrap-up form for a customer-support PHONE CALL.
Detect the language of the transcript and write EVERY field in that SAME language.
Be VERY concise: each field at most one short sentence (a few words is ideal). Use "" for any field that is not clearly known. Do not repeat the same content across fields.
Fields:
- initialContactReason: the core reason the customer called
- additionalContext: key specifics/details
- additionalContactReasons: any secondary topic ("" if none)
- keyActionsTaken: what the agent did or resolved on the call
- nextSteps: any follow-up or promised action ("" if none)

CALL TRANSCRIPT:
${transcriptText}

Respond with JSON only:
{ "initialContactReason": "", "additionalContext": "", "additionalContactReasons": "", "keyActionsTaken": "", "nextSteps": "" }`;

const parseSections = (raw) => {
  const empty = () => SECTION_KEYS.reduce((a, k) => { a[k] = ''; return a; }, {});
  try {
    const m = String(raw).match(/\{[\s\S]*\}/);
    const o = m ? JSON.parse(m[0]) : {};
    const out = empty();
    SECTION_KEYS.forEach((k) => { out[k] = typeof o[k] === 'string' ? o[k].trim() : ''; });
    return out;
  } catch { return empty(); }
};

const sectionsToText = (sections) => Object.keys(LABELS)
  .filter((k) => sections[k] && String(sections[k]).trim())
  .map((k) => `${LABELS[k]}: ${sections[k]}`)
  .join('\n');

/** Mint a Gemini Bearer token via the widget's token broker. */
async function getGeminiToken() {
  const res = await fetch(TOKEN_BROKER_URL, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ scope: 'gmail.readonly' }),
  });
  if (!res.ok) throw new Error(`token broker ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (!data.geminiToken) throw new Error('token broker returned no geminiToken');
  return data.geminiToken;
}

async function geminiSummarize(geminiToken, transcriptText) {
  const res = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${geminiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: buildVoicePrompt(transcriptText) }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/** The N most recent telephony interactions (id + customer origin) via Search. */
async function fetchRecentVoiceCalls(limit, days) {
  const now = Date.now();
  const query =
    'query T($from: Long!, $to: Long!){ taskDetails(from:$from,to:$to,' +
    'filter:{channelType:{equals: telephony}}){ tasks { id createdTime origin lastWrapupCodeName } } }';
  const res = await fetch(`${SEARCH_HOST}/search`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ query, variables: { from: now - days * 86400000, to: now } }),
  });
  const json = await res.json();
  if (!res.ok || json.error || json.errors) throw new Error(`Search failed: ${JSON.stringify(json.error || json.errors).slice(0, 200)}`);
  return (json.data?.taskDetails?.tasks || [])
    .filter((t) => t.id)
    .sort((a, b) => (b.createdTime || 0) - (a.createdTime || 0))
    .slice(0, limit);
}

/** True when the native summary is still available (i.e. NOT expired). */
async function nativeSummaryAvailable(interactionId) {
  const res = await fetch(`${AI_HOST}/summary/list`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ orgId: ORG, interactionId, searchType: 'INTERACTION' }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data?.summaries?.POST_CALL && Object.keys(data.summaries.POST_CALL).length);
}

/** taskIds that already have a stored wrap-up summary event (skip unless --force). */
async function fetchAlreadyStoredTaskIds() {
  const stored = new Set();
  for (const type of ['task:wrapup-summary', 'email:wrapup-summary']) {
    for (let page = 1; page <= 5; page += 1) {
      const url = `${SEARCH_HOST}/v1/api/events/workspace-id/${WS}?filter=${encodeURIComponent(`type==${type}`)}&page=${page}&pageSize=100`;
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

/** Fetch the normalized transcript rows for a task via the deployed proxy. */
async function fetchTranscript(taskId) {
  const res = await fetch(TRANSCRIPT_URL, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ orgId: ORG, taskId, datacenter: AI_DC }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.transcript) ? data.transcript : [];
}

async function publishSummary({ taskId, identity, sections, text }) {
  const event = {
    id: randomUUID(),
    specversion: '1.0',
    type: 'task:wrapup-summary',
    source: 'task-management-ai-regen',
    time: new Date().toISOString(),
    eventTime: Date.now(),
    identity,
    identitytype: String(identity).includes('@') ? 'email' : 'phone',
    datacontenttype: 'application/json',
    data: { summary: text, sections, taskId, regenerated: true },
  };
  const res = await fetch(`${SEARCH_HOST}/publish/v1/api/event?workspaceId=${WS}`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`publish ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json().catch(() => ({}));
}

async function main() {
  console.log(`Regenerate voice wrap-up summaries -> JDS  (region=${REGION}, ai-dc=${AI_DC}, ws=${WS})`);
  console.log(`limit=${LIMIT}  window=${DAYS}d  model=${GEMINI_MODEL}  ${FORCE ? '[FORCE] ' : ''}${DRY_RUN ? '[DRY RUN — no writes]' : ''}\n`);

  const geminiToken = await getGeminiToken();
  console.log('Gemini token acquired.\n');

  const calls = await fetchRecentVoiceCalls(LIMIT, DAYS);
  console.log(`Found ${calls.length} recent voice call(s).`);
  if (!calls.length) return;

  const alreadyStored = FORCE ? new Set() : await fetchAlreadyStoredTaskIds();
  if (alreadyStored.size) console.log(`${alreadyStored.size} already have a stored summary (skip; use --force to override).`);
  console.log('');

  let saved = 0; let skipped = 0; let noTranscript = 0; let failed = 0;
  for (const call of calls) {
    const when = call.createdTime ? new Date(call.createdTime).toISOString().slice(0, 16) : '?';
    const tag = `${when}  ${call.id}`;

    if (alreadyStored.has(call.id)) { console.log(`⏭  ${tag}  already stored`); skipped += 1; continue; }

    if (!FORCE && await nativeSummaryAvailable(call.id)) {
      console.log(`·  ${tag}  native summary still available (not expired) — skip`); skipped += 1; continue;
    }

    let rows = [];
    try { rows = await fetchTranscript(call.id); }
    catch (err) { console.log(`✖  ${tag}  transcript error: ${err.message}`); failed += 1; continue; }
    if (!rows.length) { console.log(`·  ${tag}  no transcript available`); noTranscript += 1; continue; }

    const transcriptText = rows
      .map((r) => `${r.speaker || r.role || '?'}: ${r.text}`)
      .join('\n')
      .slice(0, 12000);

    let sections;
    try {
      const raw = await geminiSummarize(geminiToken, transcriptText);
      sections = parseSections(raw);
    } catch (err) { console.log(`✖  ${tag}  Gemini error: ${err.message}`); failed += 1; continue; }

    const text = sectionsToText(sections);
    if (!text) { console.log(`·  ${tag}  model returned empty summary`); skipped += 1; continue; }

    const identity = call.origin;
    if (!identity || !(String(identity).includes('@') || /\d/.test(String(identity)))) {
      console.log(`⚠  ${tag}  no usable customer identity (origin='${identity}')`); skipped += 1; continue;
    }

    if (DRY_RUN) {
      console.log(`✓  ${tag}  WOULD SAVE (${rows.length} rows) :: ${text.replace(/\n/g, ' | ').slice(0, 100)}…`);
      saved += 1; continue;
    }
    try {
      await publishSummary({ taskId: call.id, identity, sections, text });
      console.log(`✓  ${tag}  SAVED (${rows.length} rows) :: ${text.replace(/\n/g, ' | ').slice(0, 80)}…`);
      saved += 1;
    } catch (err) { console.log(`✖  ${tag}  publish failed: ${err.message}`); failed += 1; }
  }

  console.log(`\nDone. saved=${saved}  skipped=${skipped}  no-transcript=${noTranscript}  failed=${failed}`);
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });

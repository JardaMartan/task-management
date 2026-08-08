'use strict';

/**
 * Voice transcript proxy (Webex CC Captures API).
 *
 * The browser cannot download the transcript file directly: the Captures
 * `filePath` is a presigned S3 URL that is CORS-protected ("not intended for
 * browser based apps" per the Captures guide). This module runs server-side, so
 * it can POST the Captures query, follow the returned presigned URL, and return
 * a normalized transcript to the widget.
 *
 * Auth: the caller forwards the agent's Webex Desktop token (verified upstream
 * via verifyWebexIdentity). Captures accepts User tokens; swap to a Service App
 * client-credentials token here if the Desktop token lacks the Captures scope.
 */

// Resolve the Webex CC API base for the Captures query endpoint.
// Override with CAPTURES_API_BASE; otherwise derive the region from the JDS
// datacenter (prodeu1 → eu1, produs1 → us1, …) → https://api.wxcc-<region>.cisco.com.
function capturesBase(datacenter) {
  if (process.env.CAPTURES_API_BASE) return process.env.CAPTURES_API_BASE.replace(/\/+$/, '');
  const region = String(datacenter || 'produs1').replace(/^prod/, '') || 'us1';
  return `https://api.wxcc-${region}.cisco.com`;
}

// ── Service App token (client-credentials / refresh-token grant) ──────────────
// The agent Desktop token is rejected by Captures (FAIL_VALIDATE_TOKEN), so the
// backend mints an org-scoped token from a Webex Service App when configured.
// Env: WXCC_SA_CLIENT_ID, WXCC_SA_CLIENT_SECRET, WXCC_SA_REFRESH_TOKEN.
let _saTokenCache = { token: null, expiresAt: 0 };

async function mintServiceAppToken() {
  const clientId = process.env.WXCC_SA_CLIENT_ID;
  const clientSecret = process.env.WXCC_SA_CLIENT_SECRET;
  const refreshToken = process.env.WXCC_SA_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  if (_saTokenCache.token && Date.now() < _saTokenCache.expiresAt - 60_000) {
    return _saTokenCache.token;
  }

  const res = await fetch('https://webexapis.com/v1/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    console.error(`[transcript] Service App token mint failed: ${res.status} ${await res.text().catch(() => '')}`);
    return null;
  }
  const data = await res.json();
  _saTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000),
  };
  return _saTokenCache.token;
}

/** Map a raw participant/role token to the widget transcript role. */
function normalizeRole(raw) {
  const r = String(raw || '').toLowerCase();
  if (r.includes('agent')) return 'agent';
  if (r.includes('customer') || r.includes('caller') || r.includes('external')) return 'customer';
  if (r.includes('ivr') || r.includes('bot') || r.includes('virtual')) return 'system';
  if (r.includes('system')) return 'system';
  return 'customer';
}

/** Format an epoch-ms / ISO timestamp to mm:ss relative to the first entry. */
function relTime(ts, baseTs) {
  const t = Number(ts);
  const b = Number(baseTs);
  if (!Number.isFinite(t) || !Number.isFinite(b) || t < b) return undefined;
  const sec = Math.round((t - b) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format a seconds offset (from call start) as mm:ss. */
function fmtOffset(sec) {
  if (!Number.isFinite(sec)) return undefined;
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Normalize a downloaded voice-transcript payload into the widget shape:
 *   [{ id, role, speaker, text, time }]
 *
 * Primary format is the Webex CC voice transcript (voiceTranscript.json):
 *   { responseContents: [{ recognitionResult: { role, alternatives: [{ transcript, words }] } }] }
 * where role is CALLER / AGENT and word start_time is a {seconds,nanos} offset
 * from call start. A generic fallback handles other provider shapes.
 */
function normalizeVoiceTranscript(payload) {
  // ── Webex CC voice transcript (word-level ASR) ──────────────────────────────
  if (payload && Array.isArray(payload.responseContents)) {
    const rows = payload.responseContents.map((item, i) => {
      const rr = item.recognitionResult || {};
      const alt = (rr.alternatives || [])[0] || {};
      const text = alt.transcript ||
        (Array.isArray(alt.words) ? alt.words.map((w) => w.word).join(' ') : '');
      if (!String(text).trim()) return null;
      const w0 = Array.isArray(alt.words) ? alt.words[0] : null;
      const startSec = w0?.start_time
        ? Number(w0.start_time.seconds || 0) + Number(w0.start_time.nanos || 0) / 1e9
        : null;
      const role = normalizeRole(rr.role);
      return {
        id: `vt-${i}`,
        role,
        speaker: role === 'agent' ? 'Agent' : role === 'system' ? 'System' : 'Customer',
        text: String(text),
        startSec,
      };
    }).filter(Boolean);

    // Order chronologically (channels can be grouped by role in the file).
    rows.sort((a, b) => (a.startSec ?? Infinity) - (b.startSec ?? Infinity));
    return rows.map(({ startSec, ...r }) => ({ ...r, time: fmtOffset(startSec) }));
  }

  // ── Generic fallback (bare array / other provider shapes) ───────────────────
  const rows = Array.isArray(payload)
    ? payload
    : (payload?.transcript || payload?.transcripts || payload?.data ||
       payload?.segments || payload?.results || []);
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const times = rows
    .map((r) => Number(r.startTimestamp ?? r.startTime ?? r.timestamp ?? r.start))
    .filter(Number.isFinite);
  const baseTs = times.length ? Math.min(...times) : null;

  return rows
    .map((r, i) => {
      const text = r.text ?? r.transcript ?? r.message ?? r.content ??
        (Array.isArray(r.alternatives) ? r.alternatives[0]?.transcript : '') ?? '';
      if (!String(text).trim()) return null;
      const role = normalizeRole(r.participantType ?? r.role ?? r.speaker ?? r.party);
      const rawTs = r.startTimestamp ?? r.startTime ?? r.timestamp ?? r.start;
      return {
        id: r.id || r.transcriptId || r.messageId || `vt-${i}`,
        role,
        speaker: r.speaker || r.participantName || r.name ||
          (role === 'agent' ? 'Agent' : role === 'system' ? 'System' : 'Customer'),
        text: String(text),
        time: baseTs != null ? relTime(rawTs, baseTs) : undefined,
      };
    })
    .filter(Boolean);
}

/** Duration (seconds) from a Captures recording entry (startTime/stopTime ms). */
function recordingDuration(recording) {
  const r = Array.isArray(recording) ? recording[0] : null;
  const a = r?.attributes || r || {};
  const start = Number(a.startTime);
  const stop = Number(a.stopTime);
  if (Number.isFinite(start) && Number.isFinite(stop) && stop > start) {
    return Math.round((stop - start) / 1000);
  }
  return 0;
}

/** Run a single Captures query; returns the `data` array (or null on error). */
async function capturesQuery({ orgId, taskIds, capturesToken, datacenter }) {
  const base = capturesBase(datacenter);
  const queryUrl = `${base}/v1/captures/query`;
  const res = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${capturesToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { orgId, urlExpiration: 10, taskIds } }),
  });
  if (!res.ok) {
    console.warn(`[transcript] Captures query ${queryUrl} → ${res.status} ${await res.text().catch(() => '')}`);
    return null;
  }
  const meta = await res.json().catch(() => null);
  return Array.isArray(meta?.data) ? meta.data : [];
}

/** True when a task has a voice transcript artifact. */
function hasVoiceTranscript(transcription) {
  return (Array.isArray(transcription) ? transcription : [])
    .some((t) => /voice/i.test(t.source || '') || /voice/i.test(t.fileName || ''));
}

const { resolveHost, genTrackingId } = require('./agent-state');

/**
 * Query the Webex CC Search API (GraphQL) for interaction timing/direction.
 * totalDuration = full interaction; connectedDuration = talk time.
 *
 * @returns {Promise<Object>} map { taskId: { durationSec, connectedSec, startTime, direction, origin } }
 */
async function searchTaskDetails({ taskIds, capturesToken, datacenter }) {
  const host = resolveHost(datacenter);
  if (!host || !Array.isArray(taskIds) || taskIds.length === 0) return {};

  const fromTs = Date.now() - 90 * 24 * 3600 * 1000;
  const toTs = Date.now();
  const orFilter = taskIds.slice(0, 10)
    .map((id) => `{ id: { equals: "${String(id).replace(/[^\w.-]/g, '')}" } }`).join(' ');
  const query = `query T($from: Long!, $to: Long!) {
    taskDetails(from: $from, to: $to, filter: { or: [ ${orFilter} ] }) {
      tasks { id createdTime totalDuration connectedDuration direction origin channelType }
    }
  }`;

  try {
    const res = await fetch(`${host}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${capturesToken}`,
        TrackingId: genTrackingId(),
      },
      body: JSON.stringify({ query, variables: { from: fromTs, to: toTs } }),
    });
    if (!res.ok) {
      console.warn(`[transcript] Search API → ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
      return {};
    }
    const body = await res.json();
    const tasks = body?.data?.taskDetails?.tasks || [];
    const map = {};
    for (const tk of tasks) {
      if (!tk.id) continue;
      map[tk.id] = {
        durationSec: Number.isFinite(tk.totalDuration) ? Math.round(tk.totalDuration / 1000)
          : (Number.isFinite(tk.connectedDuration) ? Math.round(tk.connectedDuration / 1000) : 0),
        connectedSec: Number.isFinite(tk.connectedDuration) ? Math.round(tk.connectedDuration / 1000) : 0,
        startTime: tk.createdTime || null,
        direction: String(tk.direction || '').toLowerCase() || null,
        origin: tk.origin || null,
      };
    }
    return map;
  } catch (e) {
    console.warn('[transcript] Search API failed:', e.message);
    return {};
  }
}

/**
 * List capture metadata for up to 10 tasks WITHOUT downloading transcript files.
 * Combines Captures (transcript availability + recording) with the Search API
 * (accurate interaction duration + direction). Used to build the call list.
 *
 * @returns {Promise<Array<{taskId,durationSec,connectedSec,startTime,direction,hasTranscript,hasRecording,languageCode}>>}
 */
async function fetchCaptureList({ orgId, taskIds, accessToken, datacenter }) {
  if (!orgId || !Array.isArray(taskIds) || taskIds.length === 0 || !accessToken) return [];
  const capturesToken = (await mintServiceAppToken().catch(() => null)) || accessToken;

  const ids = taskIds.slice(0, 10);
  const [data, details] = await Promise.all([
    capturesQuery({ orgId, taskIds: ids, capturesToken, datacenter }).catch((err) => {
      console.error('[transcript] Captures list request failed:', err.message);
      return null;
    }),
    searchTaskDetails({ taskIds: ids, capturesToken, datacenter }),
  ]);

  const byCapture = new Map((data || []).map((d) => [d.taskId, d]));
  // Union of ids seen from either source, preserving the requested order.
  return ids.map((taskId) => {
    const d = byCapture.get(taskId) || {};
    const rec = Array.isArray(d.recording) ? d.recording[0] : null;
    const attrs = rec?.attributes || {};
    const search = details[taskId] || {};
    return {
      taskId,
      durationSec: search.durationSec || recordingDuration(d.recording),
      connectedSec: search.connectedSec || recordingDuration(d.recording),
      startTime: search.startTime || Number(attrs.startTime) || null,
      direction: search.direction || null,
      hasTranscript: hasVoiceTranscript(d.transcription),
      hasRecording: Boolean(rec),
      languageCode: (Array.isArray(d.transcription) ? d.transcription[0]?.languageCode : null) || null,
    };
  });
}

/**
 * List the customer's voice calls by phone number via the Search API (origin
 * filter). Returns duration, direction, and wrap-up code per call. This is the
 * authoritative call list (JDS omits some voice interactions).
 *
 * @returns {Promise<Array<{taskId,durationSec,connectedSec,startTime,direction,origin,wrapUpReason,terminationType}>>}
 */
async function fetchVoiceCallsByPhone({ orgId, phones, accessToken, datacenter, limit = 100 }) {
  const host = resolveHost(datacenter);
  if (!orgId || !host || !Array.isArray(phones) || phones.length === 0 || !accessToken) return [];
  const capturesToken = (await mintServiceAppToken().catch(() => null)) || accessToken;

  const fromTs = Date.now() - 90 * 24 * 3600 * 1000;
  const toTs = Date.now();
  const orFilter = phones.slice(0, 5)
    .map((p) => `{ origin: { equals: "${String(p).replace(/[^\d+]/g, '')}" } }`)
    .filter((f) => !/equals: ""/.test(f))
    .join(' ');
  if (!orFilter) return [];
  const query = `query T($from: Long!, $to: Long!) {
    taskDetails(from: $from, to: $to, filter: { or: [ ${orFilter} ] }) {
      tasks { id createdTime totalDuration connectedDuration direction origin channelType lastWrapupCodeName terminationType }
    }
  }`;

  let tasks = [];
  try {
    const res = await fetch(`${host}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${capturesToken}`, TrackingId: genTrackingId() },
      body: JSON.stringify({ query, variables: { from: fromTs, to: toTs } }),
    });
    if (!res.ok) {
      console.warn(`[transcript] Search calls → ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
      return [];
    }
    const body = await res.json();
    tasks = (body?.data?.taskDetails?.tasks || [])
      .filter((t) => !t.channelType || String(t.channelType).toLowerCase() === 'telephony');
  } catch (e) {
    console.warn('[transcript] Search calls failed:', e.message);
    return [];
  }

  tasks.sort((a, b) => (b.createdTime || 0) - (a.createdTime || 0));
  tasks = tasks.slice(0, limit);

  return tasks.map((t) => ({
    taskId: t.id,
    durationSec: Number.isFinite(t.totalDuration) ? Math.round(t.totalDuration / 1000) : 0,
    connectedSec: Number.isFinite(t.connectedDuration) ? Math.round(t.connectedDuration / 1000) : 0,
    startTime: t.createdTime || null,
    direction: String(t.direction || '').toLowerCase() || null,
    origin: t.origin || null,
    wrapUpReason: t.lastWrapupCodeName || null,
    terminationType: t.terminationType || null,
  }));
}

/**
 * Fetch the AI post-call summary for a task (reason, actions, next steps,
 * chosen wrap-up). Same endpoint the email flow uses for interaction summaries.
 */
async function fetchAiSummary({ orgId, taskId, capturesToken, datacenter }) {
  const dc = datacenter || 'produs1';
  const url = `https://api-ai-assistant.${dc}.ciscoccservice.com/summary/list`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${capturesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, interactionId: taskId, searchType: 'INTERACTION' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pc = data?.summaries?.POST_CALL;
    const key = pc && Object.keys(pc)[0];
    const s = key ? pc[key] : null;
    if (!s) return null;
    return {
      initialContactReason: s.initialContactReason || null,
      keyActionsTaken: s.keyActionsTaken || null,
      nextSteps: s.nextSteps || null,
      additionalContactReasons: s.additionalContactReasons || null,
      chosenWrapUpCode: s.chosenWrapUpCode || null,
      proposedWrapUpCodes: Array.isArray(s.proposedWrapUpCodes)
        ? s.proposedWrapUpCodes.map((c) => c?.name).filter(Boolean) : [],
    };
  } catch (e) {
    console.warn('[transcript] AI summary failed:', e.message);
    return null;
  }
}

/**
 * Fetch the AI post-call summary for a task on its own (fast — no Captures).
 * Fetched independently of the transcript so each renders as soon as it's ready.
 */
async function fetchVoiceSummary({ orgId, taskId, accessToken, datacenter }) {
  if (!orgId || !taskId || !accessToken) return null;
  const capturesToken = (await mintServiceAppToken().catch(() => null)) || accessToken;
  return fetchAiSummary({ orgId, taskId, capturesToken, datacenter });
}

/**
 * Fetch and normalize the voice transcript for a single task.
 *
 * @returns {Promise<{ transcript, recording, source, durationSec, languageCode }|null>}
 */
async function fetchVoiceTranscript({ orgId, taskId, accessToken, datacenter }) {
  if (!orgId || !taskId || !accessToken) return null;

  // Prefer a Service App token (Captures rejects the agent Desktop token); fall
  // back to the forwarded Desktop token when no Service App is configured.
  const capturesToken = (await mintServiceAppToken().catch(() => null)) || accessToken;

  const emptyResult = (extra = {}) => ({
    transcript: [], recording: [], source: null, durationSec: 0, languageCode: null, ...extra,
  });

  let data;
  try {
    data = await capturesQuery({ orgId, taskIds: [taskId], capturesToken, datacenter });
  } catch (err) {
    console.error('[transcript] Captures query request failed:', err.message);
    return emptyResult();
  }
  if (!data) return emptyResult();

  const taskData = data.find((d) => d.taskId === taskId) || data[0];
  const transcription = Array.isArray(taskData?.transcription) ? taskData.transcription : [];
  const durationSec = recordingDuration(taskData?.recording);

  // Prefer a voice transcript artifact; fall back to the first available one.
  const artifact =
    transcription.find((t) => /voice/i.test(t.source || '') || /voice/i.test(t.fileName || '')) ||
    transcription[0];

  if (!artifact?.filePath) {
    console.warn(`[transcript] No transcription artifact for task ${taskId}`);
    return emptyResult({ recording: taskData?.recording || [], durationSec });
  }

  let fileRes;
  try {
    fileRes = await fetch(artifact.filePath); // presigned URL, no auth header
  } catch (err) {
    console.error('[transcript] Transcript file download failed:', err.message);
    return emptyResult({ recording: taskData?.recording || [], durationSec });
  }
  if (!fileRes.ok) {
    console.warn(`[transcript] Transcript file → ${fileRes.status}`);
    return emptyResult({ recording: taskData?.recording || [], durationSec });
  }

  const raw = await fileRes.json().catch(() => null);
  return {
    transcript: normalizeVoiceTranscript(raw),
    recording: taskData?.recording || [],
    source: artifact.source || 'voice',
    durationSec,
    languageCode: raw?.languageCode || artifact.languageCode || null,
  };
}

module.exports = { fetchVoiceTranscript, fetchVoiceSummary, fetchCaptureList, fetchVoiceCallsByPhone, normalizeVoiceTranscript };


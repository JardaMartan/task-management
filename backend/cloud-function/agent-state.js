'use strict';

/**
 * agent-state.js
 *
 * Agent state / idle-breakdown source for the activity analytics widget.
 *
 * Agent login/logout and state changes are intentionally NOT stored in our
 * BigQuery event stream — they are sourced live from Webex Contact Center:
 *   • Historical: Search API (GraphQL) — AgentSession (ASR) / AgentActivity (AAR)
 *     records carry per-state durations with idle / auxiliary reason codes and
 *     login/logout, up to 30 days.
 *   • Real-time: the Desktop SDK `eAgentStateChange` feed (handled client-side).
 *
 * This module queries the Search API and normalises the result to:
 *   { agentId, agentName, loginMs, logoutMs, idle: [ { code, ms } ] }
 * On any failure (missing token, unknown datacenter, schema mismatch) it returns
 * null so the widget degrades gracefully (demo mock / "source not configured").
 *
 * Env override: WEBEX_CC_API_HOST (e.g. https://api.wxcc-us1.cisco.com).
 */

// Best-effort Webex CC datacenter → Search API host mapping. The org's data
// residency determines the region (this org = wxcc-eu1). Overridable via env.
const DC_HOST = {
  produs1: 'https://api.wxcc-us1.cisco.com',
  produs2: 'https://api.wxcc-us2.cisco.com',
  prodeu1: 'https://api.wxcc-eu1.cisco.com',
  prodeu2: 'https://api.wxcc-eu2.cisco.com',
  prodanz1: 'https://api.wxcc-anz1.cisco.com',
  prodca1: 'https://api.wxcc-ca1.cisco.com',
  prodjp1: 'https://api.wxcc-jp1.cisco.com',
  // region-style aliases
  us1: 'https://api.wxcc-us1.cisco.com',
  eu1: 'https://api.wxcc-eu1.cisco.com',
  eu2: 'https://api.wxcc-eu2.cisco.com',
  anz1: 'https://api.wxcc-anz1.cisco.com',
};

function resolveHost(datacenter) {
  if (process.env.WEBEX_CC_API_HOST) return process.env.WEBEX_CC_API_HOST;
  if (!datacenter) return null;
  const key = String(datacenter).toLowerCase();
  if (DC_HOST[key]) return DC_HOST[key];
  // e.g. "wxcc-eu1" or "prodEU1" → extract region token
  const m = key.match(/(us1|us2|eu1|eu2|anz1|ca1|jp1)/);
  return m ? `https://api.wxcc-${m[1]}.cisco.com` : null;
}

// Map raw Webex idle/aux reason names onto the widget's canonical codes.
function normalizeReason(name) {
  const n = String(name || '').toLowerCase();
  if (!n || n.includes('available')) return 'available';
  if (n.includes('lunch')) return 'lunch';
  if (n.includes('break')) return 'break';
  if (n.includes('meet')) return 'meeting';
  if (n.includes('train')) return 'training';
  if (n.includes('rona') || n.includes('ring')) return 'rona';
  return 'other';
}

function genTrackingId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Query one agent's state/idle breakdown from Webex CC Search API (agentSession
 * → AAR activities). Returns { agentId, agentName, loginMs, logoutMs, idle:[…] }
 * or null on failure.
 */
async function queryAgentState({ agentId, from, to, accessToken, orgId, datacenter }) {
  const host = resolveHost(datacenter);
  if (!accessToken || !host || !agentId) {
    console.log('[agent-state] not configured (token/host/agentId missing) — returning null');
    return null;
  }
  const fromTs = from ? Date.parse(from) : Date.now() - 8 * 3600 * 1000;
  const toTs = to ? Date.parse(to) : Date.now();

  // agentSession → per-channel AAR activities. Verified schema (wxcc-eu1):
  // channelInfo[].activities.nodes[] { state, startTime, duration, idleCode { name } }.
  // Global states (available/idle/ringing) are mirrored across channels with the
  // same startTime, so we dedupe by state+startTime to get wall-clock durations.
  const query = `query AgentState($from: Long!, $to: Long!, $agentId: String!) {
    agentSession(from: $from, to: $to, filter: { agentId: { equals: $agentId } }) {
      agentSessions {
        startTime
        endTime
        isActive
        channelInfo {
          activities(first: 100) {
            nodes { state startTime duration idleCode { name } }
          }
        }
      }
    }
  }`;

  try {
    const res = await fetch(`${host}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        TrackingId: genTrackingId(),
      },
      body: JSON.stringify({ query, variables: { from: fromTs, to: toTs, agentId } }),
    });
    if (!res.ok) throw new Error(`search HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    if (body.errors || body.error) {
      throw new Error(`GraphQL: ${JSON.stringify(body.errors || body.error).slice(0, 300)}`);
    }
    const sessions = body?.data?.agentSession?.agentSessions || [];
    if (!sessions.length) return null;

    const seen = new Set();
    const stateMs = {};
    const idleByName = {};
    const segments = [];   // time-anchored state segments for the state lane
    let loginMs = null;
    let logoutMs = null;
    let active = false;

    for (const s of sessions) {
      const st = Number(s.startTime) || null;
      const en = Number(s.endTime);
      if (st) loginMs = loginMs == null ? st : Math.min(loginMs, st);
      if (en && en > 0) logoutMs = logoutMs == null ? en : Math.max(logoutMs, en);
      if (en === -1 || s.isActive) active = true;
      for (const c of s.channelInfo || []) {
        for (const n of c.activities?.nodes || []) {
          const key = `${n.state}|${n.startTime}|${n.duration}`;
          if (seen.has(key)) continue; // collapse per-channel mirrored global states
          seen.add(key);
          const dur = Number(n.duration) || 0;
          if (dur <= 0) continue;
          stateMs[n.state] = (stateMs[n.state] || 0) + dur;
          let segName = null;
          let segCode = null;
          if (n.state === 'connected') { segCode = 'engaged'; segName = 'Engaged'; }
          else if (n.state === 'wrapup') { segCode = 'wrapup'; segName = 'Wrap-up'; }
          else if (n.state === 'available') { segCode = 'available'; segName = 'Available'; }
          else if (n.state === 'ringing') { segCode = 'rona'; segName = 'Ringing'; }
          else if (n.state === 'idle') {
            segName = (n.idleCode && n.idleCode.name) || 'Not Ready';
            segCode = normalizeReason(segName);
            idleByName[segName] = (idleByName[segName] || 0) + dur;
          }
          const startMs = Number(n.startTime) || null;
          if (segCode && startMs) segments.push({ code: segCode, name: segName, startMs, endMs: startMs + dur });
        }
      }
    }
    segments.sort((a, b) => a.startMs - b.startMs);

    // Coalesce contiguous same-state segments (Webex mirrors global states across
    // channels/sessions, producing many back-to-back identical slivers). Merging
    // them keeps the state lane identical while cutting the payload — the single
    // biggest response — dramatically for wide ranges / large teams.
    const mergedSegments = [];
    for (const seg of segments) {
      const last = mergedSegments[mergedSegments.length - 1];
      if (last && last.code === seg.code && last.name === seg.name && seg.startMs <= last.endMs + 1000) {
        if (seg.endMs > last.endMs) last.endMs = seg.endMs;
      } else {
        mergedSegments.push({ ...seg });
      }
    }

    // Build an ordered, authoritative state breakdown for the distribution bar.
    const breakdown = [];
    if (stateMs.connected) breakdown.push({ code: 'engaged', name: 'Engaged', ms: stateMs.connected });
    if (stateMs.wrapup) breakdown.push({ code: 'wrapup', name: 'Wrap-up', ms: stateMs.wrapup });
    if (stateMs.available) breakdown.push({ code: 'available', name: 'Available', ms: stateMs.available });
    for (const [name, ms] of Object.entries(idleByName)) breakdown.push({ code: normalizeReason(name), name, ms });
    if (stateMs.ringing) breakdown.push({ code: 'rona', name: 'Ringing', ms: stateMs.ringing });

    // Multi-channel agents mirror global states (available/idle) across channels
    // and across sessions, which can inflate durations beyond wall-clock. Since
    // over a shift the states must sum to the shift length, normalize the
    // breakdown down to the wall-clock shift so segments are bounded + sum right.
    const shiftEnd = active ? Date.now() : (logoutMs || Date.now());
    const shiftMs = loginMs ? shiftEnd - loginMs : 0;
    const sum = breakdown.reduce((a, s) => a + s.ms, 0);
    if (shiftMs > 0 && sum > shiftMs) {
      const scale = shiftMs / sum;
      for (const s of breakdown) s.ms = Math.round(s.ms * scale);
    }

    return { agentId, agentName: null, loginMs, logoutMs: active ? null : logoutMs, breakdown, segments: mergedSegments };
  } catch (err) {
    console.warn('[agent-state] Webex Search API query failed:', err.message);
    return null;
  }
}

/** Query the whole team's state (looped per agent). */
async function queryTeamState({ agentIds, from, to, accessToken, orgId, datacenter }) {
  if (!Array.isArray(agentIds) || !agentIds.length) return [];
  const results = await Promise.all(
    agentIds.map((id) => queryAgentState({ agentId: id, from, to, accessToken, orgId, datacenter })
      .catch(() => null)),
  );
  return results.filter(Boolean);
}

/**
 * List distinct real agents from Webex CC (agentSession) so the reporting picker
 * shows agents that actually have state/activity data. Names aren't in ASR, so
 * we label by short id (resolve via Config API later if desired).
 * @returns {Promise<Array<{id:string, name:string}>>}
 */
async function queryAgentRoster({ accessToken, datacenter, days, from, to }) {
  const host = resolveHost(datacenter);
  if (!accessToken || !host) return [];
  // Explicit [from, to] window (range-scoped roster) takes precedence; otherwise
  // fall back to a rolling look-back in days (capped at the AAR 30-day limit).
  let fromTs;
  let toTs;
  if (from || to) {
    toTs = to ? Date.parse(to) : Date.now();
    fromTs = from ? Date.parse(from) : (toTs - 24 * 3600 * 1000);
    // AAR/agentSession is limited to ~30 days; clamp the window start.
    const floor = Date.now() - 30 * 24 * 3600 * 1000;
    if (fromTs < floor) fromTs = floor;
  } else {
    toTs = Date.now();
    const lookbackDays = Math.min(Math.max(Number(days) || 1, 1), 30);
    fromTs = toTs - lookbackDays * 24 * 3600 * 1000;
  }
  const query = `query Roster($from: Long!, $to: Long!) {
    agentSession(from: $from, to: $to) { agentSessions { agentId } }
  }`;
  try {
    const res = await fetch(`${host}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, TrackingId: genTrackingId() },
      body: JSON.stringify({ query, variables: { from: fromTs, to: toTs } }),
    });
    if (!res.ok) throw new Error(`roster HTTP ${res.status}`);
    const body = await res.json();
    if (body.errors || body.error) throw new Error('roster GraphQL error');
    const set = new Set();
    for (const s of body?.data?.agentSession?.agentSessions || []) if (s.agentId) set.add(s.agentId);
    return [...set].map((id) => ({ id, name: `Agent ${String(id).slice(0, 8)}` }));
  } catch (err) {
    console.warn('[agent-state] roster query failed:', err.message);
    return [];
  }
}

// Short-lived (per warm instance) cache of interaction_id → customer contact, so
// customer data is fetched live for display but NEVER persisted in our store.
const _contactCache = new Map();
const CONTACT_TTL_MS = 5 * 60 * 1000;

/**
 * Resolve the customer contact (origin = phone for voice, email for digital) for
 * a set of interaction ids straight from the Webex CC Search API at query time.
 * Nothing is stored — this augments the timeline for display only. Returns a map
 * { interactionId: { contact, channel } }.
 */
async function queryTaskContacts({ interactionIds, from, to, accessToken, datacenter }) {
  const host = resolveHost(datacenter);
  if (!accessToken || !host || !Array.isArray(interactionIds) || !interactionIds.length) return {};
  const fromTs = from ? Date.parse(from) : Date.now() - 24 * 3600 * 1000;
  const toTs = to ? Date.parse(to) : Date.now();
  const now = Date.now();

  const out = {};
  const need = [];
  const seen = new Set();
  for (const raw of interactionIds) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const cached = _contactCache.get(id);
    if (cached && (now - cached.ts) < CONTACT_TTL_MS) {
      if (cached.contact) out[id] = { contact: cached.contact, channel: cached.channel };
    } else {
      need.push(id);
    }
  }
  if (!need.length) return out;

  const CHUNK = 40;
  const chunks = [];
  for (let i = 0; i < need.length; i += CHUNK) chunks.push(need.slice(i, i + CHUNK));
  await Promise.all(chunks.map(async (chunk) => {
    const orFilter = chunk.map((id) => `{ id: { equals: "${id.replace(/[^\w.-]/g, '')}" } }`).join(' ');
    const query = `query Contacts($from: Long!, $to: Long!) {
      taskDetails(from: $from, to: $to, filter: { or: [ ${orFilter} ] }) {
        tasks { id channelType origin }
      }
    }`;
    try {
      const res = await fetch(`${host}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, TrackingId: genTrackingId() },
        body: JSON.stringify({ query, variables: { from: fromTs, to: toTs } }),
      });
      if (!res.ok) return;
      const body = await res.json();
      const tasks = body?.data?.taskDetails?.tasks || [];
      const found = new Set();
      for (const tk of tasks) {
        if (!tk.id) continue;
        const channel = String(tk.channelType || '').toLowerCase();
        _contactCache.set(tk.id, { contact: tk.origin || null, channel, ts: now });
        found.add(tk.id);
        if (tk.origin) out[tk.id] = { contact: tk.origin, channel };
      }
      for (const id of chunk) if (!found.has(id)) _contactCache.set(id, { contact: null, channel: null, ts: now });
    } catch (e) {
      console.warn('[agent-state] task contact lookup failed:', e.message);
    }
  }));
  return out;
}

module.exports = { queryAgentState, queryTeamState, queryAgentRoster, queryTaskContacts, resolveHost, genTrackingId };

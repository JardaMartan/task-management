// Pure data-access layer for the Agent Activity widget. No Redux here.
//
// Live vs demo:
//   • When an ingest URL is configured, HISTORICAL data is fetched from the
//     Cloud Function GET /activity endpoint, and LIVE mode polls the same
//     endpoint on an interval. (A Firestore realtime listener can replace the
//     poll transport in createLiveSubscription without touching callers.)
//   • With no ingest URL (demo) both paths are served by the deterministic mock
//     generator, so the UI exercises the identical transform + analytics code.

import { AGENTS, generateEvents } from './mock/mockEvents';
import { generateAgentState, generateTeamState } from './mock/mockState';
import { TEAMS } from './mock/mockTeams';
import { perfStart } from './perf';

const LIVE_POLL_MS = 5000;

/** Return the selectable teams. Demo → mock teams; live → server (Config API). */
export async function fetchTeams({ activityUrl, accessToken, orgId, datacenter } = {}) {
  if (!activityUrl) return TEAMS;
  try {
    const url = `${activityUrl}?teams=1`
      + (orgId ? `&orgId=${encodeURIComponent(orgId)}` : '')
      + (datacenter ? `&datacenter=${encodeURIComponent(datacenter)}` : '');
    const res = await fetch(url, { headers: authHeaders(accessToken) });
    if (res.ok) {
      const body = await res.json();
      if (Array.isArray(body.teams)) return body.teams;
    }
  } catch (err) {
    console.warn('[activity-report] fetchTeams failed, using demo teams:', err.message);
  }
  return TEAMS;
}

/** Return the selectable agents. Demo (no ingest URL) → mock roster; live → server only. */
export async function fetchAgents({ activityUrl, accessToken, orgId, datacenter, teamId, fromMs, toMs, signal } = {}) {
  if (!activityUrl) {
    return teamId ? AGENTS.filter((a) => (a.teamIds || []).includes(teamId)) : AGENTS;
  }
  try {
    const url = `${activityUrl}?agents=1`
      + (fromMs != null
        ? `&from=${encodeURIComponent(new Date(fromMs).toISOString())}`
          + (toMs != null ? `&to=${encodeURIComponent(new Date(toMs).toISOString())}` : '')
        : '&days=7')
      + (orgId ? `&orgId=${encodeURIComponent(orgId)}` : '')
      + (datacenter ? `&datacenter=${encodeURIComponent(datacenter)}` : '')
      + (teamId ? `&teamId=${encodeURIComponent(teamId)}` : '');
    const res = await fetch(url, { headers: authHeaders(accessToken), signal });
    if (res.ok) {
      const body = await res.json();
      // In live mode return the server result verbatim — including an EMPTY list
      // (no agents fit the range). Never fall back to demo data here.
      if (Array.isArray(body.agents)) return body.agents;
    }
  } catch (err) {
    console.warn('[activity-report] fetchAgents failed:', err.message);
  }
  // Live request failed/malformed → empty roster (do not show mock data live).
  return [];
}

/**
 * Fetch an agent's events for [fromMs, toMs].
 * @returns {Promise<Array<object>>}
 */
export async function fetchAgentEvents({ activityUrl, accessToken, orgId, datacenter, agentId, workspaceId, fromMs, toMs, signal }) {
  if (!agentId) return [];
  if (!activityUrl) {
    return generateEvents(agentId, fromMs, toMs);
  }
  const url = `${activityUrl}?agentId=${encodeURIComponent(agentId)}`
    + `&from=${encodeURIComponent(new Date(fromMs).toISOString())}`
    + `&to=${encodeURIComponent(new Date(toMs).toISOString())}`
    + (orgId ? `&orgId=${encodeURIComponent(orgId)}` : '')
    + (datacenter ? `&datacenter=${encodeURIComponent(datacenter)}` : '')
    + (workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : '');
  const res = await fetch(url, { headers: authHeaders(accessToken), signal });
  if (!res.ok) throw new Error(`activity query HTTP ${res.status}`);
  const end = perfStart('fetchAgentEvents parse');
  const body = await res.json();
  const events = Array.isArray(body.events) ? body.events : [];
  end({ events: events.length });
  return events;
}

/**
 * Fetch ALL agents' events for [fromMs, toMs] (team occupancy view).
 * Demo → generate for the whole mock roster; live → GET ?team=1.
 * @returns {Promise<Array<object>>}
 */
export async function fetchTeamEvents({ activityUrl, accessToken, orgId, datacenter, fromMs, toMs, signal }) {
  if (!activityUrl) {
    return AGENTS.flatMap((a) => generateEvents(a.id, fromMs, toMs));
  }
  const url = `${activityUrl}?team=1`
    + `&from=${encodeURIComponent(new Date(fromMs).toISOString())}`
    + `&to=${encodeURIComponent(new Date(toMs).toISOString())}`
    + (orgId ? `&orgId=${encodeURIComponent(orgId)}` : '')
    + (datacenter ? `&datacenter=${encodeURIComponent(datacenter)}` : '');
  const res = await fetch(url, { headers: authHeaders(accessToken), signal });
  if (!res.ok) throw new Error(`team query HTTP ${res.status}`);
  const end = perfStart('fetchTeamEvents parse');
  const body = await res.json();
  const events = Array.isArray(body.events) ? body.events : [];
  end({ events: events.length });
  return events;
}

/**
 * Subscribe to live activity. Invokes onEvents(events) with the rolling window
 * whenever new data arrives. Returns { stop() }. When `team` is true it polls
 * the whole team; otherwise a single agent.
 *
 * Demo transport regenerates the mock window up to an advancing "now"; live
 * transport polls the REST endpoint. Swap either for a Firestore onSnapshot
 * listener here — callers are unaffected.
 */
export function createLiveSubscription({ activityUrl, accessToken, orgId, datacenter, agentId, team, windowMs, fromMsFixed, toMsFixed }, onEvents) {
  let stopped = false;
  let timer = null;
  const span = windowMs || 60 * 60 * 1000;
  // On the first tick we load the whole window; afterwards we only fetch the
  // delta since the last poll (plus a small overlap to catch late-arriving
  // events), merge it into a keyed store and prune anything that has aged out of
  // the rolling window. This keeps each poll tiny instead of re-downloading and
  // re-processing the entire window every LIVE_POLL_MS.
  const OVERLAP_MS = 60 * 1000;
  const store = new Map();
  let lastTo = null;

  const keyOf = (e) => `${e.agent_id || ''}|${e.interaction_id || ''}|${e.event_type || ''}|${e.event_ts || ''}`;

  const mergeAndPrune = (events, windowStart) => {
    for (const e of events) store.set(keyOf(e), e);
    for (const [k, e] of store) {
      const ts = Date.parse(e.event_ts);
      if (Number.isFinite(ts) && ts < windowStart) store.delete(k);
    }
  };

  const tick = async () => {
    if (stopped) return;
    const toMs = toMsFixed != null ? toMsFixed : Date.now();
    const windowStart = fromMsFixed != null ? fromMsFixed : toMs - span;
    const fromMs = lastTo == null ? windowStart : Math.max(windowStart, lastTo - OVERLAP_MS);
    try {
      const events = team
        ? await fetchTeamEvents({ activityUrl, accessToken, orgId, datacenter, fromMs, toMs })
        : await fetchAgentEvents({ activityUrl, accessToken, orgId, datacenter, agentId, fromMs, toMs });
      if (!stopped) {
        mergeAndPrune(events, windowStart);
        lastTo = toMs;
        onEvents([...store.values()]);
      }
    } catch (err) {
      console.warn('[activity-report] live poll failed:', err.message);
    }
    if (!stopped) timer = setTimeout(tick, LIVE_POLL_MS);
  };

  tick();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

function authHeaders(accessToken) {
  const h = { 'Content-Type': 'application/json' };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

/**
 * Fetch one agent's state / idle breakdown (login/logout + idle-by-reason).
 * Sourced from Webex CC in live mode (via the backend proxy); mock in demo.
 * @returns {Promise<object|null>}
 */
export async function fetchAgentState({ activityUrl, accessToken, orgId, datacenter, agentId, fromMs, toMs, signal }) {
  if (!agentId) return null;
  if (!activityUrl) return generateAgentState(agentId, fromMs, toMs);
  const url = `${activityUrl}?state=1&agentId=${encodeURIComponent(agentId)}`
    + `&from=${encodeURIComponent(new Date(fromMs).toISOString())}`
    + `&to=${encodeURIComponent(new Date(toMs).toISOString())}`
    + (orgId ? `&orgId=${encodeURIComponent(orgId)}` : '')
    + (datacenter ? `&datacenter=${encodeURIComponent(datacenter)}` : '');
  try {
    const res = await fetch(url, { headers: authHeaders(accessToken), signal });
    if (!res.ok) throw new Error(`state query HTTP ${res.status}`);
    const body = await res.json();
    return body.state || null;
  } catch (err) {
    console.warn('[activity-report] fetchAgentState failed:', err.message);
    return null;
  }
}

/**
 * Fetch team state for the given agent ids. Mock in demo; Webex CC in live.
 * @returns {Promise<Array<object>>}
 */
export async function fetchTeamState({ activityUrl, accessToken, orgId, datacenter, agentIds, fromMs, toMs, signal }) {
  if (!activityUrl) return generateTeamState(fromMs, toMs);
  if (!Array.isArray(agentIds) || !agentIds.length) return [];
  const url = `${activityUrl}?state=1&team=1&agentId=${encodeURIComponent(agentIds.join(','))}`
    + `&from=${encodeURIComponent(new Date(fromMs).toISOString())}`
    + `&to=${encodeURIComponent(new Date(toMs).toISOString())}`
    + (orgId ? `&orgId=${encodeURIComponent(orgId)}` : '')
    + (datacenter ? `&datacenter=${encodeURIComponent(datacenter)}` : '');
  try {
    const res = await fetch(url, { headers: authHeaders(accessToken) });
    if (!res.ok) throw new Error(`team state HTTP ${res.status}`);
    const body = await res.json();
    return Array.isArray(body.states) ? body.states : [];
  } catch (err) {
    console.warn('[activity-report] fetchTeamState failed:', err.message);
    return [];
  }
}

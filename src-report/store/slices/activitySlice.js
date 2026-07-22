import { createSlice } from '@reduxjs/toolkit';
import {
  fetchTeams, fetchAgents, fetchAgentEvents, fetchTeamEvents,
  fetchAgentState, fetchTeamState, createLiveSubscription,
} from '../../api';

// Non-serializable live-subscription handle kept at module scope so Redux state
// stays fully serializable (mirrors the reskill slice's desktopSDKRef pattern).
let liveSub = null;
function stopLive() {
  if (liveSub) { try { liveSub.stop(); } catch { /* ignore */ } liveSub = null; }
}

const HOUR = 60 * 60 * 1000;
export const RANGE_KEYS = ['1h', '8h', '24h', 'today', 'yesterday', '2d', '7d', 'week', '30d', 'custom'];

function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
function startOfWeek(ms) {
  const d = new Date(ms); const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dow); return d.getTime();
}

/**
 * Resolve a range key (+ optional custom from/to in ms) into an absolute window.
 * Rolling ranges end at "now"; calendar ranges are anchored (today = midnight,
 * week = Monday). `custom` uses the picked from/to.
 * @returns {{fromMs:number, toMs:number, spanMs?:number, anchored?:boolean, fixedTo?:boolean}}
 */
export function resolveRange(rangeKey, customFrom, customTo) {
  const now = Date.now();
  switch (rangeKey) {
    case '1h':  return { fromMs: now - HOUR, toMs: now, spanMs: HOUR };
    case '8h':  return { fromMs: now - 8 * HOUR, toMs: now, spanMs: 8 * HOUR };
    case '24h': return { fromMs: now - 24 * HOUR, toMs: now, spanMs: 24 * HOUR };
    case 'today': return { fromMs: startOfDay(now), toMs: now, anchored: true };
    case 'yesterday': { const t = startOfDay(now); return { fromMs: t - 24 * HOUR, toMs: t, anchored: true, fixedTo: true }; }
    case '2d':  return { fromMs: startOfDay(now) - 24 * HOUR, toMs: now, anchored: true };
    case '7d':  return { fromMs: now - 7 * 24 * HOUR, toMs: now, spanMs: 7 * 24 * HOUR };
    case 'week': return { fromMs: startOfWeek(now), toMs: now, anchored: true };
    case '30d': return { fromMs: now - 30 * 24 * HOUR, toMs: now, spanMs: 30 * 24 * HOUR };
    case 'custom': {
      const f = customFrom != null ? customFrom : startOfDay(now);
      const t = customTo != null ? customTo : now;
      return { fromMs: f, toMs: Math.max(t, f + HOUR), anchored: true, fixedTo: true };
    }
    default: return { fromMs: now - 8 * HOUR, toMs: now, spanMs: 8 * HOUR };
  }
}

/** windowMs (span) for a range key — used by overview + timeline axis defaults. */
export function rangeWindowMs(rangeKey, customFrom, customTo) {
  const r = resolveRange(rangeKey, customFrom, customTo);
  return r.toMs - r.fromMs;
}

const initialState = {
  status: 'idle',        // 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: null,
  isDemo: true,

  // desktop context
  accessToken: null,
  orgId: null,
  datacenter: null,
  activityUrl: null,     // Cloud Function ingest/query URL; null → demo
  darkMode: false,
  forcedMode: null,      // 'mock' | 'live' | null (data source, not view mode)

  // teams + roster + selection
  teams: [],
  selectedTeamId: null,   // null → all agents with recent activity
  agents: [],
  selectedAgentId: null,

  // view controls
  scope: 'agent',        // 'agent' | 'team'
  mode: 'historical',    // 'historical' | 'live'
  rangeKey: '8h',        // 1h|8h|24h|today|2d|week|custom
  customFrom: null,      // ms (custom range start)
  customTo: null,        // ms (custom range end)

  // data
  events: [],
  agentState: null,   // { loginMs, logoutMs, idle:[{code,ms}] } from Webex CC
  teamState: [],      // per-agent state for the team view
  loading: false,
};

const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {
    setContext(state, action) {
      const { accessToken, orgId, datacenter, activityUrl, darkMode, forcedMode } = action.payload || {};
      if (accessToken !== undefined) state.accessToken = accessToken;
      if (orgId !== undefined) state.orgId = orgId;
      if (datacenter !== undefined) state.datacenter = datacenter;
      if (activityUrl !== undefined) state.activityUrl = activityUrl || null;
      if (darkMode !== undefined) state.darkMode = Boolean(darkMode);
      if (forcedMode !== undefined) state.forcedMode = forcedMode;
      state.isDemo = !(state.activityUrl && state.forcedMode !== 'mock');
    },
    setTeams(state, action) { state.teams = action.payload || []; },
    setSelectedTeam(state, action) { state.selectedTeamId = action.payload || null; },
    setAgents(state, action) { state.agents = action.payload || []; },
    setSelectedAgent(state, action) { state.selectedAgentId = action.payload || null; },
    setScope(state, action) { state.scope = action.payload === 'team' ? 'team' : 'agent'; },
    setMode(state, action) { state.mode = action.payload === 'live' ? 'live' : 'historical'; },
    setRange(state, action) { state.rangeKey = RANGE_KEYS.includes(action.payload) ? action.payload : '8h'; },
    setCustomRange(state, action) {
      const { fromMs, toMs } = action.payload || {};
      if (fromMs != null) state.customFrom = fromMs;
      if (toMs != null) state.customTo = toMs;
    },
    setEvents(state, action) { state.events = action.payload || []; },
    setAgentState(state, action) { state.agentState = action.payload || null; },
    setTeamState(state, action) { state.teamState = action.payload || []; },
    setLoading(state, action) { state.loading = Boolean(action.payload); },
    setStatus(state, action) { state.status = action.payload; },
    setError(state, action) { state.status = 'error'; state.errorMessage = action.payload || null; },
  },
});

export const {
  setContext, setTeams, setSelectedTeam, setAgents, setSelectedAgent, setScope, setMode, setRange,
  setCustomRange, setEvents, setAgentState, setTeamState, setLoading, setStatus, setError,
} = activitySlice.actions;

// ── Thunks (own all orchestration + async) ──────────────────────────────────

export const hydrateContext = (props = {}) => async (dispatch, getState) => {
  dispatch(setContext({
    accessToken: props.accesstoken ?? props.accessToken,
    orgId: props.orgid ?? props.orgId,
    datacenter: props.datacenter,
    activityUrl: props.activityurl ?? props.activityUrl,
    darkMode: props.darkmode ?? props.darkMode,
    forcedMode: props.view ?? props.forcedMode,
  }));
  if (getState().activity.status === 'idle') {
    await dispatch(loadTeams());
    await dispatch(loadAgents());
    await dispatch(refresh());
  }
};

/** Load the selectable teams (Config API in live mode; mock in demo). */
export const loadTeams = () => async (dispatch, getState) => {
  const { activityUrl, accessToken, orgId, datacenter, isDemo } = getState().activity;
  try {
    const teams = await fetchTeams({ activityUrl: isDemo ? null : activityUrl, accessToken, orgId, datacenter });
    dispatch(setTeams(teams));
  } catch (err) {
    console.warn('[activity] loadTeams failed:', err.message);
  }
};

export const loadAgents = () => async (dispatch, getState) => {
  const s = getState().activity;
  const { fromMs, toMs } = resolveRange(s.rangeKey, s.customFrom, s.customTo);
  dispatch(setStatus('loading'));
  try {
    // "All active agents" (no team) is scoped to the selected range — an agent is
    // "active" if they had a session or interaction inside the chosen window.
    const agents = await fetchAgents({
      activityUrl: s.isDemo ? null : s.activityUrl, accessToken: s.accessToken,
      orgId: s.orgId, datacenter: s.datacenter, teamId: s.selectedTeamId, fromMs, toMs,
    });
    dispatch(setAgents(agents));
    dispatch(setStatus('ready'));
    // Keep the current selection if it's still in the roster; else pick the first.
    const cur = getState().activity.selectedAgentId;
    if (!agents.find((a) => a.id === cur)) {
      dispatch(setSelectedAgent(agents.length ? agents[0].id : null));
    }
    if (!agents.length) { dispatch(setEvents([])); dispatch(setAgentState(null)); dispatch(setTeamState([])); }
  } catch (err) {
    dispatch(setError(err.message));
  }
};

/** Pick a team → reload the roster scoped to that team, then refresh the view. */
export const selectTeam = (teamId) => async (dispatch) => {
  dispatch(setSelectedTeam(teamId || null));
  dispatch(setSelectedAgent(null));
  await dispatch(loadAgents());
  await dispatch(refresh());
};

export const selectAgent = (agentId) => async (dispatch, getState) => {
  dispatch(setSelectedAgent(agentId));
  await dispatch(refresh());
};

export const changeMode = (mode) => async (dispatch) => {
  dispatch(setMode(mode));
  await dispatch(refresh());
};

export const changeScope = (scope) => async (dispatch, getState) => {
  dispatch(setScope(scope));
  // In agent scope, ensure an agent is selected before loading.
  const s = getState().activity;
  if (s.scope === 'agent' && !s.selectedAgentId && s.agents.length) {
    dispatch(setSelectedAgent(s.agents[0].id));
  }
  await dispatch(refresh());
};

export const changeRange = (rangeKey) => async (dispatch, getState) => {
  dispatch(setRange(rangeKey));
  // "All active agents" follows the range, so re-evaluate the roster when no team
  // is pinned. A pinned team's membership is range-independent.
  if (!getState().activity.selectedTeamId) await dispatch(loadAgents());
  await dispatch(refresh());
};

/** Apply a calendar-picked custom [from, to] range. */
export const applyCustomRange = ({ fromMs, toMs }) => async (dispatch, getState) => {
  dispatch(setCustomRange({ fromMs, toMs }));
  dispatch(setRange('custom'));
  if (!getState().activity.selectedTeamId) await dispatch(loadAgents());
  await dispatch(refresh());
};

/** (Re)load data for the current agent according to mode + range. */
export const refresh = () => async (dispatch, getState) => {
  stopLive();
  const s = getState().activity;
  const team = s.scope === 'team';
  if (!team && !s.selectedAgentId) { dispatch(setEvents([])); return; }

  const r = resolveRange(s.rangeKey, s.customFrom, s.customTo);
  const activityUrl = s.isDemo ? null : s.activityUrl;

  // Agent/team state (idle breakdown + shift) is sourced from Webex CC and
  // changes slowly, so it is loaded once per refresh (not polled every tick).
  loadState(dispatch, s, activityUrl, r, team);

  if (s.mode === 'live') {
    liveSub = createLiveSubscription(
      {
        activityUrl, accessToken: s.accessToken, orgId: s.orgId, datacenter: s.datacenter,
        agentId: s.selectedAgentId, team,
        windowMs: r.spanMs || (r.toMs - r.fromMs),
        fromMsFixed: r.anchored ? r.fromMs : null,
        toMsFixed: r.fixedTo ? r.toMs : null,
      },
      (events) => dispatch(setEvents(events)),
    );
    return;
  }

  // Historical
  dispatch(setLoading(true));
  try {
    const { fromMs, toMs } = r;
    const events = team
      ? await fetchTeamEvents({ activityUrl, accessToken: s.accessToken, orgId: s.orgId, datacenter: s.datacenter, fromMs, toMs })
      : await fetchAgentEvents({ activityUrl, accessToken: s.accessToken, orgId: s.orgId, datacenter: s.datacenter, agentId: s.selectedAgentId, fromMs, toMs });
    dispatch(setEvents(events));
  } catch (err) {
    dispatch(setError(err.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const teardown = () => () => { stopLive(); };

/** Load agent/team state (shift + idle breakdown) from Webex CC / mock. */
async function loadState(dispatch, s, activityUrl, range, team) {
  const { fromMs, toMs } = range;
  const ctx = { activityUrl, accessToken: s.accessToken, orgId: s.orgId, datacenter: s.datacenter };
  try {
    if (team) {
      const agentIds = (s.agents || []).map((a) => a.id);
      const states = await fetchTeamState({ ...ctx, agentIds, fromMs, toMs });
      dispatch(setTeamState(states));
    } else if (s.selectedAgentId) {
      const st = await fetchAgentState({ ...ctx, agentId: s.selectedAgentId, fromMs, toMs });
      dispatch(setAgentState(st));
    }
  } catch (err) {
    console.warn('[activity] loadState failed:', err.message);
  }
}

export default activitySlice.reducer;

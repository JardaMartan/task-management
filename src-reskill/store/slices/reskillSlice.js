import { createSlice } from '@reduxjs/toolkit';
import { fetchReskillConfig, fetchLiveAnalytics, applyReskillChanges } from '../../api';
import { stagedSummary } from '../../selectors';
import { SKILL_TEMPLATES } from '../../mock/mockData';

// Module-level (non-serializable) handle to the Desktop SDK so the Redux state
// stays fully serializable.
let desktopSDKRef = null;
export const getDesktopSDK = () => desktopSDKRef;

const initialState = {
  // load lifecycle
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: null,
  isDemo: true,

  // desktop context
  accessToken: null,
  orgId: null,
  datacenter: null,
  darkMode: false,
  // forced data mode from the `view` prop: 'mock' | 'live' | null (auto-detect)
  forcedMode: null,

  // configuration (from API or mock)
  skills: [],
  teams: [],
  agents: [],
  skillProfiles: [],
  // team ids this supervisor is allowed to manage; null = all teams
  supervisorTeamIds: null,

  // ui selections
  selectedTeamIds: [],
  search: '',
  onlyChanged: false,
  // active agent-state filter from the analytics donut (null = no filter)
  agentStateFilter: null,
  // editing mode: per-skill grid vs profile assignment
  viewMode: 'grid', // 'grid' | 'profiles'
  // matrix column scope: relevant-to-team skills vs the whole catalog
  showAllSkills: false,

  // analytics bar
  analyticsOpen: true,
  analyticsTrendDays: 30,
  // live trends + KPIs from the Search API; null = synthesize (demo / no creds)
  liveAnalytics: null,

  // staged (pending) skill changes: { [agentId]: { [skillId]: value } }
  draft: {},
  // staged (pending) skill-profile reassignments: { [agentId]: profileId }
  profileDraft: {},

  // apply lifecycle
  applying: false,
  applyResult: null, // { applied, simulated, count, failed, localOnly } | { error }
};

const reskillSlice = createSlice({
  name: 'reskill',
  initialState,
  reducers: {
    setStatus(state, action) {
      state.status = action.payload;
    },
    setError(state, action) {
      state.status = 'error';
      state.errorMessage = action.payload || null;
    },
    setDemo(state, action) {
      state.isDemo = Boolean(action.payload);
    },
    setContext(state, action) {
      const { accessToken, orgId, datacenter, darkMode, supervisorTeamIds, forcedMode } = action.payload || {};
      if (accessToken !== undefined) state.accessToken = accessToken;
      if (orgId !== undefined) state.orgId = orgId;
      if (datacenter !== undefined) state.datacenter = datacenter;
      if (darkMode !== undefined) state.darkMode = Boolean(darkMode);
      if (forcedMode !== undefined) state.forcedMode = forcedMode;
      if (supervisorTeamIds !== undefined) state.supervisorTeamIds = supervisorTeamIds;
    },
    setConfig(state, action) {
      const { skills, teams, agents, skillProfiles } = action.payload || {};
      state.skills = skills || [];
      state.teams = teams || [];
      state.agents = agents || [];
      // Sort profiles by name (case-insensitive, locale-aware Unicode order).
      state.skillProfiles = [...(skillProfiles || [])].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true }));
      state.status = 'ready';
      state.errorMessage = null;
    },
    setSelectedTeams(state, action) {
      state.selectedTeamIds = Array.isArray(action.payload) ? action.payload : [];
      if (state.selectedTeamIds.length === 0) state.agentStateFilter = null;
    },
    toggleTeam(state, action) {
      const id = action.payload;
      const i = state.selectedTeamIds.indexOf(id);
      if (i >= 0) state.selectedTeamIds.splice(i, 1);
      else state.selectedTeamIds.push(id);
      if (state.selectedTeamIds.length === 0) state.agentStateFilter = null;
    },
    setAgentStateFilter(state, action) {
      // toggle off when re-selecting the active state
      state.agentStateFilter = state.agentStateFilter === action.payload ? null : (action.payload || null);
    },
    setSearch(state, action) {
      state.search = action.payload || '';
    },
    setOnlyChanged(state, action) {
      state.onlyChanged = Boolean(action.payload);
    },
    setViewMode(state, action) {
      // Modes are mutually exclusive but their staged drafts persist; the
      // footer/review/apply only act on the active mode's draft (see selectors).
      state.viewMode = action.payload === 'profiles' ? 'profiles' : 'grid';
    },
    setShowAllSkills(state, action) {
      state.showAllSkills = Boolean(action.payload);
    },
    toggleAnalyticsOpen(state) {
      state.analyticsOpen = !state.analyticsOpen;
    },
    setAnalyticsTrendDays(state, action) {
      state.analyticsTrendDays = action.payload;
    },
    // Store (or clear) live analytics fetched from the Search API.
    setLiveAnalytics(state, action) {
      state.liveAnalytics = action.payload || null;
    },
    setApplying(state, action) {
      state.applying = Boolean(action.payload);
    },
    setApplyResult(state, action) {
      state.applyResult = action.payload || null;
    },
    // Commit the active mode's staged draft into the local config (the new
    // baseline), then clear that draft. Used after a successful apply.
    commitDraft(state, action) {
      const mode = action.payload;
      if (mode === 'profiles') {
        const profById = new Map(state.skillProfiles.map((p) => [p.id, p]));
        Object.entries(state.profileDraft).forEach(([agentId, profileId]) => {
          const agent = state.agents.find((a) => a.id === agentId);
          if (agent) {
            agent.skillProfileId = profileId;
            agent.skills = { ...(profById.get(profileId)?.skills || {}) };
          }
        });
        state.profileDraft = {};
      } else {
        Object.entries(state.draft).forEach(([agentId, skillMap]) => {
          const agent = state.agents.find((a) => a.id === agentId);
          if (agent) agent.skills = { ...agent.skills, ...skillMap };
        });
        state.draft = {};
      }
    },
    // Stage a single skill change for one agent. Setting it back to the base
    // value clears the override so the agent no longer counts as "changed".
    stageSkill(state, action) {
      const { agentId, skillId, value, baseValue } = action.payload;
      state.applyResult = null;
      if (!state.draft[agentId]) state.draft[agentId] = {};
      if (value === baseValue) {
        delete state.draft[agentId][skillId];
        if (Object.keys(state.draft[agentId]).length === 0) delete state.draft[agentId];
      } else {
        state.draft[agentId][skillId] = value;
      }
    },
    // Stage a set of skill changes across many agents at once. `entries` is an
    // array of { agentId, skillId, value, baseValue }.
    stageBulk(state, action) {
      const entries = action.payload || [];
      state.applyResult = null;
      entries.forEach(({ agentId, skillId, value, baseValue }) => {
        if (!state.draft[agentId]) state.draft[agentId] = {};
        if (value === baseValue) {
          delete state.draft[agentId][skillId];
          if (Object.keys(state.draft[agentId]).length === 0) delete state.draft[agentId];
        } else {
          state.draft[agentId][skillId] = value;
        }
      });
    },
    clearDraft(state) {
      state.draft = {};
      state.profileDraft = {};
    },
    // Reset only the active mode's staged changes (the modes are independent).
    resetCurrentMode(state) {
      state.applyResult = null;
      if (state.viewMode === 'profiles') state.profileDraft = {};
      else state.draft = {};
    },
    // Stage (or clear) a skill-profile reassignment for one agent.
    stageProfile(state, action) {
      const { agentId, profileId, baseProfileId } = action.payload;
      state.applyResult = null;
      if (profileId === baseProfileId || !profileId) {
        delete state.profileDraft[agentId];
      } else {
        state.profileDraft[agentId] = profileId;
      }
    },
    // Assign a profile to many agents at once. `entries` = [{agentId, baseProfileId}].
    stageProfileBulk(state, action) {
      const { profileId, entries } = action.payload || {};
      state.applyResult = null;
      (entries || []).forEach(({ agentId, baseProfileId }) => {
        if (profileId === baseProfileId || !profileId) {
          delete state.profileDraft[agentId];
        } else {
          state.profileDraft[agentId] = profileId;
        }
      });
    },
  },
});

export const {
  setStatus,
  setError,
  setDemo,
  setContext,
  setConfig,
  setSelectedTeams,
  toggleTeam,
  setSearch,
  setOnlyChanged,
  toggleAnalyticsOpen,
  setAnalyticsTrendDays,
  setLiveAnalytics,
  setApplying,
  setApplyResult,
  commitDraft,
  setViewMode,
  setShowAllSkills,
  setAgentStateFilter,
  stageSkill,
  stageBulk,
  clearDraft,
  resetCurrentMode,
  stageProfile,
  stageProfileBulk,
} = reskillSlice.actions;

export default reskillSlice.reducer;

// ─── Thunks ──────────────────────────────────────────────────────────────────

/**
 * Initialize the widget: try the Desktop SDK (for token/org/datacenter), fall
 * back to demo mode, then load the configuration.
 */
export const initReskillWidget = () => async (dispatch, getState) => {
  dispatch(setStatus('loading'));
  try {
    const forced = getState().reskill.forcedMode;
    if (forced === 'mock') {
      // Explicit mock view — skip the SDK entirely and use demo data.
      dispatch(setDemo(true));
    } else {
      try {
        // Race the SDK init against a timeout: outside the Desktop host the SDK
        // awaits services that never come up, so config.init() can hang instead
        // of rejecting. The timeout guarantees we fall back to demo mode.
        const { Desktop } = await import('@wxcc-desktop/sdk');
        const initPromise = Desktop.config.init({
          widgetName: 'bulk-reskill',
          widgetProvider: 'bulk-reskill',
        });
        const timeout = new Promise((_, reject) => setTimeout(
          () => reject(new Error('SDK init timed out')), 2500,
        ));
        await Promise.race([initPromise, timeout]);
        desktopSDKRef = Desktop;
        dispatch(setDemo(false));
        // Context (token/org/datacenter) is normally injected via widget props;
        // the SDK presence simply flips us out of demo mode.
      } catch (sdkError) {
        console.log('[reskill] Desktop SDK unavailable:', sdkError?.message);
        // Explicit live view stays live (api falls back to mock if creds are
        // missing); otherwise auto-detect drops to demo mode.
        dispatch(setDemo(forced !== 'live'));
      }
    }

    await dispatch(loadConfig());
  } catch (error) {
    console.error('[reskill] initialization failed:', error);
    dispatch(setError(error?.message || 'init failed'));
  }
};

/**
 * Load teams/agents/skills from the API (or mock data in demo mode), then apply
 * the supervisor team scope.
 */
export const loadConfig = () => async (dispatch, getState) => {
  const { isDemo, accessToken, orgId, datacenter, supervisorTeamIds } = getState().reskill;
  dispatch(setStatus('loading'));
  try {
    const config = await fetchReskillConfig({ isDemo, accessToken, orgId, datacenter });

    // If a live attempt degraded to mock data, reflect that in the badge.
    if (config.source === 'mock' && !isDemo) dispatch(setDemo(true));

    // Restrict to teams the supervisor manages, when that scope is known.
    let teams = config.teams;
    let agents = config.agents;
    if (Array.isArray(supervisorTeamIds) && supervisorTeamIds.length > 0) {
      const allowed = new Set(supervisorTeamIds);
      teams = teams.filter((t) => allowed.has(t.id));
      agents = agents.filter((a) => allowed.has(a.teamId));
    }

    dispatch(setConfig({ skills: config.skills, teams, agents, skillProfiles: config.skillProfiles || [] }));

    // Refresh live trends + KPIs (no-op in demo mode → synthesized).
    dispatch(loadAnalytics());
  } catch (error) {
    console.error('[reskill] loadConfig failed:', error);
    dispatch(setError(error?.message || 'load failed'));
  }
};

/**
 * Fetch live operational analytics (trends + KPIs) from the Search API and store
 * them. In demo mode it clears any live data so the analytics bar synthesizes.
 * Never throws — a failed/partial fetch leaves the synthesized fallback in place.
 */
export const loadAnalytics = () => async (dispatch, getState) => {
  const { isDemo, accessToken, orgId, datacenter, analyticsTrendDays, selectedTeamIds, teams } = getState().reskill;
  if (isDemo) {
    dispatch(setLiveAnalytics(null));
    return;
  }
  try {
    // Scope trends/KPIs to the selected teams (names for tasks, ids for ASR).
    const selected = new Set(selectedTeamIds || []);
    const scopedTeams = (teams || []).filter((tm) => selected.has(tm.id));
    const teamIds = scopedTeams.map((tm) => tm.id);
    const teamNames = scopedTeams.map((tm) => tm.name).filter(Boolean);

    const data = await fetchLiveAnalytics({
      isDemo, accessToken, orgId, datacenter, trendDays: analyticsTrendDays, teamIds, teamNames,
    });
    dispatch(setLiveAnalytics(data));
  } catch (error) {
    console.warn('[reskill] loadAnalytics failed — using synthesized values:', error?.message);
    dispatch(setLiveAnalytics(null));
  }
};

/**
 * Apply the active mode's staged changes. Persists live profile reassignments to
 * Webex CC (read-modify-write per user); demo mode and per-skill grid edits are
 * committed locally. On success the draft is folded into the local baseline.
 */
export const applyChanges = () => async (dispatch, getState) => {
  const s = getState().reskill;
  const mode = s.viewMode;

  const profileChanges = mode === 'profiles'
    ? Object.entries(s.profileDraft).map(([agentId, profileId]) => ({ agentId, profileId }))
    : [];
  const skillChangeCount = mode === 'profiles' ? 0 : stagedSummary(s.draft).changes;

  if ((mode === 'profiles' ? profileChanges.length : skillChangeCount) === 0) return;

  dispatch(setApplying(true));
  dispatch(setApplyResult(null));
  try {
    const result = await applyReskillChanges(
      { isDemo: s.isDemo, accessToken: s.accessToken, orgId: s.orgId, datacenter: s.datacenter },
      { mode, profileChanges, skillChangeCount },
    );
    if (result.applied) {
      dispatch(commitDraft(mode));
      // Coverage/analytics depend on the now-updated baseline.
      dispatch(loadAnalytics());
    }
    dispatch(setApplyResult(result));
  } catch (error) {
    console.error('[reskill] applyChanges failed:', error);
    dispatch(setApplyResult({ applied: false, error: error?.message || 'apply failed' }));
  } finally {
    dispatch(setApplying(false));
  }
};

/**
 * Switch the data mode at runtime (from the Demo/Live badge). Resets selections
 * and staged drafts (which reference mode-specific ids), then reloads config.
 * Without credentials a 'live' switch degrades back to demo automatically.
 *
 * @param {'mock'|'live'} mode
 */
export const setDataMode = (mode) => async (dispatch) => {
  const next = mode === 'live' ? 'live' : 'mock';
  dispatch(setContext({ forcedMode: next }));
  dispatch(setDemo(next !== 'live'));
  dispatch(setSelectedTeams([]));
  dispatch(clearDraft());
  await dispatch(loadConfig());
};

/**
 * Hydrate desktop context passed in via web-component props.
 */
export const hydrateContext = (props = {}) => (dispatch) => {
  const supervisorTeamIds = parseTeamScope(props.teams || props.supervisorteams);
  dispatch(setContext({
    accessToken: props.accesstoken || null,
    orgId: props.orgid || null,
    datacenter: props.datacenter || null,
    darkMode: props.darkmode === true || props.darkmode === 'true',
    supervisorTeamIds,
    forcedMode: parseViewMode(props.view),
  }));
};

/** Map the `view` prop to a forced data mode: 'mock' | 'live' | null (auto). */
function parseViewMode(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'mock' || v === 'demo') return 'mock';
  if (v === 'live' || v === 'prod' || v === 'production') return 'live';
  return null;
}

function parseTeamScope(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_e) {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return null;
}

export { SKILL_TEMPLATES };

import { createSlice } from '@reduxjs/toolkit';
import { fetchTeams, fetchExperienceConfig, saveExperienceConfig } from '../../api';
import { DEFAULT_PROOFREAD_PROMPT, DEFAULT_PROMPT_TEAM } from '../../constants';

// Module-level (non-serializable) handle to the Desktop SDK so the Redux state
// stays fully serializable.
let desktopSDKRef = null;
export const getDesktopSDK = () => desktopSDKRef;

const emptyConfig = () => ({
  languages: ['en'],
  templates: [],
  signatures: [],
  templateAssignments: {},
  signatureAssignments: {},
  proofreadPrompts: { default: DEFAULT_PROOFREAD_PROMPT, teams: {} },
});

const initialState = {
  // load lifecycle
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: null,
  isDemo: true,
  source: 'mock', // 'live' | 'mock'

  // desktop context
  accessToken: null,
  orgId: null,
  datacenter: null,
  darkMode: false,
  experienceUrl: null,
  forcedMode: null, // 'mock' | 'live' | null

  // team scope
  teams: [],
  supervisorTeamIds: null, // null = all teams

  // navigation
  activeSection: 'email', // 'email' | 'chat'
  activeSubtab: 'templates', // 'templates' | 'signatures' | 'prompt'
  // language-first: the active template language flavor (UI selection, not saved)
  activeLanguage: 'en',

  // working configuration + last-saved snapshot (for dirty + reset)
  config: emptyConfig(),
  savedConfig: emptyConfig(),

  // editing selections
  selectedTemplateId: null,
  selectedSignatureId: null,
  promptTeamId: DEFAULT_PROMPT_TEAM, // DEFAULT_PROMPT_TEAM = org default

  // save lifecycle
  saving: false,
  saveResult: null, // { saved, simulated } | { error }
};

const clone = (o) => JSON.parse(JSON.stringify(o));

const experienceSlice = createSlice({
  name: 'experience',
  initialState,
  reducers: {
    setStatus(state, action) { state.status = action.payload; },
    setError(state, action) {
      state.status = 'error';
      state.errorMessage = action.payload || null;
    },
    setDemo(state, action) { state.isDemo = Boolean(action.payload); },
    setSource(state, action) { state.source = action.payload === 'live' ? 'live' : 'mock'; },
    setContext(state, action) {
      const { accessToken, orgId, datacenter, darkMode, experienceUrl, supervisorTeamIds, forcedMode } = action.payload || {};
      if (accessToken !== undefined) state.accessToken = accessToken;
      if (orgId !== undefined) state.orgId = orgId;
      if (datacenter !== undefined) state.datacenter = datacenter;
      if (darkMode !== undefined) state.darkMode = Boolean(darkMode);
      if (experienceUrl !== undefined) state.experienceUrl = experienceUrl;
      if (forcedMode !== undefined) state.forcedMode = forcedMode;
      if (supervisorTeamIds !== undefined) state.supervisorTeamIds = supervisorTeamIds;
    },
    setTeams(state, action) {
      state.teams = Array.isArray(action.payload) ? action.payload : [];
    },
    setConfig(state, action) {
      const cfg = action.payload || emptyConfig();
      state.config = clone(cfg);
      state.savedConfig = clone(cfg);
      state.status = 'ready';
      state.errorMessage = null;
      state.saveResult = null;
      // Keep the active language valid against the loaded language set.
      const langs = state.config.languages && state.config.languages.length ? state.config.languages : ['en'];
      if (!langs.includes(state.activeLanguage)) state.activeLanguage = langs[0] || 'en';
      // Keep current editing selections valid.
      if (!state.config.templates.some((t) => t.id === state.selectedTemplateId)) {
        state.selectedTemplateId = state.config.templates[0]?.id || null;
      }
      if (!state.config.signatures.some((s) => s.id === state.selectedSignatureId)) {
        state.selectedSignatureId = state.config.signatures[0]?.id || null;
      }
    },

    // ── navigation ────────────────────────────────────────────────────────
    setActiveSection(state, action) {
      state.activeSection = action.payload === 'chat' ? 'chat' : 'email';
    },
    setActiveSubtab(state, action) {
      const v = action.payload;
      state.activeSubtab = ['templates', 'signatures', 'prompt'].includes(v) ? v : 'templates';
    },
    selectTemplate(state, action) { state.selectedTemplateId = action.payload || null; },
    selectSignature(state, action) { state.selectedSignatureId = action.payload || null; },
    setPromptTeam(state, action) { state.promptTeamId = action.payload || DEFAULT_PROMPT_TEAM; },

    // ── languages (language-first template model) ─────────────────────────
    setActiveLanguage(state, action) {
      state.activeLanguage = action.payload || 'en';
    },
    addLanguage(state, action) {
      const code = String(action.payload || '').trim().toLowerCase();
      if (!code) return;
      if (!state.config.languages) state.config.languages = [];
      if (!state.config.languages.includes(code)) state.config.languages.push(code);
      state.activeLanguage = code;
      state.saveResult = null;
    },
    removeLanguage(state, action) {
      const code = action.payload;
      if (!state.config.languages) return;
      state.config.languages = state.config.languages.filter((l) => l !== code);
      // Drop that flavor from every template.
      state.config.templates.forEach((t) => { if (t.variants) delete t.variants[code]; });
      if (state.activeLanguage === code) state.activeLanguage = state.config.languages[0] || 'en';
      state.saveResult = null;
    },

    // ── template editing ──────────────────────────────────────────────────
    addTemplate(state, action) {
      const tpl = action.payload;
      state.config.templates.push(tpl);
      state.selectedTemplateId = tpl.id;
      state.saveResult = null;
    },
    // Shared (language-independent) fields: category, variables.
    updateTemplateMeta(state, action) {
      const { id, patch } = action.payload;
      const t = state.config.templates.find((x) => x.id === id);
      if (t) {
        if (patch.category !== undefined) t.category = patch.category;
        if (patch.variables !== undefined) t.variables = patch.variables;
      }
      state.saveResult = null;
    },
    // Create (on first edit) or update one language flavor of a template.
    updateTemplateVariant(state, action) {
      const { id, lang, patch } = action.payload;
      const t = state.config.templates.find((x) => x.id === id);
      if (!t) return;
      if (!t.variants) t.variants = {};
      if (!t.variants[lang]) t.variants[lang] = { name: '', subject: '', body: '' };
      Object.assign(t.variants[lang], patch);
      state.saveResult = null;
    },
    // Remove one language flavor, leaving the template's other languages intact.
    removeTemplateVariant(state, action) {
      const { id, lang } = action.payload;
      const t = state.config.templates.find((x) => x.id === id);
      if (t && t.variants) delete t.variants[lang];
      state.saveResult = null;
    },
    deleteTemplate(state, action) {
      const id = action.payload;
      state.config.templates = state.config.templates.filter((t) => t.id !== id);
      delete state.config.templateAssignments[id];
      if (state.selectedTemplateId === id) {
        state.selectedTemplateId = state.config.templates[0]?.id || null;
      }
      state.saveResult = null;
    },

    // ── signature editing ─────────────────────────────────────────────────
    addSignature(state, action) {
      const sig = action.payload;
      state.config.signatures.push(sig);
      state.selectedSignatureId = sig.id;
      state.saveResult = null;
    },
    updateSignatureVariant(state, action) {
      const { id, lang, patch } = action.payload;
      const s = state.config.signatures.find((x) => x.id === id);
      if (!s) return;
      if (!s.variants) s.variants = {};
      if (!s.variants[lang]) s.variants[lang] = { name: '', html: '' };
      Object.assign(s.variants[lang], patch);
      state.saveResult = null;
    },
    removeSignatureVariant(state, action) {
      const { id, lang } = action.payload;
      const s = state.config.signatures.find((x) => x.id === id);
      if (s && s.variants) delete s.variants[lang];
      state.saveResult = null;
    },
    deleteSignature(state, action) {
      const id = action.payload;
      state.config.signatures = state.config.signatures.filter((s) => s.id !== id);
      delete state.config.signatureAssignments[id];
      if (state.selectedSignatureId === id) {
        state.selectedSignatureId = state.config.signatures[0]?.id || null;
      }
      state.saveResult = null;
    },

    // ── assignment matrix (many-to-many) ──────────────────────────────────
    // kind = 'template' | 'signature'
    toggleAssignment(state, action) {
      const { kind, itemId, teamId } = action.payload;
      const key = kind === 'signature' ? 'signatureAssignments' : 'templateAssignments';
      const list = state.config[key][itemId] || [];
      const i = list.indexOf(teamId);
      if (i >= 0) list.splice(i, 1);
      else list.push(teamId);
      state.config[key][itemId] = list;
      state.saveResult = null;
    },
    // Set the full team list for one item at once (used by row select-all/clear).
    setAssignment(state, action) {
      const { kind, itemId, teamIds } = action.payload;
      const key = kind === 'signature' ? 'signatureAssignments' : 'templateAssignments';
      state.config[key][itemId] = Array.isArray(teamIds) ? [...teamIds] : [];
      state.saveResult = null;
    },

    // ── proofread prompt editing ──────────────────────────────────────────
    // teamId === DEFAULT_PROMPT_TEAM edits the org-wide default.
    updatePrompt(state, action) {
      const { teamId, text } = action.payload;
      if (teamId === DEFAULT_PROMPT_TEAM) {
        state.config.proofreadPrompts.default = text;
      } else {
        state.config.proofreadPrompts.teams[teamId] = text;
      }
      state.saveResult = null;
    },
    // Remove a team override so the team falls back to the org default.
    resetPrompt(state, action) {
      const teamId = action.payload;
      if (teamId === DEFAULT_PROMPT_TEAM) {
        state.config.proofreadPrompts.default = DEFAULT_PROOFREAD_PROMPT;
      } else {
        delete state.config.proofreadPrompts.teams[teamId];
      }
      state.saveResult = null;
    },

    // ── save / reset lifecycle ────────────────────────────────────────────
    resetConfig(state) {
      state.config = clone(state.savedConfig);
      state.saveResult = null;
    },
    setSaving(state, action) { state.saving = Boolean(action.payload); },
    setSaveResult(state, action) { state.saveResult = action.payload || null; },
    markSaved(state) {
      state.savedConfig = clone(state.config);
    },
  },
});

export const {
  setStatus, setError, setDemo, setSource, setContext, setTeams, setConfig,
  setActiveSection, setActiveSubtab, selectTemplate, selectSignature, setPromptTeam,
  setActiveLanguage, addLanguage, removeLanguage,
  addTemplate, updateTemplateMeta, updateTemplateVariant, removeTemplateVariant, deleteTemplate,
  addSignature, updateSignatureVariant, removeSignatureVariant, deleteSignature,
  toggleAssignment, setAssignment,
  updatePrompt, resetPrompt,
  resetConfig, setSaving, setSaveResult, markSaved,
} = experienceSlice.actions;

export default experienceSlice.reducer;

// ─── localStorage cache (per org) ────────────────────────────────────────────
const cacheKey = (orgId) => `wx_experience_config_${orgId || 'demo'}`;

function readCache(orgId) {
  try {
    const raw = globalThis.localStorage?.getItem(cacheKey(orgId));
    return raw ? JSON.parse(raw) : null;
  } catch (_e) { return null; }
}

function writeCache(orgId, config) {
  try { globalThis.localStorage?.setItem(cacheKey(orgId), JSON.stringify(config)); } catch (_e) { /* ignore */ }
}

// ─── Thunks ──────────────────────────────────────────────────────────────────

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

/** Hydrate desktop context passed in via web-component props. */
export const hydrateContext = (props = {}) => (dispatch) => {
  const supervisorTeamIds = parseTeamScope(props.teams || props.supervisorteams);
  dispatch(setContext({
    accessToken: props.accesstoken || null,
    orgId: props.orgid || null,
    datacenter: props.datacenter || null,
    darkMode: props.darkmode === true || props.darkmode === 'true',
    experienceUrl: props.experienceurl || null,
    supervisorTeamIds,
    forcedMode: parseViewMode(props.view),
  }));
};

/**
 * Initialize the widget: try the Desktop SDK (for the demo/live flip), fall back
 * to demo mode, then load teams + configuration.
 */
export const initExperienceWidget = () => async (dispatch, getState) => {
  dispatch(setStatus('loading'));
  try {
    const forced = getState().experience.forcedMode;
    if (forced === 'mock') {
      dispatch(setDemo(true));
    } else {
      try {
        const { Desktop } = await import('@wxcc-desktop/sdk');
        const initPromise = Desktop.config.init({
          widgetName: 'agent-experience',
          widgetProvider: 'agent-experience',
        });
        const timeout = new Promise((_, reject) => setTimeout(
          () => reject(new Error('SDK init timed out')), 2500,
        ));
        await Promise.race([initPromise, timeout]);
        desktopSDKRef = Desktop;
        dispatch(setDemo(false));
      } catch (sdkError) {
        console.log('[experience] Desktop SDK unavailable:', sdkError?.message);
        dispatch(setDemo(forced !== 'live'));
      }
    }
    await dispatch(loadAll());
  } catch (error) {
    console.error('[experience] initialization failed:', error);
    dispatch(setError(error?.message || 'init failed'));
  }
};

/** Load teams (Config API) and configuration (settings service / cache / mock). */
export const loadAll = () => async (dispatch, getState) => {
  const { isDemo, accessToken, orgId, datacenter, experienceUrl, supervisorTeamIds } = getState().experience;
  dispatch(setStatus('loading'));
  try {
    const [teamsRes, cfgRes] = await Promise.all([
      fetchTeams({ isDemo, accessToken, orgId, datacenter }),
      fetchExperienceConfig({ isDemo, accessToken, orgId, experienceUrl }),
    ]);

    // Restrict to the supervisor's teams when that scope is known.
    let teams = teamsRes.teams;
    if (Array.isArray(supervisorTeamIds) && supervisorTeamIds.length > 0) {
      const allowed = new Set(supervisorTeamIds);
      teams = teams.filter((t) => allowed.has(t.id));
    }
    dispatch(setTeams(teams));

    // Config: prefer live; if it degraded to mock but we have a fresher local
    // cache for this org, use the cache instead (offline / transient failure).
    let config = cfgRes.config;
    let source = cfgRes.source;
    if (source === 'mock' && !isDemo) {
      const cached = readCache(orgId);
      if (cached) config = cached;
    }
    if (source === 'live') writeCache(orgId, config);

    dispatch(setSource(source === 'live' ? 'live' : 'mock'));
    if (source === 'mock' && !isDemo && !experienceUrl) dispatch(setDemo(true));
    dispatch(setConfig(config));
  } catch (error) {
    console.error('[experience] loadAll failed:', error);
    dispatch(setError(error?.message || 'load failed'));
  }
};

/** Persist the current working configuration. */
export const saveConfig = () => async (dispatch, getState) => {
  const { isDemo, accessToken, orgId, experienceUrl, config } = getState().experience;
  dispatch(setSaving(true));
  dispatch(setSaveResult(null));
  try {
    const result = await saveExperienceConfig({ isDemo, accessToken, orgId, experienceUrl }, config);
    if (result.saved) {
      dispatch(markSaved());
      writeCache(orgId, config);
    }
    dispatch(setSaveResult(result));
  } catch (error) {
    dispatch(setSaveResult({ saved: false, error: error?.message || 'save failed' }));
  } finally {
    dispatch(setSaving(false));
  }
};

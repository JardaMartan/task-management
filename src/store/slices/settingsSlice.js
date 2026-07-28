import { createSlice } from '@reduxjs/toolkit';

// Per-agent Customer360 settings, persisted in localStorage keyed by agentId.
// Persistence is intentionally client-side/local for now; a server-backed
// (Firestore) hybrid can be layered on later behind loadAgentSettings/writeLs.
//
// NOTE: keep the settings object grouped by feature (sla, …) so new setting
// groups can be added without touching the persistence plumbing.

const LS_PREFIX = 'wx_c360_settings_';
const lsKey = (agentId) => `${LS_PREFIX}${agentId || 'anon'}`;

const readLs = (agentId) => {
  try { return JSON.parse(localStorage.getItem(lsKey(agentId))) || null; } catch { return null; }
};
const writeLs = (agentId, data) => {
  try { localStorage.setItem(lsKey(agentId), JSON.stringify(data)); } catch { /* quota/denied — ignore */ }
};

// ── Webex CC Configuration API: list ALL queues (contact-service-queue) ───────
// The routing-service call (agentContact.vteamList) only returns queues the
// agent may transfer to AND that are wired to an entry point / flow. A queue
// created purely as a transfer target (not referenced by a flow) is excluded.
// The Config API lists every queue of a channel regardless, so we merge it in.
const DC_REGIONS = ['anz1', 'eu1', 'eu2', 'us1', 'ca1', 'jp1', 'in1', 'sg1'];
const configBaseForDatacenter = (datacenter) => {
  const raw = String(datacenter || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const region = DC_REGIONS.find((r) => raw.includes(r)) || 'us1';
  return `https://api.wxcc-${region}.cisco.com`;
};

// Fetch every queue of a channel from the Config API. Returns [{id,name,type}]
// or [] on any failure (missing token/scope, wrong region, network). Never throws.
async function fetchConfigQueues(channelType, { accessToken, orgId, datacenter } = {}) {
  if (!accessToken || !orgId) return [];
  const base = configBaseForDatacenter(datacenter);
  const org = encodeURIComponent(orgId);
  const reqHeaders = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  const want = String(channelType || '').toLowerCase();
  const out = [];
  let sample = null;
  try {
    for (let page = 0; page < 50; page++) {
      const url = `${base}/organization/${org}/contact-service-queue?page=${page}&pageSize=100`;
      const res = await fetch(url, { headers: reqHeaders });
      if (!res.ok) {
        console.warn('[settings] contact-service-queue fetch failed:', res.status, 'on', base,
          '(token may lack config-read scope, or wrong region)');
        break;
      }
      const json = await res.json();
      const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      if (!sample && list.length) sample = list[0];
      list.forEach((q) => {
        const ch = String(q.channelType ?? q.channelTypes ?? q.mediaType ?? '').toLowerCase();
        if (ch.includes(want)) out.push({ id: q.id, name: q.name, type: 'inboundqueue' });
      });
      const totalPages = json?.meta?.totalPages;
      if (list.length < 100 || (totalPages && page + 1 >= totalPages)) break;
    }
    if (!out.length && sample) {
      console.log('[settings] contact-service-queue: no', want, 'match. Sample keys=',
        Object.keys(sample), '| channelType=', sample.channelType);
    }
  } catch (e) {
    console.warn('[settings] contact-service-queue error:', e?.message);
  }
  return out;
}

// Merge queue lists, de-duplicating by id (first wins), sorted by name.
function mergeQueues() {
  const seen = new Set();
  const out = [];
  [].concat(...arguments).forEach((q) => {
    if (!q || !q.id || seen.has(String(q.id))) return;
    seen.add(String(q.id));
    out.push(q);
  });
  return out.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

// Default SLA-expiry requeue settings (EMAIL only for now; other channels can
// be added later — real-time channels may need faster/stricter defaults).
const defaultSla = {
  action: 'none',        // 'none' | 'offer' | 'auto'
  triggerOn: 'imminent', // 'imminent' (within slaThresholdMinutes) | 'expired'
  autoCountdownSec: 15,  // interruptible countdown before an auto requeue fires
  queues: {              // channel → { vteamId, vteamType, name }
    email: null,
  },
  wrapUp: null,          // { auxCodeId, name } — auto-submitted on requeue (no agent action)
};

const mergeSla = (...sources) => {
  const out = { ...defaultSla, queues: { ...defaultSla.queues } };
  sources.forEach((s) => {
    if (!s || typeof s !== 'object') return;
    if (s.action) out.action = s.action;
    if (s.triggerOn) out.triggerOn = s.triggerOn;
    if (s.autoCountdownSec != null && Number.isFinite(Number(s.autoCountdownSec))) {
      out.autoCountdownSec = Math.round(Number(s.autoCountdownSec));
    }
    if (s.queues && typeof s.queues === 'object') out.queues = { ...out.queues, ...s.queues };
    if (s.wrapUp !== undefined) out.wrapUp = s.wrapUp;
  });
  return out;
};

// Default "focus mode" settings now live in the central headless watcher
// (crm-sync-header.js) and are configured from the CRM Tab Manager. This slice
// only owns the interactive per-task requeue settings.

const initialState = {
  agentId: null,
  hydrated: false,
  sla: defaultSla,
  // Transient (not persisted): channel → fetched queue/EP list for the pickers.
  channelQueues: {},
  loadingQueues: false,
  // Transient: agent's wrap-up (aux) codes for the wrap-up reason picker.
  wrapUpCodes: [],
};

// Persist the per-agent settings (sla / requeue). Focus settings are owned by
// the watcher under a separate localStorage key.
const persist = (state) => writeLs(state.agentId, { sla: state.sla });

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    hydrateSettings: (state, action) => {
      const { agentId, defaults } = action.payload || {};
      state.agentId = agentId || null;
      const saved = readLs(agentId);
      state.sla = mergeSla(defaults?.sla, saved?.sla);
      state.hydrated = true;
    },
    setSlaAction: (state, action) => {
      state.sla.action = action.payload;
      persist(state);
    },
    setSlaTriggerOn: (state, action) => {
      state.sla.triggerOn = action.payload;
      persist(state);
    },
    setSlaAutoCountdown: (state, action) => {
      const n = Number(action.payload);
      if (Number.isFinite(n) && n >= 3) state.sla.autoCountdownSec = Math.round(n);
      persist(state);
    },
    setSlaQueue: (state, action) => {
      const { channel, queue } = action.payload || {};
      if (!channel) return;
      state.sla.queues[channel] = queue || null;
      persist(state);
    },
    setSlaWrapUp: (state, action) => {
      state.sla.wrapUp = action.payload || null;
      persist(state);
    },
    setChannelQueues: (state, action) => {
      const { channel, queues } = action.payload || {};
      if (channel) state.channelQueues[channel] = Array.isArray(queues) ? queues : [];
    },
    setLoadingQueues: (state, action) => {
      state.loadingQueues = Boolean(action.payload);
    },
    setWrapUpCodes: (state, action) => {
      state.wrapUpCodes = Array.isArray(action.payload) ? action.payload : [];
    },
  },
});

export const {
  hydrateSettings,
  setSlaAction,
  setSlaTriggerOn,
  setSlaAutoCountdown,
  setSlaQueue,
  setSlaWrapUp,
  setChannelQueues,
  setLoadingQueues,
  setWrapUpCodes,
} = settingsSlice.actions;

export default settingsSlice.reducer;

// ─── Thunks ─────────────────────────────────────────────────────────────────

/** Hydrate per-agent settings from localStorage, merging admin layout defaults. */
export const loadAgentSettings = () => (dispatch, getState) => {
  const w = getState().widget;
  const agentId = w.agent?.agentId || w.agent?.agentDbId || 'default';
  const defaults = w.widgetConfig?.slaRequeueDefaults
    ? { sla: w.widgetConfig.slaRequeueDefaults }
    : null;
  dispatch(hydrateSettings({ agentId, defaults }));
};

/**
 * Fetch the channel-specific queue/entry-point list via the Desktop SDK
 * (agentContact.vteamList) for the requeue pickers. Never throws — on any
 * failure the list is set empty and the UI falls back to the stored queue.
 */
export const fetchChannelQueues = (channelType) => async (dispatch, getState) => {
  const w = getState().widget;
  dispatch(setLoadingQueues(true));
  try {
    const { Desktop } = await import('@wxcc-desktop/sdk');
    const info = Desktop?.agentStateInfo?.latestData || {};
    const data = {
      agentProfileId: w.agent?.agentProfileId || info.agentProfileID || '',
      agentSessionId: info.agentSessionId || '',
      channelType,
      type: 'inboundqueue',
    };
    const res = await Desktop.agentContact.vteamList({ data });
    // VTeamSuccess is a doubly-nested Msg envelope:
    //   { type, orgId, trackingId, data: { data: { vteamList: [...] }, ... } }
    const raw = res?.data?.data?.vteamList
      || res?.data?.vteamList
      || res?.vteamList
      || [];
    let list = raw.map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type || 'inboundqueue',
      channelType: v.channelType,
    }));
    // Also include ALL config queues of this channel (transfer-only queues that
    // vteamList omits), merged + de-duplicated by id.
    const cfgQueues = await fetchConfigQueues(channelType, {
      accessToken: w.accesstoken, orgId: w.orgid, datacenter: w.datacenter,
    });
    list = mergeQueues(cfgQueues, list);
    if (!list.length) {
      console.warn('[settings] vteamList returned no queues. req=', JSON.stringify(data),
        'raw=', JSON.stringify(res)?.slice(0, 500));
    }
    dispatch(setChannelQueues({ channel: channelType, queues: list }));
  } catch (err) {
    console.warn('[settings] fetchChannelQueues failed:', err?.message);
    dispatch(setChannelQueues({ channel: channelType, queues: [] }));
  } finally {
    dispatch(setLoadingQueues(false));
  }
};

/**
 * Fetch the agent's wrap-up (aux) codes from the Desktop SDK for the wrap-up
 * reason picker. Sourced from agentStateInfo.latestData.wrapupCodes ({id,name}).
 */
export const fetchWrapUpCodes = () => async (dispatch) => {
  try {
    const { Desktop } = await import('@wxcc-desktop/sdk');
    const codes = Desktop?.agentStateInfo?.latestData?.wrapupCodes || [];
    dispatch(setWrapUpCodes(codes.map((c) => ({ id: c.id, name: c.name }))));
  } catch (err) {
    console.warn('[settings] fetchWrapUpCodes failed:', err?.message);
    dispatch(setWrapUpCodes([]));
  }
};

/**
 * After a requeue transfer the agent typically enters wrap-up. Submit the
 * pre-configured wrap-up reason automatically so no agent action is needed.
 * Waits for the wrap-up state (eAgentWrapup) and also retries after a short
 * delay in case the event was missed / the task is already in wrap-up.
 */
const autoSubmitWrapup = (Desktop, interactionId, wrapUp) => new Promise((resolve) => {
  let submitting = false;
  let settled = false;
  let timer = null;

  const cleanup = () => {
    try { Desktop.agentContact.removeEventListener('eAgentWrapup', onWrapup); } catch { /* ignore */ }
    if (timer) clearTimeout(timer);
  };
  const finish = () => { if (settled) return; settled = true; cleanup(); resolve(); };

  const doWrapup = async () => {
    if (submitting || settled) return;
    submitting = true;
    try {
      await Desktop.agentContact.wrapupV2({
        interactionId,
        data: { wrapUpReason: wrapUp.name || 'Auto requeue', auxCodeId: wrapUp.auxCodeId },
      });
      console.log('[settings] auto wrap-up submitted for', interactionId);
    } catch (e) {
      console.warn('[settings] auto wrap-up failed:', e?.message);
    }
    finish();
  };

  const onWrapup = (msg) => {
    const id = msg?.data?.interactionId || msg?.interactionId;
    if (!id || id === interactionId) doWrapup();
  };

  try { Desktop.agentContact.addEventListener('eAgentWrapup', onWrapup); } catch { /* ignore */ }
  // Fallback: attempt wrap-up even if the event never arrives (already in wrap-up).
  timer = setTimeout(doWrapup, 2500);
});

/**
 * Requeue a task by transferring it to a queue/entry point (vteamTransfer),
 * then — if a wrap-up reason is configured — auto-submit it so the requeue is
 * fully hands-off. Returns true on success, false otherwise. Never throws.
 */
export const requeueTask = ({ interactionId, vteamId, vteamType = 'inboundqueue', wrapUp }) => async () => {
  if (!interactionId || !vteamId) return false;
  try {
    const { Desktop } = await import('@wxcc-desktop/sdk');
    await Desktop.agentContact.vteamTransfer({ interactionId, data: { vteamId, vteamType } });
    console.log('[settings] requeueTask: transferred', interactionId, '→', vteamId);
    if (wrapUp?.auxCodeId) {
      await autoSubmitWrapup(Desktop, interactionId, wrapUp);
    }
    return true;
  } catch (err) {
    console.error('[settings] requeueTask failed:', err?.message);
    return false;
  }
};

/**
 * Provision the SLA catalog (idle codes + email queues) into localStorage so the
 * headless watcher (crm-sync-header.js) can relay them to the CRM Tab Manager,
 * where the focus-mode settings are configured. The watcher can't reliably read
 * these from the raw AGENTX_SERVICE, so the React widget — which has the proven
 * SDK accessors — writes them to a shared, same-origin key. Never throws.
 */
export const provisionSlaCatalog = () => async (dispatch, getState) => {
  try {
    const { Desktop } = await import('@wxcc-desktop/sdk');
    const info = Desktop?.agentStateInfo?.latestData || {};
    // Exclude SYSTEM aux codes (e.g. Calling_Restriction, RONA) — agents cannot
    // set those manually; a state change to a system code fails with
    // "Internal System Error". Keep isDefault so the watcher can fall back to it.
    const rawIdle = info.idleCodes || [];
    const idleCodes = rawIdle
      .filter((c) => !c.isSystem)
      .map((c) => ({ id: c.id, name: c.name, isDefault: !!c.isDefault }));
    const wrapUpCodes = (info.wrapupCodes || [])
      .filter((c) => !c.isSystem)
      .map((c) => ({ id: c.id, name: c.name }));

    const w = getState().widget;
    let queues = [];
    try {
      const data = {
        agentProfileId: w.agent?.agentProfileId || info.agentProfileID || '',
        agentSessionId: info.agentSessionId || '',
        channelType: 'email',
        type: 'inboundqueue',
      };
      const res = await Desktop.agentContact.vteamList({ data });
      const raw = res?.data?.data?.vteamList || res?.data?.vteamList || res?.vteamList || [];
      queues = raw.map((v) => ({ id: v.id, name: v.name, type: v.type || 'inboundqueue' }));
      // Diagnostic: the list is exactly what vteamList returns for this agent.
      // If an existing same-channel queue is missing here, it was excluded
      // server-side (agent-profile transfer scope / queue mapping), not by us.
      console.log('[settings] provisionSlaCatalog: vteamList returned', raw.length,
        'email queue(s):', raw.map((v) => v.name).join(', ') || '(none)',
        '| allowConsultToQueue=', res?.data?.data?.allowConsultToQueue);
    } catch (e) {
      console.warn('[settings] provisionSlaCatalog: queue fetch failed:', e?.message);
    }

    // Merge in ALL email queues from the Config API so transfer-only queues
    // (not wired to an entry point, hence absent from vteamList) still appear.
    const cfgQueues = await fetchConfigQueues('email', {
      accessToken: w.accesstoken, orgId: w.orgid, datacenter: w.datacenter,
    });
    queues = mergeQueues(cfgQueues, queues);
    console.log('[settings] provisionSlaCatalog: config email queues', cfgQueues.length,
      '→ merged total', queues.length);

    const agentId = w.agent?.agentId || w.agent?.agentDbId || 'default';
    try {
      localStorage.setItem(`wx_c360_catalog_${agentId}`, JSON.stringify({ idleCodes, queues, wrapUpCodes }));
    } catch { /* quota/denied */ }
    console.log('[settings] provisioned SLA catalog:', idleCodes.length, 'idle codes (',
      (rawIdle.length - idleCodes.length), 'system excluded),', queues.length, 'queues,', wrapUpCodes.length, 'wrap-up codes');
  } catch (err) {
    console.warn('[settings] provisionSlaCatalog failed:', err?.message);
  }
};

/**
 * Change the agent's availability state on behalf of the headless focus-mode
 * watcher (crm-sync-header.js). The watcher can't reliably reach the routing
 * service from a third-party header widget, so it delegates here where the fully
 * initialized Desktop SDK is available. Returns {ok, error}. Never throws.
 *   state: 'Idle' (Not Available) | 'Available'
 *   auxCodeId: idle reason code id (required for Idle; '0' for Available)
 */
export const applyAgentState = ({ state, auxCodeId, channelType } = {}) => async () => {
  const auxId = String(auxCodeId != null && auxCodeId !== '' ? auxCodeId : '0');
  const SDK_SAFE = ['telephony', 'chat', 'email', 'social'];
  const channels = (Array.isArray(channelType) && channelType.length) ? channelType : SDK_SAFE;
  // Orgs with granular (per-channel) state control reject the v1 global
  // stateChange with "Internal System Error" — they require the channel-based
  // stateChangeV2 (PUT /v2/agents/session/state).
  // 1) Prefer the RAW service so all channel types are honoured (the bundled
  //    SDK 2.0.15 only validates telephony/chat/email/social; workItem and
  //    customMessaging are rejected by the jsapi wrapper but accepted by the
  //    backend).
  try {
    const svc = (typeof window !== 'undefined') ? window.AGENTX_SERVICE : null;
    const agent = svc && svc.isInited && svc.aqm && svc.aqm.agent;
    if (agent && typeof agent.stateChangeV2 === 'function') {
      await agent.stateChangeV2({ data: { state, auxCodeId: auxId, channelType: channels } });
      console.log('[settings] agent state changed →', state, '(v2-raw,', channels.join('+') + ')');
      return { ok: true, via: 'v2-raw' };
    }
  } catch (eRaw) {
    const mR = eRaw?.message || (() => { try { return JSON.stringify(eRaw); } catch { return String(eRaw); } })();
    console.warn('[settings] stateChangeV2 (raw) failed →', state, '|', mR);
  }
  // 2) SDK jsapi stateChangeV2 (channels limited to the 4 it validates).
  try {
    const { Desktop } = await import('@wxcc-desktop/sdk');
    const safe = channels.filter((c) => SDK_SAFE.includes(c));
    await Desktop.agentStateInfo.stateChangeV2({
      state, auxCodeId: auxId, channelType: safe.length ? safe : SDK_SAFE,
    });
    console.log('[settings] agent state changed →', state, '(v2,', (safe.length ? safe : SDK_SAFE).join('+') + ')');
    return { ok: true, via: 'v2' };
  } catch (e2) {
    // 3) v1 global fallback for non-granular orgs.
    try {
      const { Desktop } = await import('@wxcc-desktop/sdk');
      await Desktop.agentStateInfo.stateChange({ state, auxCodeIdArray: auxId });
      console.log('[settings] agent state changed →', state, '(v1)');
      return { ok: true, via: 'v1' };
    } catch (e1) {
      const msg = e1?.message || (() => { try { return JSON.stringify(e1); } catch { return String(e1); } })();
      console.warn('[settings] agent stateChange failed →', state, '|', msg, e1);
      return { ok: false, error: msg };
    }
  }
};

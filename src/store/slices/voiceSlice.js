import { createSlice } from '@reduxjs/toolkit';
import { fetchVoiceTranscript, fetchVoiceSummary, fetchVoiceCaptureList, fetchCustomerVoiceCalls } from '../../api';
import { persistTaskSummaryToJds, pickStoredSummaryForTask } from './emailSlice';

/**
 * Live voice-transcript state, keyed by taskId. Populated on demand from the
 * backend Captures proxy when the VoiceWidget shows a call in live mode.
 * Demo mode never touches this slice (VoiceWidget uses mock data directly).
 */
const voiceSlice = createSlice({
  name: 'voice',
  initialState: {
    transcripts: {},   // taskId → { transcript, recording, source, durationSec, languageCode }
    status: {},        // taskId → 'loading' | 'loaded' | 'empty' | 'error'
    summaries: {},     // taskId → AI post-call summary (fetched independently)
    summaryStatus: {}, // taskId → 'loading' | 'loaded' | 'empty' | 'error'
    captureList: {},   // taskId → { durationSec, startTime, hasTranscript, hasRecording, languageCode }
    customerCalls: [], // ordered [{ taskId, durationSec, startTime, direction, origin, hasTranscript, ... }] from Search API
    customerCallsStatus: 'idle', // 'idle' | 'loading' | 'loaded'
  },
  reducers: {
    setTranscriptStatus: (state, action) => {
      const { taskId, status } = action.payload;
      if (taskId) state.status[taskId] = status;
    },
    setTranscript: (state, action) => {
      const { taskId, data } = action.payload;
      if (!taskId) return;
      state.transcripts[taskId] = data;
      state.status[taskId] = data?.transcript?.length ? 'loaded' : 'empty';
    },
    setSummaryStatus: (state, action) => {
      const { taskId, status } = action.payload;
      if (taskId) state.summaryStatus[taskId] = status;
    },
    setSummary: (state, action) => {
      const { taskId, summary } = action.payload;
      if (!taskId) return;
      state.summaries[taskId] = summary || null;
      state.summaryStatus[taskId] = summary ? 'loaded' : 'empty';
    },
    setCaptureList: (state, action) => {
      const list = Array.isArray(action.payload) ? action.payload : [];
      list.forEach((entry) => {
        if (entry?.taskId) state.captureList[entry.taskId] = entry;
      });
    },
    setCustomerCalls: (state, action) => {
      state.customerCalls = Array.isArray(action.payload) ? action.payload : [];
      state.customerCallsStatus = 'loaded';
    },
    setCustomerCallsStatus: (state, action) => {
      state.customerCallsStatus = action.payload;
    },
  },
});

export const { setTranscriptStatus, setTranscript, setSummaryStatus, setSummary, setCaptureList, setCustomerCalls, setCustomerCallsStatus } = voiceSlice.actions;

/** Resolve the backend proxy config from widget state. */
const resolveConfig = (widget) => ({
  transcriptUrl: widget.widgetConfig?.transcriptUrl,
  desktopToken: widget.accesstoken,
  orgId: widget.orgid,
  datacenter: widget.datacenter,
});

/**
 * Fetch the real voice transcript for a task via the backend proxy.
 * No-ops when transcriptUrl is unconfigured or the transcript is already loaded.
 */
export const fetchLiveVoiceTranscript = (taskId, { force = false } = {}) => async (dispatch, getState) => {
  if (!taskId) return;
  const { widget, voice } = getState();
  if (voice.status[taskId] === 'loading') return;
  if (!force && voice.transcripts[taskId]) return;

  const { transcriptUrl, desktopToken, orgId, datacenter } = resolveConfig(widget);
  if (!transcriptUrl || !desktopToken || !orgId) return;

  dispatch(setTranscriptStatus({ taskId, status: 'loading' }));
  try {
    const data = await fetchVoiceTranscript(transcriptUrl, desktopToken, orgId, taskId, datacenter);
    if (data) {
      dispatch(setTranscript({ taskId, data }));
    } else {
      dispatch(setTranscriptStatus({ taskId, status: 'error' }));
    }
  } catch (err) {
    console.error('[voiceSlice] transcript fetch failed:', err);
    dispatch(setTranscriptStatus({ taskId, status: 'error' }));
  }
};

/**
 * Fetch the AI post-call summary independently of the transcript, so it renders
 * as soon as it is ready (a new call's transcript can take a while).
 */
export const fetchVoiceSummaryFor = (taskId, { force = false } = {}) => async (dispatch, getState) => {
  if (!taskId) return;
  const { widget, voice, email } = getState();
  if (voice.summaryStatus[taskId] === 'loading') return;
  if (!force && voice.summaries[taskId] !== undefined && voice.summaryStatus[taskId]) return;

  // Durable source first: a summary we persisted to JDS survives the short
  // AI-assistant summary/list retention window (~1-2 days).
  const stored = pickStoredSummaryForTask(email.customerHistory || [], taskId);
  if (stored) {
    dispatch(setSummary({ taskId, summary: stored }));
    return;
  }

  const { desktopToken, orgId, datacenter } = resolveConfig(widget);
  if (!desktopToken || !orgId) return;

  dispatch(setSummaryStatus({ taskId, status: 'loading' }));
  try {
    const summary = await fetchVoiceSummary(desktopToken, orgId, taskId, datacenter);
    dispatch(setSummary({ taskId, summary }));
    // Persist while fresh so it stays available after the endpoint retention lapses.
    if (summary) {
      const call = (voice.customerCalls || []).find((c) => c.taskId === taskId);
      const identity = call?.origin || (email.customerIdentities || [])[0] || email.customerEmail || null;
      if (identity) dispatch(persistTaskSummaryToJds(taskId, summary, identity));
    }
  } catch (err) {
    console.error('[voiceSlice] summary fetch failed:', err);
    dispatch(setSummaryStatus({ taskId, status: 'error' }));
  }
};

/**
 * Fetch capture metadata (duration + transcript availability) for a batch of
 * voice tasks — builds the real call list without downloading transcript files.
 */
export const fetchVoiceCaptures = (taskIds) => async (dispatch, getState) => {
  const ids = (taskIds || []).filter(Boolean);
  if (ids.length === 0) return;
  const { transcriptUrl, desktopToken, orgId, datacenter } = resolveConfig(getState().widget);
  if (!transcriptUrl || !desktopToken || !orgId) return;

  try {
    const list = await fetchVoiceCaptureList(transcriptUrl, desktopToken, orgId, ids, datacenter);
    if (list.length) dispatch(setCaptureList(list));
  } catch (err) {
    console.error('[voiceSlice] capture list fetch failed:', err);
  }
};

/**
 * List the customer's voice calls by phone number(s) via the Search API proxy.
 * This is the authoritative call list (JDS omits some voice interactions).
 */
export const fetchVoiceCallsForCustomer = (phones) => async (dispatch, getState) => {
  const list = (phones || []).filter(Boolean);
  if (list.length === 0) return;
  const { desktopToken, orgId, datacenter } = resolveConfig(getState().widget);
  if (!desktopToken || !orgId) return;

  dispatch(setCustomerCallsStatus('loading'));
  try {
    const calls = await fetchCustomerVoiceCalls(desktopToken, orgId, list, datacenter);
    dispatch(setCustomerCalls(calls));
  } catch (err) {
    console.error('[voiceSlice] customer voice calls fetch failed:', err);
    dispatch(setCustomerCallsStatus('idle'));
  }
};

export default voiceSlice.reducer;

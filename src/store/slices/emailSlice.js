import { createSlice, createSelector } from '@reduxjs/toolkit';
import { getMockData } from '../../mock/mockData';
import {
  subscribeToCustomerEvents,
  fetchGmailToken as apiFetchGmailToken,
  fetchEmailThread as apiFetchEmailThread,
  fetchEmailThreadMetadata as apiFetchEmailThreadMetadata,
  fetchEmailMessage as apiFetchEmailMessage,
  fetchCustomerEmailThreads as apiFetchCustomerEmailThreads,
  findGmailThreadByRfcMessageId as apiFindGmailThreadByRfcMessageId,
  sendEmailViaGmail as apiSendEmailViaGmail,
  pollGmailThreadHistory as apiPollGmailThreadHistory,
  createGmailDraft as apiCreateGmailDraft,
  updateGmailDraft as apiUpdateGmailDraft,
  deleteGmailDraft as apiDeleteGmailDraft,
  findGmailDraftForThread as apiFindGmailDraftForThread,
  fetchGmailDraftList as apiFetchGmailDraftList,
  publishCloudEvent,
  fetchJourneyEvents,
  getTaskSummary,
  searchCustomerByIdentity,
  fetchExperienceConfig,
} from '../../api';
import { createAiProvider } from '../../ai/aiProvider';
import { setManualCustomerData, clearCaseWorkflow, setEmailConfig } from './widgetSlice';

// Non-serializable refs stored outside Redux (per State Serialization Discipline)
let emailSseUnsubscribe = null;
// Per-interactionId in-flight guard — prevents duplicate concurrent initEmailTask calls
// (e.g. two widget instances mounting simultaneously both bypass the idempotency guard
// before either has loaded the thread into Redux state).
const initInFlight = new Set();

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Normalise a CAD risk value that may be delivered as a boolean, string, or number.
 * Treats only explicit "true"/1/"1"/"yes" as risky; everything else (including the
 * string "false" and null/undefined) is treated as not risky.
 */
export const parseRiskValue = (raw) => {
  if (typeof raw === 'boolean') return raw;
  if (raw == null) return false;
  const s = String(raw).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
};

const generateCorrelationId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

// Empty draft cache entry shape. Kept as a factory so every thread starts
// with a stable initial object if not already cached.
const emptyThreadDraft = () => ({
  aiReplyDraft: '',
  gmailDraftId: null,
  draftSync: { status: null, savedAt: null, resumed: false },
  aiProofreadResult: null,
  emailTouched: false,
  lastSentReply: null,
  pendingComposerInsert: null,
});

/**
 * Snapshot / restore helper for per-thread draft state.
 *
 * Why: within a single interaction the agent may browse several email threads
 * from the left panel.  The scalar `aiReplyDraft` / `gmailDraftId` / `draftSync`
 * fields were global, so the same in-progress draft was shown on every thread.
 *
 * Strategy:
 *   - We keep a serializable map `draftsByThreadId` keyed by Gmail threadId.
 *   - When the activeEmail (reply target) changes to a different threadId,
 *     `swapThreadDraftContext` stashes the OLD thread's draft into the map
 *     and restores the NEW thread's draft to the scalar working fields.
 *   - The composer and thunks continue to read/write the scalar fields, so no
 *     component needs to know about the map.
 *   - On task switch / full reset the map is cleared.
 */
const getThreadDraft = (state, threadId) =>
  (threadId && state.draftsByThreadId?.[threadId]) || emptyThreadDraft();

const setThreadDraft = (state, threadId, patch) => {
  if (!threadId) return;
  const base = state.draftsByThreadId?.[threadId] || emptyThreadDraft();
  state.draftsByThreadId[threadId] = { ...base, ...patch };
};

const swapThreadDraftContext = (state, nextThreadId) => {
  const prevThreadId = state.activeEmail?.threadId || null;
  if (prevThreadId === nextThreadId) return;

  // Stash the outgoing thread's working draft fields
  if (prevThreadId) {
    setThreadDraft(state, prevThreadId, {
      aiReplyDraft: state.aiReplyDraft,
      gmailDraftId: state.gmailDraftId,
      draftSync: state.draftSync,
      aiProofreadResult: state.aiProofreadResult,
      emailTouched: state.emailTouched,
      lastSentReply: state.lastSentReply,
      pendingComposerInsert: state.pendingComposerInsert,
    });
  }

  // Restore the incoming thread's draft, or blank defaults
  const next = getThreadDraft(state, nextThreadId);
  state.aiReplyDraft = next.aiReplyDraft;
  state.gmailDraftId = next.gmailDraftId;
  state.draftSync = next.draftSync;
  state.aiProofreadResult = next.aiProofreadResult;
  state.emailTouched = next.emailTouched;
  state.lastSentReply = next.lastSentReply;
  state.pendingComposerInsert = next.pendingComposerInsert ?? null;

  // Ensure the incoming thread has a cache row (important for setters that run
  // immediately afterwards, and for threads with blank defaults).
  if (nextThreadId && !state.draftsByThreadId[nextThreadId]) {
    state.draftsByThreadId[nextThreadId] = emptyThreadDraft();
  }
};

/**
 * Decode RFC 2047 MIME encoded-words (=?charset?B/Q?text?=) in email headers.
 * Gmail API with format=full returns raw MIME headers which may contain these.
 * Safe to call on already-decoded strings — no-op when no =? tokens are present.
 */
export const decodeMimeHeader = (str) => {
  if (!str || !str.includes('=?')) return str;
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (match, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
        return new TextDecoder(charset).decode(bytes);
      }
      // Q encoding: _ → space, =XX → byte
      const raw = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16))
      );
      const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      return new TextDecoder(charset).decode(bytes);
    } catch {
      return match;
    }
  });
};

export const decodeBase64Url = (data) => {
  if (!data) return '';
  try {
    return decodeURIComponent(
      atob(data.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    try {
      return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }
};

const extractBodyParts = (payload) => {
  const result = { html: '', text: '', attachments: [] };
  if (!payload) return result;

  const visit = (part) => {
    const mimeType = (part.mimeType || '').toLowerCase();
    if (mimeType === 'text/html' && part.body?.data) {
      result.html = decodeBase64Url(part.body.data);
    } else if (mimeType === 'text/plain' && part.body?.data && !result.text) {
      result.text = decodeBase64Url(part.body.data);
    } else if (part.body?.attachmentId) {
      result.attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename || '',
        mimeType,
        size: part.body.size || 0,
      });
    }
    if (Array.isArray(part.parts)) {
      part.parts.forEach(visit);
    }
  };

  visit(payload);
  return result;
};

export const parseGmailMessage = (msg) => {
  if (!msg) return null;
  const headers = msg.payload?.headers || [];
  const getHeader = (name) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const bodyParts = extractBodyParts(msg.payload);

  return {
    messageId: msg.id,
    threadId: msg.threadId,
    labelIds: msg.labelIds || [],
    from: decodeMimeHeader(getHeader('From')),
    to: decodeMimeHeader(getHeader('To')),
    cc: decodeMimeHeader(getHeader('Cc')),
    subject: decodeMimeHeader(getHeader('Subject')),
    date: getHeader('Date'),
    // RFC 822 Message-ID header — the id JDS ai-summary events are keyed by, so
    // per-thread summaries can be matched when browsing historical threads.
    rfcMessageId: (getHeader('Message-ID') || getHeader('Message-Id')).trim(),
    inReplyTo: getHeader('In-Reply-To'),
    references: getHeader('References'),
    snippet: msg.snippet || '',
    bodyHtml: bodyParts.html,
    bodyText: bodyParts.text,
    attachments: bodyParts.attachments,
  };
};

// ─── Slice ──────────────────────────────────────────────────────────────────

const initialState = {
  gmailToken: { value: null, expiresAt: null },
  geminiToken: { value: null, expiresAt: null },
  activeEmail: null,
  activeInteractionId: null,
  customerEmail: null,          // customer email address for the active task
  resolvedThreadId: null,   // cached Gmail threadId to skip repeated searches on tab re-visits
  interactionThreadId: null, // Gmail threadId tied to the current interaction (for jump-back marker)
  gmailDraftId: null,       // Gmail draft id for the active thread (agent-to-agent handoff)
  draftSync: { status: null, savedAt: null, resumed: false }, // status: null|saving|saved|error
  lastSentReply: null,      // plain-text of the last reply sent (input for the wrap-up summary)
  wrapUpSummary: { text: '', sections: null, status: 'idle' }, // status: idle|generating|ready|error
  lastHistoryId: null,      // Gmail historyId from last thread fetch — used for update polling
  thread: [],
  customerThreads: [],
  customerHistory: [],
  // JDS history pagination/time-window meta (JDS gives no total count).
  customerHistoryMeta: { count: 0, hasMore: false, maxPages: 5, identities: [], oldestTs: null, newestTs: null, loading: false },
  customerIdentities: [],    // All known identity values for the current customer (phone + email + JDS aliases)
  customerProfile: null,     // Normalised JDS person record { id, name, firstName, lastName, email, phone } for the active task
  interactionSummaries: {}, // { [taskId]: { initialContactReason, keyActionsTaken, nextSteps, ... } }
  aiEnrichment: null,
  aiReplyDraft: '',
  pendingComposerInsert: null, // { html, nonce } — one-shot payload the composer inserts at the cursor
  templates: [],
  signatures: [],
  activeSignatureId: null,
  aiProofreadResult: null,     // { correctedHtml, answersOriginal, coverageSummary, missingPoints[], suggestedAdditions[], issues: [{type, original, suggestion}] }
  isCorrectingGrammar: false,
  knowledgeSources: [],        // citations from grounded reply
  pendingCorrelationId: null,
  isFetchingToken: false,
  isFetchingEmail: false,
  isSending: false,
  isFetchingAiDraft: false,
  sendResult: null,
  wrapUp: { submitted: false, reason: '', notes: '' },
  error: null,
  slaExpiresAt: null,       // SLA expiry (epoch ms) for the active email task; null = unknown
  emailTouched: false,      // agent has started working on this task (drafted a reply)
  // CAD-driven risk flag (e.g. Jmartan_Riziko boolean). Independent from JDS AI risk.
  cadRiskDetected: false,
  // True when the CAD layer is currently providing a Jmartan_Riziko value,
  // even if that value is explicitly false. Used by the UI to prefer CAD over
  // JDS-derived risk; when CAD is not available, JDS becomes the fallback.
  cadRiskAvailable: false,
  // Navigation-panel live customer lookup (search by email/phone, no active task).
  manualSearch: { status: 'idle', identity: null }, // status: idle|searching|found|notfound|error
  // Per-thread composer draft cache so that switching threads within the same
  // interaction does not show the same draft on every thread.
  draftsByThreadId: {},
};

const emailSlice = createSlice({
  name: 'email',
  initialState,
  reducers: {
    setGmailToken: (state, action) => {
      state.gmailToken = action.payload;
    },
    setGeminiToken: (state, action) => {
      state.geminiToken = action.payload;
    },
    setActiveEmail: (state, action) => {
      const next = action.payload;
      const nextThreadId = next?.threadId || null;
      swapThreadDraftContext(state, nextThreadId);
      state.activeEmail = next;
    },
    setActiveInteractionId: (state, action) => {
      state.activeInteractionId = action.payload;
    },
    setResolvedThreadId: (state, action) => {
      state.resolvedThreadId = action.payload;
    },
    setInteractionThreadId: (state, action) => {
      state.interactionThreadId = action.payload;
    },
    setGmailDraftId: (state, action) => {
      state.gmailDraftId = action.payload;
      const threadId = state.activeEmail?.threadId;
      setThreadDraft(state, threadId, { gmailDraftId: action.payload });
      // Mirror the draft flag into the visible thread list metadata so the
      // pill appears (or disappears) without requiring a separate thread reload.
      if (threadId) {
        const idx = state.customerThreads.findIndex((t) => t.threadId === threadId);
        if (idx >= 0) {
          state.customerThreads[idx] = { ...state.customerThreads[idx], hasDraft: Boolean(action.payload) };
        }
      }
    },
    setDraftSync: (state, action) => {
      const next = { ...state.draftSync, ...action.payload };
      state.draftSync = next;
      const threadId = state.activeEmail?.threadId;
      setThreadDraft(state, threadId, { draftSync: next });
      // Mirror the draft flag into the visible thread list metadata so the
      // active (or any selected) thread shows the draft pill immediately.
      if (threadId) {
        const hasDraft = next.status === 'saved' || next.status === 'saving' || next.resumed;
        const idx = state.customerThreads.findIndex((t) => t.threadId === threadId);
        if (idx >= 0) {
          state.customerThreads[idx] = { ...state.customerThreads[idx], hasDraft };
        }
      }
    },
    setLastSentReply: (state, action) => {
      state.lastSentReply = action.payload;
      setThreadDraft(state, state.activeEmail?.threadId, { lastSentReply: action.payload });
    },
    setWrapUpSummary: (state, action) => {
      state.wrapUpSummary = { ...state.wrapUpSummary, ...action.payload };
    },
    setLastHistoryId: (state, action) => {
      state.lastHistoryId = action.payload;
    },
    setCustomerEmail: (state, action) => {
      state.customerEmail = action.payload;
    },
    setThread: (state, action) => {
      state.thread = action.payload;
    },
    appendThreadMessages: (state, action) => {
      const incoming = action.payload || [];
      if (!Array.isArray(incoming) || incoming.length === 0) return;
      const existingIds = new Set(state.thread.map((m) => m.messageId));
      const newMessages = incoming.filter((m) => m?.messageId && !existingIds.has(m.messageId));
      if (newMessages.length === 0) return;
      state.thread = [...state.thread, ...newMessages].sort(
        (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
      );
    },
    setCustomerThreads: (state, action) => {
      state.customerThreads = action.payload;
    },
    setCustomerHistory: (state, action) => {
      state.customerHistory = action.payload;
    },
    setCustomerHistoryMeta: (state, action) => {
      state.customerHistoryMeta = { ...state.customerHistoryMeta, ...(action.payload || {}) };
    },
    setCustomerIdentities: (state, action) => {
      state.customerIdentities = action.payload;
    },
    setCustomerProfile: (state, action) => {
      state.customerProfile = action.payload;
    },
    appendCustomerHistoryEvent: (state, action) => {
      // Prepend so newest events appear first (HistoryView sorts desc by ts).
      const incoming = action.payload;
      if (!incoming?.id) return;
      // Dedup on id+type+timestamp, NOT id alone: the new JDS format shares ONE
      // CloudEvent id across an interaction's whole lifecycle, so an id-only
      // guard would drop every SSE event after the first — collapsing the
      // interaction to a single-event fragment that renders as a raw row.
      const keyOf = (e) => `${e.id}|${e.type || ''}|${e.timestamp || e.createdAt || e.eventTime || ''}`;
      const incomingKey = keyOf(incoming);
      const alreadyPresent = state.customerHistory.some((e) => keyOf(e) === incomingKey);
      if (!alreadyPresent) {
        state.customerHistory = [incoming, ...state.customerHistory];
      }
    },
    setInteractionSummary: (state, action) => {
      const { taskId, summary } = action.payload;
      state.interactionSummaries[taskId] = summary;
    },
    setAiEnrichment: (state, action) => {
      state.aiEnrichment = action.payload;
    },
    setAiReplyDraft: (state, action) => {
      state.aiReplyDraft = action.payload;
      let touched = state.emailTouched;
      // Latch "touched" once the agent has actual reply text — drives the
      // New/Draft indicator and suppresses SLA auto-requeue.
      if (String(action.payload || '').replace(/<[^>]+>/g, '').trim()) {
        state.emailTouched = true;
        touched = true;
      }
      setThreadDraft(state, state.activeEmail?.threadId, {
        aiReplyDraft: action.payload,
        emailTouched: touched,
      });
    },
    setPendingComposerInsert: (state, action) => {
      // action.payload is the HTML/text to insert at the composer cursor, or null to clear.
      const next = action.payload
        ? { html: action.payload, nonce: Date.now() }
        : null;
      state.pendingComposerInsert = next;
      // One-shot insert payload is thread-scoped so it survives context swaps.
      setThreadDraft(state, state.activeEmail?.threadId, { pendingComposerInsert: next });
    },
    setTemplates: (state, action) => {
      state.templates = action.payload;
    },
    setSignatures: (state, action) => {
      state.signatures = action.payload;
    },
    setActiveSignatureId: (state, action) => {
      state.activeSignatureId = action.payload;
    },
    setAiProofreadResult: (state, action) => {
      state.aiProofreadResult = action.payload;
      setThreadDraft(state, state.activeEmail?.threadId, { aiProofreadResult: action.payload });
    },
    setIsCorrectingGrammar: (state, action) => {
      state.isCorrectingGrammar = action.payload;
    },
    setKnowledgeSources: (state, action) => {
      state.knowledgeSources = action.payload;
    },
    setDraftsByThreadId: (state, action) => {
      state.draftsByThreadId = action.payload || {};
    },
    setThreadDraftCache: (state, action) => {
      const { threadId, patch } = action.payload || {};
      if (!threadId) return;
      const base = state.draftsByThreadId?.[threadId] || emptyThreadDraft();
      state.draftsByThreadId[threadId] = { ...base, ...patch };
    },
    setPendingCorrelationId: (state, action) => {
      state.pendingCorrelationId = action.payload;
    },
    clearPendingCorrelationId: (state) => {
      state.pendingCorrelationId = null;
    },
    setIsFetchingToken: (state, action) => {
      state.isFetchingToken = action.payload;
    },
    setIsFetchingEmail: (state, action) => {
      state.isFetchingEmail = action.payload;
    },
    setIsSending: (state, action) => {
      state.isSending = action.payload;
    },
    setSendResult: (state, action) => {
      state.sendResult = action.payload;
    },
    setIsFetchingAiDraft: (state, action) => {
      state.isFetchingAiDraft = action.payload;
    },
    setWrapUp: (state, action) => {
      state.wrapUp = { ...state.wrapUp, ...action.payload };
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    setCadRiskDetected: (state, action) => {
      // Payload can be a plain boolean (legacy) or { detected, available }.
      // A missing availability flag defaults to true when a non-null object is
      // provided, and to false for legacy boolean payloads.
      const payload = action.payload;
      if (payload && typeof payload === 'object' && 'detected' in payload) {
        state.cadRiskDetected = Boolean(payload.detected);
        state.cadRiskAvailable = 'available' in payload ? Boolean(payload.available) : true;
      } else {
        state.cadRiskDetected = Boolean(payload);
        state.cadRiskAvailable = payload != null;
      }
    },
    setSlaExpiresAt: (state, action) => {
      state.slaExpiresAt = action.payload;
    },
    setEmailTouched: (state, action) => {
      const next = Boolean(action.payload);
      state.emailTouched = next;
      const threadId = state.activeEmail?.threadId;
      setThreadDraft(state, threadId, { emailTouched: next });
      // Any touched composer counts as a draft for the thread list badge.
      if (threadId && next) {
        const idx = state.customerThreads.findIndex((t) => t.threadId === threadId);
        if (idx >= 0) {
          state.customerThreads[idx] = { ...state.customerThreads[idx], hasDraft: true };
        }
      }
    },
    setManualSearch: (state, action) => {
      state.manualSearch = {
        status: action.payload?.status || 'idle',
        identity: action.payload?.identity ?? null,
      };
    },
    resetEmail: () => ({ ...initialState }),
    resetEmailContent: (state) => {
      // Preserves everything that was loaded for the current task so that
      // switching to another tab and back does NOT trigger a full reload:
      //   - customerHistory / interactionSummaries  → History tab
      //   - thread / activeEmail / aiEnrichment / customerThreads → Email reading pane
      //   - gmailToken / activeInteractionId / resolvedThreadId / lastHistoryId → Gmail state
      // Only volatile UI state (wrapUp, sending, errors) is reset.
      //
      // The per-thread draft cache is preserved across tab switches; because
      // activeEmail is also preserved, the current thread's draft remains in the
      // scalar working fields.  On a genuine interaction change, initEmailTask
      // clears the cache via resetEmail.
      return {
        ...initialState,
        gmailToken: state.gmailToken,
        geminiToken: state.geminiToken,
        activeInteractionId: state.activeInteractionId,
        customerEmail: state.customerEmail,
        resolvedThreadId: state.resolvedThreadId,
        interactionThreadId: state.interactionThreadId,
        lastHistoryId: state.lastHistoryId,
        thread: state.thread,
        activeEmail: state.activeEmail,
        aiEnrichment: state.aiEnrichment,
        customerThreads: state.customerThreads,
        customerHistory: state.customerHistory,
        customerIdentities: state.customerIdentities,
        customerProfile: state.customerProfile,
        interactionSummaries: state.interactionSummaries,
        // Preserve the SLA countdown across tab switches
        slaExpiresAt: state.slaExpiresAt,
        // Persist config-level lists across tab switches
        templates: state.templates,
        signatures: state.signatures,
        activeSignatureId: state.activeSignatureId,
        // Preserve the in-progress reply + its Gmail draft link across tab switches
        // (a genuine task switch clears these explicitly in initEmailTask).
        aiReplyDraft: state.aiReplyDraft,
        gmailDraftId: state.gmailDraftId,
        draftSync: state.draftSync,
        lastSentReply: state.lastSentReply,
        wrapUpSummary: state.wrapUpSummary,
        aiProofreadResult: state.aiProofreadResult,
        emailTouched: state.emailTouched,
        // Preserve CAD-driven risk flag across tab switches so the alert stays visible.
        cadRiskDetected: state.cadRiskDetected,
        cadRiskAvailable: state.cadRiskAvailable,
        // Preserve the whole per-thread draft cache
        draftsByThreadId: state.draftsByThreadId,
      };
    },
    setMockEmailData: (state, action) => {
      // payload can be a locale string (legacy) or { locale, taskId }
      const locale = typeof action.payload === 'string' ? action.payload : (action.payload?.locale || 'en');
      const taskId = (typeof action.payload === 'object' && action.payload !== null) ? action.payload?.taskId : null;
      const m = getMockData(locale);
      // Use per-taskId email data if available and non-null; otherwise fall back to default
      const emailData = (taskId && m.emails?.[taskId]) || m.email;
      state.activeEmail    = emailData.activeEmail;
      state.thread         = emailData.thread;
      state.aiEnrichment   = emailData.aiEnrichment;
      state.customerThreads = emailData.customerThreads;
      state.isFetchingToken = false;
      state.isFetchingEmail = false;
      state.error  = null;
      state.wrapUp = { submitted: false, reason: '', notes: '' };
      // Demo SLA countdown: ~8.5 minutes out so the timer is visible in mock mode.
      state.slaExpiresAt = Date.now() + Math.round(8.5 * 60 * 1000);
      // Reset working draft fields and the per-thread cache for a fresh mock task.
      state.aiReplyDraft   = '';
      state.gmailDraftId   = null;
      state.draftSync      = { status: null, savedAt: null, resumed: false };
      state.aiProofreadResult = null;
      state.emailTouched   = false;
      state.lastSentReply  = null;
      state.draftsByThreadId = {};
      // Load templates, signatures, KB from mock data (locale-aware)
      if (m.emailComposer) {
        state.templates  = m.emailComposer.templates  || [];
        state.signatures = m.emailComposer.signatures || [];
        state.activeSignatureId = m.emailComposer.defaultSignatureId || null;
      }
    },
    switchMockEmailThread: (state, action) => {
      // Demo-only thread switch: swap to another mock thread without wiping
      // the per-thread draft cache, so A→B→A restores the original draft.
      const { locale, taskId } = action.payload || {};
      const m = getMockData(locale || 'en');
      const emailData = (taskId && m.emails?.[taskId]) || m.email;
      const nextThreadId = emailData?.activeEmail?.threadId || null;
      swapThreadDraftContext(state, nextThreadId);
      state.activeEmail    = emailData.activeEmail || null;
      state.thread         = emailData.thread || [];
      state.aiEnrichment   = emailData.aiEnrichment || null;
      state.customerThreads = emailData.customerThreads || [];
      state.error          = null;
      state.isFetchingEmail = false;
    },
  },
});

export const {
  setGmailToken,
  setGeminiToken,
  setActiveEmail,
  setActiveInteractionId,
  setCustomerEmail,
  setResolvedThreadId,
  setInteractionThreadId,
  setGmailDraftId,
  setDraftSync,
  setLastSentReply,
  setWrapUpSummary,
  setLastHistoryId,
  setThread,
  appendThreadMessages,
  setCustomerThreads,
  setCustomerHistory,
  setCustomerHistoryMeta,
  appendCustomerHistoryEvent,
  setCustomerIdentities,
  setCustomerProfile,
  setAiEnrichment,
  setCadRiskDetected,
  setAiReplyDraft,
  setPendingComposerInsert,
  setTemplates,
  setSignatures,
  setActiveSignatureId,
  setAiProofreadResult,
  setIsCorrectingGrammar,
  setKnowledgeSources,
  setPendingCorrelationId,
  clearPendingCorrelationId,
  setIsFetchingToken,
  setIsFetchingEmail,
  setIsSending,
  setSendResult,
  setIsFetchingAiDraft,
  setWrapUp,
  setError,
  setSlaExpiresAt,
  setEmailTouched,
  setManualSearch,
  setDraftsByThreadId,
  setThreadDraftCache,
  resetEmail,
  resetEmailContent,
  setMockEmailData,
  switchMockEmailThread,
  setInteractionSummary,
} = emailSlice.actions;

export default emailSlice.reducer;

// ─── Thunks ─────────────────────────────────────────────────────────────────

/**
 * Set the SLA expiry for the active email task from its CAD value.
 * The SLA is delivered WITH the task (Agent-Viewable variable in CAD); the
 * variable name is configurable via widget.emailConfig.slaVariable and the CAD
 * value is unwrapped by the caller (UnifiedView360.buildEmailCallDetails).
 * Accepts epoch seconds or epoch-ms (string/number) or ISO-8601. Sets email.slaExpiresAt or null.
 */
export const loadEmailSla = (rawSlaValue) => (dispatch) => {
  if (rawSlaValue == null || rawSlaValue === '') {
    console.log('[SLA] no CAD value for the configured SLA variable — countdown hidden');
    dispatch(setSlaExpiresAt(null));
    return;
  }
  let ms = Number(rawSlaValue);
  if (Number.isFinite(ms)) {
    if (ms > 0 && ms < 1e12) ms *= 1000;                // epoch seconds → ms
  } else {
    ms = Date.parse(rawSlaValue);                        // ISO-8601 fallback
  }
  console.log('[SLA] raw=', rawSlaValue, '→ expiresAt(ms)=', ms);
  dispatch(setSlaExpiresAt(Number.isFinite(ms) && ms > 0 ? ms : null));
};

export const fetchGmailToken = () => async (dispatch, getState) => {
  const { widget } = getState();
  const { tokenBrokerUrl } = widget.emailConfig || {};

  if (!tokenBrokerUrl) {
    console.warn('[EmailSlice] tokenBrokerUrl not configured');
    return null;
  }

  dispatch(setIsFetchingToken(true));
  try {
    // The Webex CI access token is already stored in Redux state by the web
    // component's `accesstoken` property setter — no Desktop SDK call needed.
    const desktopToken = widget.accesstoken || null;

    if (!desktopToken) {
      console.warn('[EmailSlice] No access token in Redux state for Gmail token exchange');
      dispatch(setIsFetchingToken(false));
      return null;
    }

    console.log('[EmailSlice] Fetching Gmail token from broker:', tokenBrokerUrl);
    const result = await apiFetchGmailToken(tokenBrokerUrl, desktopToken);
    console.log('[EmailSlice] Token broker response:', result?.gmailToken ? `OK (expires ${new Date(result.expiresAt).toISOString()})` : `NO TOKEN: ${JSON.stringify(result)}`);
    if (result?.gmailToken) {
      const expiresAt = result.expiresAt || Date.now() + 55 * 60 * 1000;
      dispatch(setGmailToken({ value: result.gmailToken, expiresAt }));
      // Cache Gemini token if the broker returned one
      if (result.geminiToken) {
        dispatch(setGeminiToken({ value: result.geminiToken, expiresAt }));
      }
      return result.gmailToken;
    }
    console.warn('[EmailSlice] Token broker returned no gmailToken:', result);
    return null;
  } catch (err) {
    console.error('[EmailSlice] fetchGmailToken error:', err);
    dispatch(setError('email.error.tokenFetch'));
    return null;
  } finally {
    dispatch(setIsFetchingToken(false));
  }
};

const ensureGmailToken = () => async (dispatch, getState) => {
  const { email } = getState();
  const { value, expiresAt } = email.gmailToken;
  if (value && expiresAt && Date.now() < expiresAt - 60_000) return value;
  return dispatch(fetchGmailToken());
};

/**
 * Returns the cached Gemini Bearer token, refreshing via the token broker if
 * expired. The broker mints both Gmail and Gemini tokens together, so a refresh
 * here also renews the Gmail token as a side-effect.
 */
const ensureGeminiToken = () => async (dispatch, getState) => {
  const { email } = getState();
  const { value, expiresAt } = email.geminiToken;
  if (value && expiresAt && Date.now() < expiresAt - 60_000) return value;
  // fetchGmailToken fetches both tokens from the broker and caches both
  await dispatch(fetchGmailToken());
  return getState().email.geminiToken.value;
};

export const initEmailTask =
  (interactionId, callAssociatedDetails) => async (dispatch, getState) => {
    const prevState = getState().email;
    const prevId = prevState.activeInteractionId;

    // ── Idempotency guard ──────────────────────────────────────────────────
    // If the same task is already loaded (thread present), skip the full
    // re-initialization. This prevents repeated Gmail calls when the agent
    // switches tabs and comes back, and also guards against the effect
    // double-firing on initial mount.
    if (prevId === interactionId && prevState.thread.length > 0) {
      console.log('[EmailSlice] initEmailTask: task already loaded, skipping re-initialization', {
        interactionId,
        resolvedThreadId: prevState.resolvedThreadId,
        activeThreadId: prevState.activeEmail?.threadId,
        threadLength: prevState.thread.length,
        callAssociatedThreadId: callAssociatedDetails?.gmailThreadId || callAssociatedDetails?.threadId || null,
      });
      // Re-check AI summary if it's not loaded yet (handles the case where the JDS event
      // was written after the initial load, or a previous lookup missed due to wrong identity).
      if (!prevState.aiEnrichment) {
        const earlyCustomerEmail =
          callAssociatedDetails?.fromAddress ||
          callAssociatedDetails?.from ||
          callAssociatedDetails?.customerEmail ||
          null;
        if (earlyCustomerEmail) dispatch(fetchJdsAiSummary(earlyCustomerEmail));
      }
      return;
    }

    // In-flight guard: block concurrent calls for the same interactionId.
    // Without this, two widget instances can both pass the idempotency check above
    // simultaneously (neither has loaded the thread yet) and fire duplicate Gmail + JDS calls.
    if (initInFlight.has(interactionId)) {
      console.log('[EmailSlice] initEmailTask: already in progress for', interactionId);
      return;
    }
    initInFlight.add(interactionId);

    dispatch(setIsFetchingEmail(true));
    dispatch(setError(null));
    // Clear task-specific data when switching to a genuinely different interaction.
    if (prevId && prevId !== interactionId) {
      dispatch(setCustomerHistory([]));
      dispatch(setCustomerIdentities([]));
      dispatch(setCustomerProfile(null));
      dispatch(setCustomerThreads([]));
      dispatch(setThread([]));
      dispatch(setActiveEmail(null));
      dispatch(setAiEnrichment(null));
      dispatch(setCustomerEmail(null));
      dispatch(setResolvedThreadId(null));
      dispatch(setInteractionThreadId(null));
      dispatch(setLastHistoryId(null));
      // Reset transfer draft + wrap-up summary state for the new task.
      dispatch(setGmailDraftId(null));
      dispatch(setDraftSync({ status: null, savedAt: null, resumed: false }));
      dispatch(setLastSentReply(null));
      dispatch(setWrapUpSummary({ status: 'idle', text: '' }));
      dispatch(setAiReplyDraft(''));
      dispatch(setAiProofreadResult(null));
      dispatch(setEmailTouched(false));
      dispatch(setCadRiskDetected({ detected: false, available: false }));
      // Task switch: discard the per-thread draft cache from the previous task.
      // Mutating state inside a thunk is fine in Redux Toolkit because the slice
      // is written with Immer, but `state` here is a local ref so we assign via
      // the dispatch helpers to stay consistent.
      dispatch(setDraftsByThreadId({}));
    }
    dispatch(setActiveInteractionId(interactionId));

    // ── Load templates / signatures from config ───────────────────────────
    // Preferred source is the supervisor-managed Agent Experience repository
    // (team-filtered). It falls back to a remote URL or inline layout config.
    {
      const { emailConfig: cfg } = getState().widget;
      const applyFallback = () => {
        if (cfg.templatesUrl) {
          dispatch(fetchTemplatesFromUrl(cfg.templatesUrl));
        } else if (cfg.templates?.length) {
          dispatch(setTemplates(cfg.templates));
        }
        if (cfg.signaturesUrl) {
          dispatch(fetchSignaturesFromUrl(cfg.signaturesUrl, cfg.defaultSignatureId));
        } else if (cfg.signatures?.length) {
          dispatch(setSignatures(cfg.signatures));
          if (cfg.defaultSignatureId) dispatch(setActiveSignatureId(cfg.defaultSignatureId));
        }
      };
      if (cfg.experienceUrl) {
        // Team-filtered repository; fall back if it yields nothing.
        dispatch(loadTeamEmailAssets()).then((ok) => { if (!ok) applyFallback(); });
      } else {
        applyFallback();
      }
    }

    console.log('[EmailSlice] initEmailTask start:', {
      interactionId,
      fromAddress: callAssociatedDetails?.fromAddress,
      customerEmail: callAssociatedDetails?.customerEmail,
      subject: callAssociatedDetails?.subject,
      rfcMessageId: callAssociatedDetails?.rfcMessageId,
      gmailThreadId: callAssociatedDetails?.gmailThreadId,
    });

    // Seed AI enrichment from CAD vars immediately for instant display
    const cadSummary = callAssociatedDetails?.aiSummary || null;
    const cadCategory = callAssociatedDetails?.aiCategory || null;
    const cadSentiment = callAssociatedDetails?.aiSentiment || null;

    if (cadSummary || cadCategory) {
      dispatch(
        setAiEnrichment({
          summary: cadSummary,
          category: cadCategory,
          sentiment: cadSentiment,
          confidence: callAssociatedDetails?.aiConfidence || null,
          suggestedReply: callAssociatedDetails?.aiSuggestedReply || null,
          // CAD may also carry the risk flag. Default to false when absent.
          riskDetected: parseRiskValue(callAssociatedDetails?.riskDetected),
          source: 'cad',
        })
      );
    }

    // Seed CAD-driven risk flag immediately so the reading pane can highlight
    // the active message even before the poll sees a live task-map update.
    // The CAD variable may arrive as a string "true"/"false" or as a boolean.
    const rawRiskValue = callAssociatedDetails?.Jmartan_Riziko ?? callAssociatedDetails?.jmartan_riziko ?? null;
    const cadRiskAvailable = rawRiskValue != null && rawRiskValue !== '';
    const cadRiskValue = typeof rawRiskValue === 'boolean'
      ? rawRiskValue
      : String(rawRiskValue).toLowerCase() === 'true';
    dispatch(setCadRiskDetected({ detected: cadRiskValue, available: cadRiskAvailable }));

    // Prefer gmailThreadId (mapped by Webex Connect flow once configured),
    // fall back to legacy threadId field name, then Redux-cached resolvedThreadId.
    const threadId =
      callAssociatedDetails?.gmailThreadId ||
      callAssociatedDetails?.threadId ||
      getState().email.resolvedThreadId || // use cached value from previous load
      null;
    const customerEmail =
      callAssociatedDetails?.fromAddress ||
      callAssociatedDetails?.from ||
      callAssociatedDetails?.customerEmail ||
      null;
    // Store in Redux so fetchEmailThread can re-fetch the AI summary
    // when the user navigates back to the active task's thread.
    if (customerEmail) dispatch(setCustomerEmail(customerEmail));

    // ── JDS history + SSE: independent of Gmail availability ──────────────
    // Fetch customer history from Journey Data Service regardless of whether
    // Gmail is configured — this powers the History panel for any email task.
    const { widget } = getState();
    const { accesstoken, workspaceid, datacenter } = widget;

    // If history was already populated for this same interaction (e.g. by
    // loadJdsHistoryForWorkItemTask which runs before the Email tab opens),
    // skip the JDS re-fetch entirely so we don't overwrite richer multi-identity
    // history with a single-identity (phone-as-email) subset.
    const historyAlreadyLoaded =
      prevId === interactionId && getState().email.customerHistory.length > 0;

    if (!historyAlreadyLoaded && customerEmail && accesstoken && workspaceid) {
      // JDS person lookup — resolve the full customer profile (name, all emails/phones)
      // so the CustomerContactCard bar is populated for native email tasks too.
      // Fire-and-forget; skip if loadJdsHistoryForWorkItemTask already set it.
      if (!getState().email.customerProfile) {
        searchCustomerByIdentity(customerEmail, accesstoken, workspaceid, datacenter)
          .then((persons) => {
            // Staleness guard: discard if task switched while lookup was in-flight.
            if (persons.length > 0 && getState().email.activeInteractionId === interactionId)
              dispatch(setCustomerProfile(persons[0]));
          })
          .catch((err) => console.warn('[EmailSlice] initEmailTask: JDS person lookup failed', err));
      }
      // Use all known identities if already resolved (e.g. workItem task enriched
      // via JDS person API); fall back to the fromAddress for pure email tasks.
      const storedIdentities = getState().email.customerIdentities;
      const identities = storedIdentities.length > 0 ? storedIdentities : customerEmail;
      dispatch(fetchCustomerJdsHistory(identities, accesstoken, workspaceid, datacenter, undefined, interactionId));
    }

    // SSE: subscribe using the best primary identity (email preferred over phone).
    if (customerEmail && accesstoken && workspaceid) {
      const storedIdentities = getState().email.customerIdentities;
      const sseIdentity = storedIdentities.find(id => id.includes('@')) || customerEmail;
      if (emailSseUnsubscribe) {
        emailSseUnsubscribe();
      }
      emailSseUnsubscribe = subscribeToCustomerEvents(
        sseIdentity,
        accesstoken,
        workspaceid,
        datacenter,
        (event) => dispatch(handleSseEvent(event)),
        (err) => console.error('[EmailSlice] SSE error:', err)
      );
    }

    // ── Gmail thread loading (optional — may be unavailable) ──────────────
    const { emailConfig } = getState().widget;
    const token = await dispatch(ensureGmailToken());

    if (!token) {
      // Distinguish "not configured" from "token fetch failed" so the UI can
      // show a meaningful message instead of the generic "No email task."
      if (!emailConfig?.tokenBrokerUrl) {
        console.warn('[EmailSlice] Gmail integration not configured (tokenBrokerUrl missing)');
        dispatch(setError('email.error.notConfigured'));
      }
      dispatch(setIsFetchingEmail(false));
      initInFlight.delete(interactionId);
      return;
    }

    // Resolve the active thread ID. Priority:
    // Resolve the active thread ID. Priority:
    //   1. gmailThreadId from CAD (direct — requires Webex Connect flow to map it)
    //   2. rfcMessageId via rfc822msgid: Gmail search (exact, works once Webex Connect
    //      maps the Message-Id header as a CAD variable)
    //   3. customer thread list: fetch all threads for this customer, enrich
    //      metadata, and pick the newest matching thread. This is more reliable
    //      than a from:+subject: search, which returns matches in arbitrary order
    //      and can highlight an older thread while the real interaction thread is
    //      the newest one at the top of the list.
    let resolvedThreadId = threadId;
    if (!resolvedThreadId && customerEmail) {
      const rfcMessageId = callAssociatedDetails?.rfcMessageId || null;
      const subject = callAssociatedDetails?.subject || null;
      try {
        if (rfcMessageId) {
          console.log('[EmailSlice] Searching thread via rfc822msgid:', rfcMessageId);
          resolvedThreadId = await apiFindGmailThreadByRfcMessageId(rfcMessageId, token);
          console.log('[EmailSlice] rfc822msgid search result:', resolvedThreadId);
        }
        if (!resolvedThreadId) {
          console.log('[EmailSlice] Resolving active thread from customer thread list', {
            customerEmail,
            subject,
          });
          resolvedThreadId = await dispatch(
            resolveActiveThreadFromCustomerThreads(customerEmail, subject)
          );
          console.log('[EmailSlice] customer-thread resolution result:', resolvedThreadId);
        }
      } catch (err) {
        console.warn('[EmailSlice] Thread ID resolution failed:', err.message);
      }
    }

    console.log('[EmailSlice] Resolved threadId:', resolvedThreadId, '| customerEmail:', customerEmail);
    // Cache the resolved threadId so future tab re-visits skip the Gmail search.
    // Also remember it as the interaction-related thread for jump-back / highlighting.
    if (resolvedThreadId) {
      dispatch(setResolvedThreadId(resolvedThreadId));
      dispatch(setInteractionThreadId(resolvedThreadId));
    }

    // Load the active thread and the full thread list. We run them sequentially
    // here because, in the no-direct-threadId path, the customer thread list is
    // used to determine which thread is active. Once resolvedThreadId is known,
    // both loads can proceed.
    if (resolvedThreadId) {
      await dispatch(fetchEmailThread(resolvedThreadId));
    }
    if (customerEmail) {
      await dispatch(fetchCustomerThreads(customerEmail));
    }

    // ── Resume a Gmail draft left by a previous agent (task transfer) ──────
    if (resolvedThreadId) {
      dispatch(loadEmailDraftForThread(resolvedThreadId));
    }

    // ── Load cached AI summary from JDS ──────────────────────────────────
    // Use a targeted 1-page type query — DO NOT scan the full customerHistory
    // (which is still paginating in the background and would miss recent events).
    if (customerEmail) {
      dispatch(fetchJdsAiSummary(customerEmail));
    }

    dispatch(setIsFetchingEmail(false));
    initInFlight.delete(interactionId);
  };

/**
 * Demo-mode thread selection: find the mock email entry whose
 * activeEmail.threadId matches the given threadId and load it into state.
 */
export const fetchMockEmailThread = (threadId, locale) => (dispatch) => {
  const m = getMockData(locale || 'en');
  const allEntries = { default: m.email, ...(m.emails || {}) };
  const match = Object.entries(allEntries).find(
    ([, entry]) => entry?.activeEmail?.threadId === threadId
  );
  if (match) {
    const [taskId] = match;
    dispatch(switchMockEmailThread({ locale: locale || 'en', taskId: taskId === 'default' ? null : taskId }));
  }
};

export const fetchEmailThread = (threadId) => async (dispatch, getState) => {
  const token = await dispatch(ensureGmailToken());
  if (!token) return;

  console.log('[EmailSlice] fetchEmailThread start', {
    threadId,
    previousActiveThreadId: getState().email.activeEmail?.threadId,
    resolvedThreadId: getState().email.resolvedThreadId,
  });

  // When the user selects a historical thread from OtherThreadsList (a different
  // thread than the active interaction's thread), clear the AI summary — it was
  // loaded for the active task and is not relevant to the historical thread. The
  // per-thread summary is reloaded below (matched by the thread's RFC 822 ids).
  const { resolvedThreadId } = getState().email;
  const isHistoricalThread = Boolean(resolvedThreadId) && threadId !== resolvedThreadId;
  if (isHistoricalThread) {
    dispatch(setAiEnrichment(null));
  }

  try {
    const threadData = await apiFetchEmailThread(threadId, token);
    if (!threadData) return;

    // Exclude Gmail DRAFT messages from the conversation: the agent's in-progress
    // reply (e.g. handed off on transfer) belongs in the composer, not as a
    // message row in the history — otherwise it shows up twice.
    const messages = (threadData.messages || [])
      .map((msg) => parseGmailMessage(msg))
      .filter((m) => m && !(m.labelIds || []).includes('DRAFT'));
    dispatch(setThread(messages));

    if (messages.length > 0) {
      dispatch(setActiveEmail(messages[messages.length - 1]));
      console.log('[EmailSlice] fetchEmailThread setActiveEmail', {
        threadId,
        messageId: messages[messages.length - 1].messageId,
        previousActiveThreadId: getState().email.activeEmail?.threadId,
      });
    } else {
      // No messages in the thread: clear the active email but still activate the
      // thread's own (empty) draft context so the composer doesn't inherit a
      // different thread's draft.
      dispatch(setActiveEmail(null));
    }

    // Cache the Gmail historyId so incremental updates can be polled cheaply.
    if (threadData.historyId) {
      dispatch(setLastHistoryId(threadData.historyId));
    }

    // Keep the thread list metadata consistent with the full fetch so selecting a
    // thread does not make it jump to a different sort position (the sidebar uses
    // the same metadata dates for every entry).
    const lastMsg = messages[messages.length - 1];
    const metadataUpdate = {
      threadId,
      subject: lastMsg?.subject || '',
      from: lastMsg?.from || '',
      date: lastMsg?.date || '',
      messageCount: messages.length,
      snippet: lastMsg?.snippet || threadData.snippet || '',
    };
    const { customerThreads } = getState().email;
    const idx = customerThreads.findIndex((t) => t.threadId === threadId);
    if (idx >= 0) {
      const next = [...customerThreads];
      next[idx] = { ...next[idx], ...metadataUpdate };
      dispatch(setCustomerThreads(next));
    }

    // Resume any Gmail draft for this thread (agent hand-off or drafts created
    // externally). For the interaction thread this is also called by
    // initEmailTask, but running it here makes historical drafts discoverable.
    dispatch(loadEmailDraftForThread(threadId));

    // Per-thread AI summary + suggested reply: match by THIS thread's RFC 822
    // Message-IDs (falls back to the active task only for the active thread), so
    // opening an older thread shows its own summary — not the latest one.
    dispatch(loadCachedAiSummary());

    // If the cache missed, fetch from JDS. This handles both:
    //   • Navigating back to the active task's thread from a historical one
    //   • Browsing historical threads (matched by the thread's message ids)
    const updatedState = getState().email;
    if (!updatedState.aiEnrichment) {
      const custEmail = updatedState.customerEmail;
      if (custEmail) dispatch(fetchJdsAiSummary(custEmail));
    }
  } catch (err) {
    console.error('[EmailSlice] fetchEmailThread error:', err);
  }
};

/**
 * Cheap incremental update check using Gmail History API.
 * Called on a polling interval (~60s) while the Email tab is visible.
 * Only re-fetches the thread when Gmail reports new messages added since the
 * last full load (identified by lastHistoryId). Falls back to a full re-fetch
 * if the historyId has expired (>7 days old).
 *
 * Important: this polling is about the INTERACTION thread.  The agent may have
 * manually selected a different historical thread to read.  We must NOT call
 * fetchEmailThread(resolvedThreadId) blindly because fetchEmailThread ends
 * with setActiveEmail(lastMessage), which swaps the reading pane (and composer
 * draft context) back to the interaction thread.  Instead:
 *   - If the user is currently viewing the interaction thread, append the new
 *     message(s) to state.thread without changing the active email.
 *   - If the user is viewing a different thread, only update the interaction
 *     thread metadata so the thread list can show an unread/new indicator, but
 *     keep the reading pane where the user left it.
 */
export const checkGmailThreadUpdates = () => async (dispatch, getState) => {
  const { email } = getState();
  const { resolvedThreadId, lastHistoryId, activeInteractionId, activeEmail } = email;
  if (!resolvedThreadId || !lastHistoryId || !activeInteractionId) return;

  console.log('[EmailSlice] checkGmailThreadUpdates tick', {
    resolvedThreadId,
    activeThreadId: activeEmail?.threadId,
    activeInteractionId,
    lastHistoryId,
  });

  const token = await dispatch(ensureGmailToken());
  if (!token) return;

  try {
    const { newHistoryId, addedMessageIds, expired } =
      await apiPollGmailThreadHistory(lastHistoryId, resolvedThreadId, token);

    if (expired) {
      // historyId too old — do a full refresh silently, but only if the user is
      // currently viewing the interaction thread.  If the user has browsed away,
      // just update metadata and keep the reading pane where it is.
      console.log('[EmailSlice] Gmail historyId expired, doing full thread refresh');
      const isViewingInteractionThread = activeEmail?.threadId === resolvedThreadId;
      if (isViewingInteractionThread) {
        await dispatch(fetchEmailThread(resolvedThreadId));
      } else {
        await dispatch(refreshInteractionThreadMetadata());
      }
      return;
    }

    if (newHistoryId) dispatch(setLastHistoryId(newHistoryId));

    if (addedMessageIds.length === 0) return;

    const isViewingInteractionThread = activeEmail?.threadId === resolvedThreadId;
    console.log('[EmailSlice] Gmail: new messages detected', addedMessageIds, {
      isViewingInteractionThread,
    });

    if (isViewingInteractionThread) {
      // Append each new message to the current thread without changing the
      // activeEmail (and therefore without swapping draft context).
      const messages = [];
      for (const messageId of addedMessageIds) {
        try {
          const raw = await apiFetchEmailMessage(messageId, token);
          const parsed = parseGmailMessage(raw);
          if (parsed && !parsed.labelIds?.includes('DRAFT')) {
            messages.push(parsed);
          }
        } catch (msgErr) {
          console.warn('[EmailSlice] Failed to fetch incremental message', messageId, msgErr.message);
        }
      }
      if (messages.length > 0) {
        dispatch(appendThreadMessages(messages));
      }
    } else {
      // User is reading a different thread: update the interaction thread
      // metadata in the sidebar, but don't steal the reading pane.
      await dispatch(refreshInteractionThreadMetadata());
    }
  } catch (err) {
    console.warn('[EmailSlice] checkGmailThreadUpdates error:', err.message);
  }
};

/**
 * Refresh only the metadata (subject/from/date/messageCount) of the interaction
 * thread so the thread list can reflect new activity.  Does not touch the
 * active reading pane or composer.
 */
const refreshInteractionThreadMetadata = () => async (dispatch, getState) => {
  const { email } = getState();
  const { resolvedThreadId } = email;
  if (!resolvedThreadId) return;

  const token = await dispatch(ensureGmailToken());
  if (!token) return;

  try {
    const meta = await apiFetchEmailThreadMetadata(resolvedThreadId, token);
    console.log('[EmailSlice] refreshInteractionThreadMetadata', {
      resolvedThreadId,
      previousActiveThreadId: getState().email.activeEmail?.threadId,
      meta,
    });
    const { customerThreads } = getState().email;
    const idx = customerThreads.findIndex((t) => t.threadId === meta.threadId);
    if (idx >= 0) {
      const next = [...customerThreads];
      next[idx] = { ...next[idx], ...meta, hasNew: true };
      dispatch(setCustomerThreads(next));
    }
  } catch (err) {
    console.warn('[EmailSlice] refreshInteractionThreadMetadata error:', err.message);
  }
};

// Normalize a subject for comparison by stripping reply/fwd prefixes,
// collapsing whitespace, and lower-casing.
const normalizeSubject = (subject) =>
  String(subject || '')
    .replace(/^(Re|Fwd|FW|RE|FWD)\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Resolve the active interaction thread by fetching the full customer thread
 * list and choosing the newest (most recent non-draft message) thread. When a
 * subject is provided, prefer threads whose normalized subject matches it;
 * otherwise simply pick the newest thread overall. This avoids the Gmail
 * from:+subject: search ordering bug that highlights an older thread while the
 * real interaction is the newest one.
 */
async function resolveActiveThreadFromCustomerThreads(customerEmail, subject) {
  return async (dispatch) => {
    const token = await dispatch(ensureGmailToken());
    if (!token) return null;

    try {
      const data = await apiFetchCustomerEmailThreads(customerEmail, token);
      const stubs = data?.threads || [];
      if (stubs.length === 0) return null;

      const toEnrich = stubs.slice(0, 20);
      const enriched = await Promise.all(
        toEnrich.map((t) =>
          apiFetchEmailThreadMetadata(t.id, token).catch((err) => {
            console.warn('[EmailSlice] metadata fetch failed for', t.id, err.message);
            return {
              threadId: t.id,
              subject: '',
              from: '',
              date: '',
              messageCount: null,
              snippet: t.snippet || '',
            };
          })
        )
      );

      const targetSubject = normalizeSubject(subject);
      const candidates = targetSubject
        ? enriched.filter((t) => normalizeSubject(t.subject) === targetSubject)
        : enriched;

      const sorted = [...candidates].filter((t) => t.date).sort((a, b) => {
        const da = new Date(a.date);
        const db = new Date(b.date);
        const diff = (isNaN(db) || isNaN(da)) ? 0 : db - da;
        if (diff !== 0) return diff;
        return String(b.threadId).localeCompare(String(a.threadId));
      });

      const newest = sorted[0] || enriched.find((t) => t.date) || enriched[0];
      return newest?.threadId || null;
    } catch (err) {
      console.warn('[EmailSlice] resolveActiveThreadFromCustomerThreads error:', err.message);
      return null;
    }
  };
}

export const fetchCustomerThreads = (customerEmail) => async (dispatch) => {
  const token = await dispatch(ensureGmailToken());
  if (!token) return;

  try {
    const data = await apiFetchCustomerEmailThreads(customerEmail, token);
    const stubs = data?.threads || [];

    // Dispatch stubs immediately so the panel appears, then enrich in parallel.
    dispatch(setCustomerThreads(stubs.map((t) => ({
      threadId: t.id,
      subject: '',
      from: '',
      date: '',
      messageCount: null,
      snippet: t.snippet || '',
    }))));

    // Fetch metadata (headers only — no body) for each thread concurrently.
    // Cap at 20 threads to stay within rate limits.
    const toEnrich = stubs.slice(0, 20);
    const enriched = await Promise.all(
      toEnrich.map((t) =>
        apiFetchEmailThreadMetadata(t.id, token).catch((err) => {
          console.warn('[EmailSlice] metadata fetch failed for', t.id, err.message);
          return { threadId: t.id, subject: '', from: '', date: '', messageCount: null, snippet: t.snippet || '' };
        })
      )
    );
    dispatch(setCustomerThreads(enriched));

    // Pre-fetch the user's Gmail drafts once and flag any thread that already
    // has a draft. This makes the "draft" pill appear immediately on list load,
    // including for the active/interaction thread.
    try {
      const draftList = await apiFetchGmailDraftList(token);
      const draftThreadIds = new Set(
        (draftList.drafts || [])
          .map((d) => d.message?.threadId)
          .filter(Boolean)
      );
      if (draftThreadIds.size > 0) {
        const withDraftFlag = enriched.map((t) => ({
          ...t,
          hasDraft: draftThreadIds.has(t.threadId),
        }));
        dispatch(setCustomerThreads(withDraftFlag));

        // Prime the per-thread draft cache with a minimal "has draft" entry so
        // ThreadPanel.hasThreadDraft reports true for threads that carry Gmail
        // drafts even before they are opened.
        draftThreadIds.forEach((threadId) => {
          dispatch(setThreadDraftCache({
            threadId,
            patch: {
              aiReplyDraft: '',
              gmailDraftId: true,
              draftSync: { status: 'saved', savedAt: Date.now(), resumed: false },
              emailTouched: true,
            },
          }));
        });
      }
    } catch (draftErr) {
      console.warn('[EmailSlice] draft list pre-fetch failed:', draftErr.message);
    }
  } catch (err) {
    console.error('[EmailSlice] fetchCustomerThreads error:', err);
  }
};

/**
 * Read-only customer email browse (nav-panel Customer360).
 * Loads the searched customer's Gmail thread list by address only — no task
 * init, no JDS/profile mutation, no active-interaction bookkeeping. The 360
 * profile/history are already populated by the manual-search flow, so this must
 * NOT touch them. Threads are shown read-only (compose/reply disabled in UI).
 */
export const loadCustomerEmailThreads = (customerEmail) => async (dispatch, getState) => {
  if (!customerEmail) return;
  const { emailConfig } = getState().widget;
  dispatch(setError(null));
  if (!emailConfig?.tokenBrokerUrl) {
    dispatch(setError('email.error.notConfigured'));
    return;
  }
  dispatch(setCustomerEmail(customerEmail));
  dispatch(setIsFetchingEmail(true));
  try {
    const token = await dispatch(ensureGmailToken());
    if (!token) {
      dispatch(setError('email.error.notConfigured'));
      return;
    }
    await dispatch(fetchCustomerThreads(customerEmail));
  } finally {
    dispatch(setIsFetchingEmail(false));
  }
};

// Guard against concurrent fetches for the same identity (e.g. TaskManagement
// and initEmailTask both triggering JDS at the same time).
const jdsInFlight = new Set();

// Default JDS history window (days). All history fetches are TIME-bound by this
// so coverage is consistent across customers regardless of event density — a
// page-count cap silently truncated dense customers to a few days. Must match
// the History panel's default range so the two share one in-flight cache key
// (prevents a shallow task-context fetch racing/overwriting the panel fetch).
export const DEFAULT_HISTORY_RANGE_DAYS = 7;

export const fetchCustomerJdsHistory =
  (identity, accessToken, workspaceId, datacenter, maxPages = 5, expectedInteractionId = null, rangeDays = DEFAULT_HISTORY_RANGE_DAYS) => async (dispatch, getState) => {
    // Normalise to array so the rest of the function is uniform.
    const identities = (Array.isArray(identity) ? identity : [identity]).filter(Boolean);
    if (!identities.length) return;
    // Cache key includes the range so a range-scoped fetch isn't blocked by a
    // concurrent default (task-context) fetch for the same identities.
    const cacheKey = [...identities].sort().join('|') + '|' + (rangeDays || 'all');
    if (jdsInFlight.has(cacheKey)) return;
    jdsInFlight.add(cacheKey);
    // Show the loading indicator for range-scoped fetches (History range selector).
    if (rangeDays) dispatch(setCustomerHistoryMeta({ loading: true }));
    try {
      // Time-bounded fetch when rangeDays is set (stops at the range boundary);
      // otherwise cap at maxPages. Range fetches get a generous page safety cap.
      const sinceTs = rangeDays ? Date.now() - rangeDays * 86400000 : null;
      const cap = rangeDays ? 50 : maxPages;
      const events = await fetchJourneyEvents(identities, accessToken, workspaceId, datacenter, null, cap, sinceTs);
      // Staleness guard: discard results if the agent switched to a different task
      // while this fetch was in-flight.
      if (expectedInteractionId && getState().email.activeInteractionId !== expectedInteractionId) {
        console.log('[EmailSlice] fetchCustomerJdsHistory: stale result for', expectedInteractionId, '— discarding');
        return;
      }
      dispatch(setCustomerHistory(events || []));
      // Record the time window covered + the selected range (JDS has no total count).
      let oldestTs = null, newestTs = null;
      for (const e of (events || [])) {
        const n = Number(e.timestamp || e.createdAt || 0);
        if (n > 0) {
          if (oldestTs === null || n < oldestTs) oldestTs = n;
          if (newestTs === null || n > newestTs) newestTs = n;
        }
      }
      dispatch(setCustomerHistoryMeta({
        count: (events || []).length,
        hasMore: Boolean(events && events.hasMore),
        maxPages,
        rangeDays: rangeDays || null,
        identities,
        oldestTs,
        newestTs,
      }));
      // After history loads, scan it for a cached ai-summary event and apply it to
      // aiEnrichment so the AiPanel shows the summary without a separate JDS query
      // (covers the case where fetchJdsAiSummary was called before the event was written).
      dispatch(loadCachedAiSummary());
    } catch (err) {
      console.error('[EmailSlice] fetchCustomerJdsHistory error:', err);
    } finally {
      jdsInFlight.delete(cacheKey);
      if (rangeDays) dispatch(setCustomerHistoryMeta({ loading: false }));
    }
  };

/**
 * Load the customer's JDS history for a specific rolling time range (in days).
 * Used by the History range selector; re-fetches with a time-bounded window.
 */
export const loadCustomerJdsHistoryForRange = (rangeDays) => async (dispatch, getState) => {
  const { email, widget } = getState();
  const meta = email.customerHistoryMeta || {};
  const identities = (email.customerIdentities && email.customerIdentities.length)
    ? email.customerIdentities
    : (meta.identities || []);
  const { accesstoken, workspaceid, datacenter } = widget;
  if (!identities.length || !accesstoken || !workspaceid) return;
  // fetchCustomerJdsHistory owns the loading flag for range fetches.
  await dispatch(fetchCustomerJdsHistory(identities, accesstoken, workspaceid, datacenter, 5, null, rangeDays));
};

/**
 * Extract the customer email address from a Webex CC task payload.
 * Checks all known locations across native email channel, CAD variables,
 * and work-item custom data formats.
 * @param {Object} task - Raw task payload from $STORE.agentContact.taskSelected
 * @returns {string|null} Email address or null if not found
 */
export const extractEmailFromTask = (task) => {
  if (!task) return null;
  const candidates = [
    // ── Native Webex CC email channel ────────────────────────────────────
    // For email tasks, `ani` / `displayAni` / `phoneNumber` carry the
    // sender's email address (not a phone number despite the field name).
    task.ani,
    task.displayAni,
    task.phoneNumber,
    // Same value surfaced in CAD as callAssociatedData.ani.value
    task.callAssociatedData?.ani?.value,
    // ── CAD variables — explicit fromAddress / email keys ────────────────
    task.callAssociatedData?.fromAddress?.value,
    typeof task.callAssociatedData?.fromAddress === 'string' ? task.callAssociatedData.fromAddress : null,
    task.callAssociatedData?.email?.value,
    typeof task.callAssociatedData?.email === 'string' ? task.callAssociatedData.email : null,
    // ── Flat callAssociatedDetails (desktop-normalized CAD) ───────────────
    task.callAssociatedDetails?.fromAddress,
    task.callAssociatedDetails?.email,
    task.callAssociatedDetails?.customerEmail,
    // ── Work-item custom data ─────────────────────────────────────────────
    task.channelParams?.message?.workItemData?.email,
    // ── Direct top-level props (merged by parseTaskInput / widget layout) ─
    task.email,
    task.customerEmail,
    // ── Native email: origin.id is the sender address ─────────────────────
    task.mediaType === 'email' ? task.origin?.id : null,
  ];
  return candidates.find((c) => typeof c === 'string' && c.includes('@')) || null;
};

/**
 * Fetch JDS customer history for the email address found in a task payload.
 * This is the main entry-point for the History panel and works independently
 * of Gmail availability.  Dispatches setCustomerHistory on success.
 * @param {Object} task - Task payload (from $STORE.agentContact.taskSelected)
 */
export const loadJdsHistoryForEmailTask = (task) => async (dispatch, getState) => {
  const identity = extractEmailFromTask(task);
  if (!identity) {
    console.log('[EmailSlice] loadJdsHistoryForEmailTask: no email address found in task');
    return;
  }
  const { widget, email } = getState();
  // Skip re-fetch if history is already populated for this session.
  // initEmailTask clears customerHistory when switching to a different task,
  // so this guard is safe and prevents redundant fetches on every HistoryView mount.
  if (email.customerHistory.length > 0) {
    console.log('[EmailSlice] loadJdsHistoryForEmailTask: history already loaded, skipping');
    return;
  }
  const { accesstoken, workspaceid, datacenter } = widget;
  if (!accesstoken || !workspaceid) {
    console.warn('[EmailSlice] loadJdsHistoryForEmailTask: missing credentials, skipping JDS fetch');
    return;
  }
  console.log(`[EmailSlice] loadJdsHistoryForEmailTask: fetching JDS history for ${identity}`);
  dispatch(setCustomerIdentities([identity]));
  await dispatch(fetchCustomerJdsHistory(identity, accesstoken, workspaceid, datacenter));
};

/**
 * Fetch JDS customer history + subscribe to real-time SSE events for a
 * workItem (mediaType="workItem") task payload.
 *
 * Uses BOTH the customer phone/ANI and email address extracted from CAD as
 * identity candidates so the customer's full cross-channel history appears in
 * the History panel regardless of which channel they previously contacted on.
 *
 * Also enriches identities via the JDS person/aliases API — if the phone number
 * maps to a person record that has an email (or vice versa) those are added so
 * all subsequent tab views (History, Email) operate on the complete identity set.
 */
export const loadJdsHistoryForWorkItemTask = (task) => async (dispatch, getState) => {
  if (!task) return;

  const cad = task.callAssociatedData || {};
  const cadVal = (field) => {
    const v = cad[field];
    if (!v) return null;
    return typeof v === 'object' && 'value' in v ? v.value : String(v);
  };

  // For workItem tasks task.ani is an internal UUID, not a real phone number.
  // Only use the explicit 'phone' and 'email' CAD desktop variables.
  const phone = cadVal('phone') || null;
  const email = cadVal('email') || null;

  if (!phone && !email) {
    console.log('[EmailSlice] loadJdsHistoryForWorkItemTask: no identities found in task');
    return;
  }

  const { widget, email: emailState } = getState();
  if (emailState.customerHistory.length > 0 &&
      emailState.activeInteractionId === task.interactionId) {
    console.log('[EmailSlice] loadJdsHistoryForWorkItemTask: already loaded for this interaction, skipping');
    return;
  }

  const { accesstoken, workspaceid, datacenter } = widget;
  if (!accesstoken || !workspaceid) {
    console.warn('[EmailSlice] loadJdsHistoryForWorkItemTask: missing credentials');
    return;
  }

  // ── Clear stale customer data when switching to a new interaction ──────────
  // initEmailTask does the same clearing, but only runs when the Email tab is
  // active. For workItem tasks on other tabs (History/Task) we must clear here
  // to prevent the previous customer's profile persisting on the contact card.
  if (emailState.activeInteractionId && emailState.activeInteractionId !== task.interactionId) {
    dispatch(setCustomerProfile(null));
    dispatch(setCustomerHistory([]));
    dispatch(setCustomerIdentities([]));
    dispatch(setCustomerEmail(null));
    dispatch(setAiEnrichment(null));
  }

  // Register the interaction ID before any async work so that initEmailTask
  // (triggered by the Email tab) sees the correct prevId and doesn't clear history.
  dispatch(setActiveInteractionId(task.interactionId));

  // Store canonical customer email immediately so EmailWidget / History have it.
  if (email) dispatch(setCustomerEmail(email));

  // ── JDS identity enrichment ────────────────────────────────────────────────
  // Look up the customer's person record in JDS using the phone number to collect
  // any additional email aliases (or vice versa). This ensures the History panel
  // shows ALL interactions regardless of which identity was used in each channel.
  let allIdentities = [phone, email].filter(Boolean);
  try {
    const primaryLookup = phone || email;
    const persons = await searchCustomerByIdentity(primaryLookup, accesstoken, workspaceid, datacenter);
    // Staleness guard: discard if task switched while lookup was in-flight.
    if (getState().email.activeInteractionId !== task.interactionId) {
      console.log('[EmailSlice] loadJdsHistoryForWorkItemTask: stale identity result for', task.interactionId, '— discarding');
      return;
    }
    if (persons.length > 0) {
      const person = persons[0];
      console.log('[EmailSlice] loadJdsHistoryForWorkItemTask: JDS person found', person);
      // Store the full person profile so History/Cases views can show contact action buttons.
      dispatch(setCustomerProfile(person));
      // Merge phone + email from person record with what we already have from CAD.
      // JDS returns email and phone as arrays — flatten before spreading into the identity set.
      const personEmails = Array.isArray(person.email) ? person.email : (person.email ? [person.email] : []);
      const personPhones = Array.isArray(person.phone) ? person.phone : (person.phone ? [person.phone] : []);
      allIdentities = [...new Set([phone, email, ...personEmails, ...personPhones].filter(Boolean))];
    }
  } catch (err) {
    console.warn('[EmailSlice] loadJdsHistoryForWorkItemTask: JDS identity lookup failed', err);
    // Non-fatal — fall back to phone+email from CAD.
    // Still guard against a task switch during the failed lookup.
    if (getState().email.activeInteractionId !== task.interactionId) {
      console.log('[EmailSlice] loadJdsHistoryForWorkItemTask: stale after failed identity lookup for', task.interactionId, '— discarding');
      return;
    }
  }

  // If JDS returned no person record, still populate the CustomerContactCard from
  // the CAD data that is available so the bar is not blank when a workItem arrives.
  if (!getState().email.customerProfile && (phone || email)) {
    dispatch(setCustomerProfile({
      email: email || null,
      phone: phone || null,
    }));
  }

  console.log('[EmailSlice] loadJdsHistoryForWorkItemTask: resolved identities', allIdentities);

  // Store the full identity set so other tabs (Email, History) use it consistently.
  dispatch(setCustomerIdentities(allIdentities));

  // JDS history query with all identities — fetchJourneyEvents ORs multiple identity
  // filter params, so events from all channels are merged in one response.
  await dispatch(fetchCustomerJdsHistory(allIdentities, accesstoken, workspaceid, datacenter, undefined, task.interactionId));

  // Start SSE for live event streaming. Prefer email identity (more stable across
  // channels) and fall back to phone.
  const sseIdentity = allIdentities.find(id => id.includes('@')) || phone || email;
  if (emailSseUnsubscribe) {
    emailSseUnsubscribe();
  }
  emailSseUnsubscribe = subscribeToCustomerEvents(
    sseIdentity,
    accesstoken,
    workspaceid,
    datacenter,
    (event) => dispatch(handleSseEvent(event)),
    (err) => console.error('[EmailSlice] SSE error (workItem):', err),
  );
};

/**
 * Fetch JDS customer history + subscribe to real-time SSE events for a
 * telephony (mediaType="telephony") task payload.
 *
 * Uses the task ANI (caller's phone number) as the primary customer identity.
 * For OUTBOUND calls the DNIS is the customer's number, so both ANI and DNIS
 * are included as identity candidates and the JDS person-aliases API is used
 * to collect any additional email/phone identities for the customer.
 */
export const loadJdsHistoryForVoiceTask = (task) => async (dispatch, getState) => {
  if (!task) return;

  // For inbound calls ANI is the customer's caller-ID.
  // For outbound calls DNIS is the customer's number (ANI is the CC outbound line).
  // Include both as candidates; the JDS person lookup will resolve the real customer.
  const ani  = task.ani  || task.phoneNumber || null;
  const dnis = task.dnis || null;

  // If the flow set an "email" CAD variable (e.g. for guest/unknown callers whose
  // email was collected via IVR), use it as the primary identity over ANI so JDS and
  // CRM always resolve the right customer record.
  const cadEmail =
    task.callAssociatedData?.email?.value ||
    task.callAssociatedDetails?.email ||
    null;

  if (!ani && !dnis && !cadEmail) {
    console.log('[EmailSlice] loadJdsHistoryForVoiceTask: no phone identity found in task');
    return;
  }

  const { widget, email: emailState } = getState();
  if (
    emailState.customerHistory.length > 0 &&
    emailState.activeInteractionId === task.interactionId
  ) {
    console.log('[EmailSlice] loadJdsHistoryForVoiceTask: already loaded for this interaction, skipping');
    return;
  }

  const { accesstoken, workspaceid, datacenter } = widget;
  if (!accesstoken || !workspaceid) {
    console.warn('[EmailSlice] loadJdsHistoryForVoiceTask: missing credentials');
    return;
  }

  // Clear stale customer data when switching to a new voice interaction.
  if (emailState.activeInteractionId && emailState.activeInteractionId !== task.interactionId) {
    dispatch(setCustomerProfile(null));
    dispatch(setCustomerHistory([]));
    dispatch(setCustomerIdentities([]));
    dispatch(setCustomerEmail(null));
    dispatch(setAiEnrichment(null));
  }

  dispatch(setActiveInteractionId(task.interactionId));

  // Determine primary lookup identity: CustomerEmail CAD variable takes precedence
  // (guest callers whose email was collected via IVR).  Otherwise fall back to
  // DNIS for OUTBOUND and ANI for INBOUND.
  const isOutbound = String(task.contactDirection || '').toUpperCase() === 'OUTBOUND';
  const primaryPhone = isOutbound ? (dnis || ani) : (ani || dnis);
  // cadEmail is front-loaded so JDS searches by the most-specific identity first.
  let allIdentities = [cadEmail, primaryPhone, isOutbound ? ani : dnis].filter(Boolean);
  // Deduplicate
  allIdentities = [...new Set(allIdentities)];

  // Primary JDS lookup key: prefer cadEmail when available (direct match on email
  // alias), otherwise use the resolved phone number.
  const primaryIdentity = cadEmail || primaryPhone;

  // JDS person lookup — resolves the full customer profile and any additional
  // email/phone aliases so History and other tabs see the complete interaction set.
  try {
    const persons = await searchCustomerByIdentity(primaryIdentity, accesstoken, workspaceid, datacenter);
    if (getState().email.activeInteractionId !== task.interactionId) {
      console.log('[EmailSlice] loadJdsHistoryForVoiceTask: stale identity result for', task.interactionId, '— discarding');
      return;
    }
    if (persons.length > 0) {
      const person = persons[0];
      console.log('[EmailSlice] loadJdsHistoryForVoiceTask: JDS person found', person);
      dispatch(setCustomerProfile(person));
      // JDS returns email and phone as arrays — flatten before spreading into the identity set.
      const personEmails = Array.isArray(person.email) ? person.email : (person.email ? [person.email] : []);
      const personPhones = Array.isArray(person.phone) ? person.phone : (person.phone ? [person.phone] : []);
      allIdentities = [...new Set([...allIdentities, ...personEmails, ...personPhones].filter(Boolean))];
      // Persist the first email address so the Email tab can open Gmail threads for this customer.
      const resolvedEmail = personEmails[0] || null;
      // cadEmail already known — prefer it; fall back to whatever JDS returned.
      if (cadEmail) dispatch(setCustomerEmail(cadEmail));
      else if (resolvedEmail) dispatch(setCustomerEmail(resolvedEmail));
    } else if (cadEmail) {
      // JDS had no record yet but we have a reliable email from the IVR — use it.
      dispatch(setCustomerEmail(cadEmail));
    }
  } catch (err) {
    console.warn('[EmailSlice] loadJdsHistoryForVoiceTask: JDS identity lookup failed', err);
    if (getState().email.activeInteractionId !== task.interactionId) {
      console.log('[EmailSlice] loadJdsHistoryForVoiceTask: stale after failed identity lookup for', task.interactionId, '— discarding');
      return;
    }
    // Even after a failed JDS lookup, honour the CAD email.
    if (cadEmail) dispatch(setCustomerEmail(cadEmail));
  }

  // Populate contact card even when JDS has no person record.
  if (!getState().email.customerProfile) {
    dispatch(setCustomerProfile(cadEmail ? { email: cadEmail } : primaryPhone ? { phone: primaryPhone } : null));
  }

  console.log('[EmailSlice] loadJdsHistoryForVoiceTask: resolved identities', allIdentities);
  dispatch(setCustomerIdentities(allIdentities));

  await dispatch(fetchCustomerJdsHistory(allIdentities, accesstoken, workspaceid, datacenter, undefined, task.interactionId));

  // SSE — prefer an email identity if JDS returned one (more stable), otherwise use phone.
  const sseIdentity = allIdentities.find((id) => id.includes('@')) || primaryPhone;
  if (emailSseUnsubscribe) {
    emailSseUnsubscribe();
  }
  emailSseUnsubscribe = subscribeToCustomerEvents(
    sseIdentity,
    accesstoken,
    workspaceid,
    datacenter,
    (event) => dispatch(handleSseEvent(event)),
    (err) => console.error('[EmailSlice] SSE error (voice):', err),
  );
};

/**
 * Manually resolve a customer by a typed identity (email or phone number) and
 * load their full Customer-360 context — used by the navigation-panel "live"
 * lookup where the widget is open outside of any active task.
 *
 * Populates the same Redux state as the task-driven loaders so every 360 tab
 * (contact card, History, Cases) renders the searched customer:
 *   - email.customerProfile / customerEmail / customerIdentities / customerHistory
 *   - widget.caseWorkflow.customerData (so the Cases tab can load related cases)
 * Also subscribes to the JDS SSE stream for live event updates.
 */
export const searchCustomerByIdentityManual = (rawIdentity) => async (dispatch, getState) => {
  const identity = String(rawIdentity || '').trim();
  if (!identity) return;

  const { widget } = getState();
  const { accesstoken, workspaceid, datacenter } = widget;
  if (!accesstoken || !workspaceid) {
    console.warn('[EmailSlice] searchCustomerByIdentityManual: missing credentials');
    dispatch(setManualSearch({ status: 'error', identity }));
    return;
  }

  const isEmail = identity.includes('@');
  const syntheticId = `manual:${identity}`;

  // Clear any previous customer context and key the session to this search.
  dispatch(setCustomerProfile(null));
  dispatch(setCustomerHistory([]));
  dispatch(setCustomerIdentities([]));
  dispatch(setCustomerEmail(null));
  dispatch(setAiEnrichment(null));
  dispatch(setActiveInteractionId(syntheticId));
  dispatch(setManualSearch({ status: 'searching', identity }));

  let allIdentities = [identity];
  let profile = null;
  try {
    const persons = await searchCustomerByIdentity(identity, accesstoken, workspaceid, datacenter);
    // Staleness guard: discard if a newer search started while this was in-flight.
    if (getState().email.activeInteractionId !== syntheticId) return;
    if (persons && persons.length > 0) {
      profile = persons[0];
      const personEmails = Array.isArray(profile.email) ? profile.email : (profile.email ? [profile.email] : []);
      const personPhones = Array.isArray(profile.phone) ? profile.phone : (profile.phone ? [profile.phone] : []);
      allIdentities = [...new Set([identity, ...personEmails, ...personPhones].filter(Boolean))];
    }
  } catch (err) {
    console.warn('[EmailSlice] searchCustomerByIdentityManual: JDS lookup failed', err);
    if (getState().email.activeInteractionId !== syntheticId) return;
  }

  const hadPerson = Boolean(profile);
  // Fall back to a minimal profile built from the typed identity so the contact
  // card and history query still work when JDS has no person record.
  if (!profile) profile = isEmail ? { email: identity } : { phone: identity };
  dispatch(setCustomerProfile(profile));

  const pickEmail = (v) => {
    if (Array.isArray(v)) return v.find((e) => String(e).includes('@')) || null;
    return typeof v === 'string' && v.includes('@') ? v : null;
  };
  const pickPhone = (v) => {
    if (Array.isArray(v)) return v[0] || null;
    return typeof v === 'string' ? v : null;
  };
  const primaryEmail = isEmail ? identity : pickEmail(profile.email);
  const primaryPhone = !isEmail ? identity : pickPhone(profile.phone);
  if (primaryEmail) dispatch(setCustomerEmail(primaryEmail));
  dispatch(setCustomerIdentities(allIdentities));

  // Seed the case workflow so the Cases tab loads this customer's related cases.
  dispatch(setManualCustomerData({
    name: profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null,
    email: primaryEmail,
    phone: primaryPhone,
  }));

  // Load JDS history across every resolved identity.
  await dispatch(fetchCustomerJdsHistory(allIdentities, accesstoken, workspaceid, datacenter, undefined, syntheticId));
  if (getState().email.activeInteractionId !== syntheticId) return;

  // Optional AI-summary enrichment for the email identity.
  if (primaryEmail) dispatch(fetchJdsAiSummary(primaryEmail));

  // Subscribe to live SSE updates — prefer an email identity (more stable).
  const sseIdentity = allIdentities.find((id) => String(id).includes('@')) || identity;
  if (emailSseUnsubscribe) emailSseUnsubscribe();
  emailSseUnsubscribe = subscribeToCustomerEvents(
    sseIdentity,
    accesstoken,
    workspaceid,
    datacenter,
    (event) => dispatch(handleSseEvent(event)),
    (err) => console.error('[EmailSlice] SSE error (manual search):', err),
  );

  const foundSomething = hadPerson || getState().email.customerHistory.length > 0;
  dispatch(setManualSearch({ status: foundSomething ? 'found' : 'notfound', identity }));
};

/**
 * Clear a manual navigation-panel customer lookup and its 360 context.
 */
export const clearManualCustomerSearch = () => (dispatch) => {
  if (emailSseUnsubscribe) {
    emailSseUnsubscribe();
    emailSseUnsubscribe = null;
  }
  dispatch(setCustomerProfile(null));
  dispatch(setCustomerHistory([]));
  dispatch(setCustomerIdentities([]));
  dispatch(setCustomerEmail(null));
  dispatch(setAiEnrichment(null));
  dispatch(setActiveInteractionId(null));
  dispatch(clearCaseWorkflow());
  dispatch(setManualSearch({ status: 'idle', identity: null }));
};

/**
 * Fetch JDS customer history + subscribe to real-time SSE events for a
 * social (mediaType="social", e.g. outbound SMS) task payload.
 *
 * For outbound social tasks `ani` carries the ENTRY POINT name, not the
 * customer identity.  The real customer phone number is in `customerNumber`
 * (top-level) and `callAssociatedData.customerNumber.value`, mirrored in `dnis`.
 */
export const loadJdsHistoryForSocialTask = (task) => async (dispatch, getState) => {
  if (!task) return;

  // For outbound social tasks the customer number is in customerNumber / dnis.
  // `ani` is the entry-point name (e.g. "EP_FlyHigh_SMS_Selector") — never use it.
  const customerNumber =
    task.customerNumber ||
    task.callAssociatedData?.customerNumber?.value ||
    task.dnis ||
    null;

  if (!customerNumber) {
    console.log('[EmailSlice] loadJdsHistoryForSocialTask: no customer number found in task');
    return;
  }

  const { widget, email: emailState } = getState();
  if (
    emailState.customerHistory.length > 0 &&
    emailState.activeInteractionId === task.interactionId
  ) {
    console.log('[EmailSlice] loadJdsHistoryForSocialTask: already loaded for this interaction, skipping');
    return;
  }

  const { accesstoken, workspaceid, datacenter } = widget;
  if (!accesstoken || !workspaceid) {
    console.warn('[EmailSlice] loadJdsHistoryForSocialTask: missing credentials');
    return;
  }

  // Clear stale customer data when switching to a new interaction.
  if (emailState.activeInteractionId && emailState.activeInteractionId !== task.interactionId) {
    dispatch(setCustomerProfile(null));
    dispatch(setCustomerHistory([]));
    dispatch(setCustomerIdentities([]));
    dispatch(setCustomerEmail(null));
    dispatch(setAiEnrichment(null));
  }

  dispatch(setActiveInteractionId(task.interactionId));

  let allIdentities = [customerNumber];

  // JDS person lookup — resolve full profile (name, all emails/phones).
  try {
    const persons = await searchCustomerByIdentity(customerNumber, accesstoken, workspaceid, datacenter);
    if (getState().email.activeInteractionId !== task.interactionId) {
      console.log('[EmailSlice] loadJdsHistoryForSocialTask: stale result — discarding');
      return;
    }
    if (persons.length > 0) {
      const person = persons[0];
      console.log('[EmailSlice] loadJdsHistoryForSocialTask: JDS person found', person);
      dispatch(setCustomerProfile(person));
      const personEmails = Array.isArray(person.email) ? person.email : (person.email ? [person.email] : []);
      const personPhones = Array.isArray(person.phone) ? person.phone : (person.phone ? [person.phone] : []);
      allIdentities = [...new Set([...allIdentities, ...personEmails, ...personPhones].filter(Boolean))];
      const resolvedEmail = personEmails[0] || null;
      if (resolvedEmail) dispatch(setCustomerEmail(resolvedEmail));
    }
  } catch (err) {
    console.warn('[EmailSlice] loadJdsHistoryForSocialTask: JDS identity lookup failed', err);
    if (getState().email.activeInteractionId !== task.interactionId) return;
  }

  // Populate contact card even when JDS has no person record.
  if (!getState().email.customerProfile) {
    dispatch(setCustomerProfile({ phone: customerNumber }));
  }

  console.log('[EmailSlice] loadJdsHistoryForSocialTask: resolved identities', allIdentities);
  dispatch(setCustomerIdentities(allIdentities));

  await dispatch(fetchCustomerJdsHistory(allIdentities, accesstoken, workspaceid, datacenter, undefined, task.interactionId));

  // SSE — prefer an email identity if JDS returned one, otherwise use phone.
  const sseIdentity = allIdentities.find((id) => id.includes('@')) || customerNumber;
  if (emailSseUnsubscribe) {
    emailSseUnsubscribe();
  }
  emailSseUnsubscribe = subscribeToCustomerEvents(
    sseIdentity,
    accesstoken,
    workspaceid,
    datacenter,
    (event) => dispatch(handleSseEvent(event)),
    (err) => console.error('[EmailSlice] SSE error (social):', err),
  );
};

/**
 * Fetch JDS customer history + subscribe to real-time SSE events for a
 * chat (mediaType="chat") task payload.
 *
 * For chat tasks the `ani` / `displayAni` field contains the customer's email
 * address (e.g. "jarda@kp.cz"). The backup phone identity is carried in
 * callAssociatedData.phoneNumber.value. Both are used for the JDS person lookup
 * so the History panel shows interactions across all channels.
 */
export const loadJdsHistoryForChatTask = (task) => async (dispatch, getState) => {
  if (!task) return;

  // For chat tasks, ANI is the customer's email address.
  const email =
    (task.ani && task.ani.includes('@') ? task.ani : null) ||
    (task.displayAni && task.displayAni.includes('@') ? task.displayAni : null) ||
    task.callAssociatedData?.ani?.value ||
    null;

  // Phone is a backup identity — lives in CAD phoneNumber field.
  const phone =
    task.callAssociatedData?.phoneNumber?.value ||
    task.callAssociatedDetails?.phoneNumber ||
    null;

  if (!email && !phone) {
    console.log('[EmailSlice] loadJdsHistoryForChatTask: no identity found in task');
    return;
  }

  const { widget, email: emailState } = getState();
  if (
    emailState.customerHistory.length > 0 &&
    emailState.activeInteractionId === task.interactionId
  ) {
    console.log('[EmailSlice] loadJdsHistoryForChatTask: already loaded for this interaction, skipping');
    return;
  }

  const { accesstoken, workspaceid, datacenter } = widget;
  if (!accesstoken || !workspaceid) {
    console.warn('[EmailSlice] loadJdsHistoryForChatTask: missing credentials');
    return;
  }

  // Clear stale customer data when switching to a new chat interaction.
  if (emailState.activeInteractionId && emailState.activeInteractionId !== task.interactionId) {
    dispatch(setCustomerProfile(null));
    dispatch(setCustomerHistory([]));
    dispatch(setCustomerIdentities([]));
    dispatch(setCustomerEmail(null));
    dispatch(setAiEnrichment(null));
  }

  dispatch(setActiveInteractionId(task.interactionId));
  if (email) dispatch(setCustomerEmail(email));

  let allIdentities = [email, phone].filter(Boolean);

  // JDS person lookup — resolves the full customer profile and any additional aliases.
  try {
    const primaryLookup = email || phone;
    const persons = await searchCustomerByIdentity(primaryLookup, accesstoken, workspaceid, datacenter);
    if (getState().email.activeInteractionId !== task.interactionId) {
      console.log('[EmailSlice] loadJdsHistoryForChatTask: stale identity result for', task.interactionId, '— discarding');
      return;
    }
    if (persons.length > 0) {
      const person = persons[0];
      console.log('[EmailSlice] loadJdsHistoryForChatTask: JDS person found', person);
      dispatch(setCustomerProfile(person));
      const personEmails = Array.isArray(person.email) ? person.email : (person.email ? [person.email] : []);
      const personPhones = Array.isArray(person.phone) ? person.phone : (person.phone ? [person.phone] : []);
      allIdentities = [...new Set([email, phone, ...personEmails, ...personPhones].filter(Boolean))];
    }
  } catch (err) {
    console.warn('[EmailSlice] loadJdsHistoryForChatTask: JDS identity lookup failed', err);
    if (getState().email.activeInteractionId !== task.interactionId) {
      console.log('[EmailSlice] loadJdsHistoryForChatTask: stale after failed identity lookup for', task.interactionId, '— discarding');
      return;
    }
  }

  // Populate contact card even when JDS has no person record.
  if (!getState().email.customerProfile) {
    dispatch(setCustomerProfile({ email: email || null, phone: phone || null }));
  }

  console.log('[EmailSlice] loadJdsHistoryForChatTask: resolved identities', allIdentities);
  dispatch(setCustomerIdentities(allIdentities));

  await dispatch(fetchCustomerJdsHistory(allIdentities, accesstoken, workspaceid, datacenter, undefined, task.interactionId));

  // SSE — prefer email identity (more stable across sessions).
  const sseIdentity = allIdentities.find((id) => id.includes('@')) || phone;
  if (emailSseUnsubscribe) {
    emailSseUnsubscribe();
  }
  emailSseUnsubscribe = subscribeToCustomerEvents(
    sseIdentity,
    accesstoken,
    workspaceid,
    datacenter,
    (event) => dispatch(handleSseEvent(event)),
    (err) => console.error('[EmailSlice] SSE error (chat):', err),
  );
};

/** JDS event type used to cache AI email summaries. */
export const AI_SUMMARY_EVENT_TYPE = 'email:ai-summary';

/**
 * Cache TTL for JDS-stored AI summaries (7 days). Summaries older than this
 * are ignored so the AI re-generates a fresh one on the next interaction.
 * Configurable via emailConfig.aiSummaryTtlMs in the widget layout.
 */
const DEFAULT_AI_SUMMARY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── AI-summary matching helpers ────────────────────────────────────────────
// Normalise an RFC 822 Message-ID for comparison (strip <>, trim, lowercase).
const normMsgId = (id) => String(id || '').replace(/[<>]/g, '').trim().toLowerCase();
// customerHistory events store the epoch under raw.eventTime / timestamp — NOT
// a top-level eventTime — so read all three (older code read the wrong field).
const eventTs = (ev) => Number(ev?.raw?.eventTime ?? ev?.eventTime ?? ev?.timestamp ?? 0);
// RFC 822 Message-IDs of every message in the currently loaded thread.
const openThreadRfcIds = (email) => {
  const s = new Set();
  for (const m of (email.thread || [])) {
    const id = normMsgId(m.rfcMessageId);
    if (id) s.add(id);
  }
  return s;
};
// Whether the currently open thread is the active task's own thread (vs a
// historical thread the agent opened from the thread list).
const isActiveThreadOpen = (email) =>
  Boolean(email.resolvedThreadId) && email.activeEmail?.threadId === email.resolvedThreadId;
// True when an ai-summary event belongs to the currently open thread. Matches on
// the message's RFC 822 id; the active-task fallback (taskId) only applies to the
// active thread so historical threads never inherit the active task's summary.
const aiSummaryMatchesOpenThread = (ev, rfcIds, activeInteractionId, activeThreadOpen) => {
  const mid = normMsgId(ev.data?.messageId);
  if (mid && rfcIds.has(mid)) return true;
  if (activeThreadOpen && activeInteractionId && ev.data?.taskId === activeInteractionId) return true;
  return false;
};

/**
 * All email:ai-summary versions for the currently open thread, newest first.
 * As the agent re-generates the summary/suggested reply after each thread
 * update a new event is written, so this powers the AiPanel's "latest shown,
 * older ones collapsed" view. Memoised so it only recomputes when the email
 * slice changes. Deduped by event id (fetch + SSE can both carry the same one).
 */
export const selectThreadAiSummaries = createSelector(
  [(s) => s.email, (s) => s.widget?.emailConfig?.aiSummaryTtlMs],
  (email, ttlMs) => {
    if (!email?.activeEmail) return [];
    const cutoff = Date.now() - (ttlMs ?? DEFAULT_AI_SUMMARY_TTL_MS);
    const rfcIds = openThreadRfcIds(email);
    const activeThreadOpen = isActiveThreadOpen(email);
    const interactionId = email.activeInteractionId;
    if (rfcIds.size === 0 && !(activeThreadOpen && interactionId)) return [];
    const seen = new Set();
    return (email.customerHistory || [])
      .filter((ev) =>
        ev.type === AI_SUMMARY_EVENT_TYPE &&
        eventTs(ev) > cutoff &&
        (ev.data?.summary || ev.data?.aiSummary || ev.data?.suggestedReply) &&
        aiSummaryMatchesOpenThread(ev, rfcIds, interactionId, activeThreadOpen)
      )
      .sort((a, b) => eventTs(b) - eventTs(a))
      .filter((ev) => { if (seen.has(ev.id)) return false; seen.add(ev.id); return true; })
      .map((ev) => ({
        id: ev.id,
        ts: eventTs(ev),
        summary: ev.data?.summary || ev.data?.aiSummary || null,
        suggestedReply: ev.data?.suggestedReply || null,
        riskDetected: parseRiskValue(ev.data?.riskDetected),
        riskMessageId: normMsgId(ev.data?.messageId),
      }));
  }
);

/**
 * Scan customerHistory for the newest email:ai-summary event that belongs to the
 * currently open thread, and seed aiEnrichment from it if still fresh.
 */
export const loadCachedAiSummary = () => (dispatch, getState) => {
  const { email, widget } = getState();
  if (!email.activeEmail) return;
  const ttl = widget.emailConfig?.aiSummaryTtlMs ?? DEFAULT_AI_SUMMARY_TTL_MS;
  const cutoff = Date.now() - ttl;
  const rfcIds = openThreadRfcIds(email);
  const activeThreadOpen = isActiveThreadOpen(email);
  if (rfcIds.size === 0 && !(activeThreadOpen && email.activeInteractionId)) return;

  const cached = (email.customerHistory || [])
    .filter(
      (ev) =>
        ev.type === AI_SUMMARY_EVENT_TYPE &&
        eventTs(ev) > cutoff &&
        aiSummaryMatchesOpenThread(ev, rfcIds, email.activeInteractionId, activeThreadOpen)
    )
    .sort((a, b) => eventTs(b) - eventTs(a))[0];

  if (cached?.data?.summary || cached?.data?.aiSummary) {
    const summaryText = cached.data.summary || cached.data.aiSummary;
    const suggestedReply = cached.data.suggestedReply || null;
    // JDS may flag this message/thread as risky (e.g. fraud, compliance).
    // If the field is absent we default to false so existing events keep working.
    const riskDetected = parseRiskValue(cached.data?.riskDetected);
    const riskMessageId = riskDetected ? normMsgId(cached.data?.messageId) : null;
    console.log('[EmailSlice] Loaded AI summary from JDS cache for open thread (riskDetected=' + riskDetected + (riskMessageId ? ' messageId=' + riskMessageId : '') + ')');
    dispatch(setAiEnrichment({ summary: summaryText, suggestedReply, riskDetected, riskMessageId, source: 'jds-cache' }));
  }
};

/**
 * Fetch the cached AI summary for the current task from JDS using a
 * targeted type query (1 page, ~100 events). Much faster than scanning the
 * full customer history. Matches by identity + taskId client-side.
 * JDS optimization: workspace-wide type==email:ai-summary query (no identity
 * filter param) then client-side identity+taskId check.
 *
 * Note: JDS event data.messageId is the RFC 822 Message-ID header value
 * (e.g. "<UUID@domain>"), NOT the Gmail internal message ID. We therefore
 * match by data.taskId (the Webex CC interaction UUID) which is reliable.
 */
export const fetchJdsAiSummary = (customerEmail) => async (dispatch, getState) => {
  const { email, widget } = getState();
  const interactionId = email.activeInteractionId;
  if (!customerEmail) return;

  const { accesstoken, workspaceid, datacenter } = widget;
  if (!accesstoken || !workspaceid) return;

  const ttl = widget.emailConfig?.aiSummaryTtlMs ?? DEFAULT_AI_SUMMARY_TTL_MS;
  const cutoff = Date.now() - ttl;

  const rfcIds = openThreadRfcIds(email);
  const activeThreadOpen = isActiveThreadOpen(email);
  // Need at least one way to identify the open thread's summary.
  if (rfcIds.size === 0 && !(activeThreadOpen && interactionId)) return;

  // Match the open thread by its RFC 822 Message-IDs; the active-task taskId
  // fallback only applies to the active thread (see aiSummaryMatchesOpenThread).
  const findMatch = (events) =>
    events
      .filter((ev) => eventTs(ev) > cutoff && aiSummaryMatchesOpenThread(ev, rfcIds, interactionId, activeThreadOpen))
      .sort((a, b) => eventTs(b) - eventTs(a))[0];

  try {
    // Primary: compound FIQL AND (identity + type). Confirmed working in JDS.
    // Returns only this customer's ai-summary events — much cheaper than workspace-wide.
    const primaryFilter = `identity==${customerEmail};type==email:ai-summary`;
    const primaryEvents = await fetchJourneyEvents(null, accesstoken, workspaceid, datacenter, primaryFilter, 2);
    let cached = findMatch(primaryEvents);

    // Fallback: workspace-wide type query. Handles events stored with the wrong identity
    // (e.g. agent email instead of customer email). Match by message id / taskId.
    if (!cached?.data?.summary && !cached?.data?.aiSummary) {
      console.log('[EmailSlice] fetchJdsAiSummary: primary identity query missed, trying workspace fallback');
      const fallbackEvents = await fetchJourneyEvents(null, accesstoken, workspaceid, datacenter, 'type==email:ai-summary', 2);
      cached = findMatch(fallbackEvents);
    }

    if (cached?.data?.summary || cached?.data?.aiSummary) {
      const summaryText = cached.data.summary || cached.data.aiSummary;
      const suggestedReply = cached.data.suggestedReply || null;
      const riskDetected = parseRiskValue(cached.data?.riskDetected);
      const riskMessageId = riskDetected ? normMsgId(cached.data?.messageId) : null;
      console.log('[EmailSlice] Loaded AI summary from JDS for open thread (riskDetected=' + riskDetected + (riskMessageId ? ' messageId=' + riskMessageId : '') + ')');
      dispatch(setAiEnrichment({ summary: summaryText, suggestedReply, riskDetected, riskMessageId, source: 'jds-cache' }));
    } else if (!activeThreadOpen) {
      // Historical thread with no stored summary — make sure no stale summary lingers.
      dispatch(setAiEnrichment(null));
    }
  } catch (err) {
    console.warn('[EmailSlice] fetchJdsAiSummary error:', err.message);
  }
};

/**
 * Fetch and cache templates from a remote URL (e.g. mockapi.io).
 * Falls back silently so the composer still works without templates.
 */
export const fetchTemplatesFromUrl = (url) => async (dispatch) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Templates fetch failed: ${response.status}`);
    const data = await response.json();
    // Accept both a plain array and a { templates: [...] } wrapper
    const list = Array.isArray(data) ? data : (data.templates || []);
    // Normalize: mockapi stores variables as a comma-separated string; ensure array
    const normalized = list.map((tpl) => ({
      ...tpl,
      variables: Array.isArray(tpl.variables)
        ? tpl.variables
        : typeof tpl.variables === 'string' && tpl.variables
          ? tpl.variables.split(',').map((v) => v.trim()).filter(Boolean)
          : [],
    }));
    if (normalized.length > 0) dispatch(setTemplates(normalized));
  } catch (err) {
    console.warn('[EmailSlice] fetchTemplatesFromUrl error:', err.message);
  }
};

/**
 * Fetch and cache signatures from a remote URL.
 * Falls back silently — the composer still works without remote signatures.
 */
export const fetchSignaturesFromUrl = (url, defaultSignatureId) => async (dispatch) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Signatures fetch failed: ${response.status}`);
    const data = await response.json();
    const list = Array.isArray(data) ? data : (data.signatures || []);
    if (list.length > 0) {
      dispatch(setSignatures(list));
      if (defaultSignatureId) dispatch(setActiveSignatureId(defaultSignatureId));
    }
  } catch (err) {
    console.warn('[EmailSlice] fetchSignaturesFromUrl error:', err.message);
  }
};

/**
 * Resolve the agent's CURRENTLY ACTIVE (logged-in) team. Templates/signatures
 * are filtered to this one team only — not the agent's full set of team
 * memberships. Primary source is the Desktop SDK `latestData.teamId`; falls back
 * to a single active team on the stored agent object.
 *
 * @returns {Promise<{id:string, name:string|null} | null>}
 */
const resolveActiveTeam = async (widget) => {
  const agent = widget.agent || {};
  // The AgentX store ($STORE.agent = ModuleAgent) exposes the CURRENTLY ACTIVE
  // team as `teamUniqueId` (id) + `teamName`. Prefer it — it is present as soon
  // as the agent is logged in, unlike latestData.teamId which needs a live event.
  const storeId = agent.teamUniqueId || agent.teamId || agent.team?.id;
  const storeName = agent.teamName || agent.team?.name;
  if (storeId || storeName) {
    return { id: storeId ? String(storeId) : null, name: storeName ? String(storeName) : null };
  }
  // SDK fallback (populated only once a state-change event has been received).
  if (widget.desktopSDK) {
    try {
      const { Desktop } = await import('@wxcc-desktop/sdk');
      for (let i = 0; i < 6; i++) {
        const info = Desktop?.agentStateInfo?.latestData || {};
        if (info.teamId) {
          return { id: String(info.teamId), name: info.teamName ? String(info.teamName) : null };
        }
        await new Promise((r) => setTimeout(r, 350));
      }
      console.warn('[EmailSlice] no active team on agent store or latestData; agentKeys=', Object.keys(agent), 'latestKeys=', Object.keys(Desktop?.agentStateInfo?.latestData || {}));
    } catch { /* SDK unavailable */ }
  }
  return null;
};

/**
 * Load email templates, signatures and the proof-reading prompt from the
 * supervisor-managed Agent Experience repository (the `experience` Cloud
 * Function), filtered to the current agent's team membership.
 *
 * The repository stores language-grouped templates; they are flattened into the
 * flat, locale-tagged shape the composer already understands (TemplatePicker
 * filters by `locale`). Fails soft: returns false (so the caller falls back to
 * the layout/URL/mock source) when nothing is configured or nothing applies.
 *
 * @returns {Promise<boolean>} true when templates or signatures were applied
 */
export const loadTeamEmailAssets = () => async (dispatch, getState) => {
  const { widget } = getState();
  const cfg = widget.emailConfig || {};
  const { experienceUrl } = cfg;
  const accessToken = widget.accesstoken;
  const orgId = widget.orgid;
  if (!experienceUrl || !accessToken || !orgId) return false;

  const config = await fetchExperienceConfig(experienceUrl, orgId, accessToken);
  if (!config) return false;

  const templates = Array.isArray(config.templates) ? config.templates : [];
  const signatures = Array.isArray(config.signatures) ? config.signatures : [];
  const tAssign = config.templateAssignments || {};
  const sAssign = config.signatureAssignments || {};
  const prompts = config.proofreadPrompts || {};

  // An empty repository (org never saved one) → let the caller fall back to the
  // layout/URL/mock source. A non-empty repository is AUTHORITATIVE below.
  const repoHasTemplates = templates.length > 0;
  const repoHasSignatures = signatures.length > 0;
  if (!repoHasTemplates && !repoHasSignatures) return false;

  const activeTeam = await resolveActiveTeam(widget);
  const activeTeamId = activeTeam?.id || null;
  const activeTeamName = activeTeam?.name || null;
  const hasTeam = Boolean(activeTeamId);
  if (!hasTeam) {
    console.warn('[EmailSlice] active agent team could not be determined — showing all assigned items (fail-open)');
  }
  // An item is available only when it is assigned to the agent's CURRENTLY ACTIVE
  // team. If the active team can't be determined (fail-open) any assigned item is
  // shown so the agent is never left without templates.
  const assignedToAgent = (assignMap, id) => {
    const list = assignMap[id];
    if (!Array.isArray(list) || list.length === 0) return false;
    if (!hasTeam) return true;
    return list.some((tid) => String(tid) === activeTeamId || (activeTeamName && String(tid) === activeTeamName));
  };

  const flatTemplates = [];
  templates.forEach((tpl) => {
    if (!assignedToAgent(tAssign, tpl.id)) return;
    const variants = tpl.variants || {};
    Object.keys(variants).forEach((lang) => {
      const v = variants[lang] || {};
      if (!v.name && !v.body) return;
      flatTemplates.push({
        id: `${tpl.id}:${lang}`,
        name: v.name || tpl.id,
        subject: v.subject || '',
        body: v.body || '',
        locale: lang,
        category: tpl.category || 'general',
        variables: Array.isArray(tpl.variables) ? tpl.variables : [],
      });
    });
  });

  // Signatures are language-grouped too — flatten to per-language, locale-tagged
  // entries (the composer filters signatures by `locale` like templates).
  const flatSignatures = [];
  signatures.forEach((sig) => {
    if (!assignedToAgent(sAssign, sig.id)) return;
    // Support legacy flat signatures ({name, html}) as a single 'en' variant.
    const variants = sig.variants || (sig.html || sig.name ? { en: { name: sig.name, html: sig.html } } : {});
    Object.keys(variants).forEach((lang) => {
      const v = variants[lang] || {};
      if (!v.name && !v.html) return;
      flatSignatures.push({
        id: `${sig.id}:${lang}`,
        name: v.name || sig.id,
        html: v.html || '',
        locale: lang,
      });
    });
  });

  // Proof-reading prompt: the active team's override, else the org default.
  let proofreadPrompt = typeof prompts.default === 'string' && prompts.default.trim() ? prompts.default : null;
  const teamPrompts = prompts.teams || {};
  if (hasTeam && typeof teamPrompts[activeTeamId] === 'string' && teamPrompts[activeTeamId].trim()) {
    proofreadPrompt = teamPrompts[activeTeamId];
  }

  // The repository is authoritative: apply the team-filtered result (even when
  // it narrows to few/none) so supervisor activation/deactivation propagates and
  // non-team templates never leak in via a fallback.
  if (repoHasTemplates) dispatch(setTemplates(flatTemplates));
  if (repoHasSignatures) {
    dispatch(setSignatures(flatSignatures));
    // The composer's own effect picks/keeps a valid current-locale signature, so
    // we don't reset the agent's selection here (avoids clobbering it on refresh).
  }
  if (proofreadPrompt) dispatch(setEmailConfig({ proofreadPrompt }));

  console.log('[EmailSlice] loaded team email assets:', {
    activeTeamId, activeTeamName,
    templates: flatTemplates.length,
    signatures: flatSignatures.length,
    promptOverride: proofreadPrompt != null && proofreadPrompt !== prompts.default,
  });
  return true;
};

/**
 * Build an aiConfig object enriched with the cached Gemini Bearer token.
 * Pass the result to createAiProvider so the provider uses OAuth instead of
 * an API key — the key never leaves the cloud function.
 */
const resolveAiConfig = async (dispatch, getState) => {
  const { widget } = getState();
  const aiConfig = widget.emailConfig?.aiProvider;
  if (!aiConfig) return null;
  if (aiConfig.type === 'gemini' && widget.emailConfig?.tokenBrokerUrl) {
    const resolvedToken = await dispatch(ensureGeminiToken());
    return { ...aiConfig, resolvedToken };
  }
  return aiConfig;
};

export const refreshAiEnrichment = () => async (dispatch, getState) => {
  const cfg = await resolveAiConfig(dispatch, getState);
  if (!cfg) { console.warn('[EmailSlice] AI provider not configured'); return; }

  const { email } = getState();
  const { thread, customerHistory } = email;
  const threadText = thread
    .map((m) => `From: ${m.from}\nDate: ${m.date}\n\n${m.bodyText || m.snippet}`)
    .join('\n---\n');

  try {
    const provider = createAiProvider(cfg.type || 'mock', cfg);
    const result = await provider.summarize(threadText, customerHistory);
    dispatch(setAiEnrichment({ ...result, source: 'ai' }));
  } catch (err) {
    console.error('[EmailSlice] refreshAiEnrichment error:', err);
  }
};

export const generateAiReply = (instruction, tone, locale) => async (dispatch, getState) => {
  const cfg = await resolveAiConfig(dispatch, getState);
  if (!cfg) return;
  const { email } = getState();
  const { thread, aiEnrichment } = email;
  dispatch(setIsFetchingAiDraft(true));
  try {
    const provider = createAiProvider(cfg.type || 'mock', cfg);
    const result = await provider.generateReply({ thread, aiEnrichment }, instruction, tone, locale);
    dispatch(setAiReplyDraft(result.replyHtml || result.replyText || ''));
  } catch (err) {
    console.error('[EmailSlice] generateAiReply error:', err);
  } finally {
    dispatch(setIsFetchingAiDraft(false));
  }
};

export const improveAiDraft = (currentDraft, instruction, locale) => async (dispatch, getState) => {
  const cfg = await resolveAiConfig(dispatch, getState);
  if (!cfg) return;
  dispatch(setIsFetchingAiDraft(true));
  try {
    const provider = createAiProvider(cfg.type || 'mock', cfg);
    const result = await provider.improveText(currentDraft, instruction, locale);
    dispatch(setAiReplyDraft(result.improvedHtml || result.improvedText || currentDraft));
  } catch (err) {
    console.error('[EmailSlice] improveAiDraft error:', err);
  } finally {
    dispatch(setIsFetchingAiDraft(false));
  }
};

export const correctGrammar = (currentDraft, locale) => async (dispatch, getState) => {
  const cfg = await resolveAiConfig(dispatch, getState);
  if (!cfg) return;
  dispatch(setIsCorrectingGrammar(true));
  try {
    const provider = createAiProvider(cfg.type || 'mock', cfg);
    const result = await provider.correctGrammar(currentDraft, locale);
    dispatch(setAiReplyDraft(result.correctedHtml || currentDraft));
  } catch (err) {
    console.error('[EmailSlice] correctGrammar error:', err);
  } finally {
    dispatch(setIsCorrectingGrammar(false));
  }
};

export const proofreadDraft = (currentDraft, locale) => async (dispatch, getState) => {
  const cfg = await resolveAiConfig(dispatch, getState);
  if (!cfg) return;
  const { email, widget } = getState();
  const { activeEmail, thread } = email;
  // Supervisor/admin-editable prompt (Desktop layout config field `proofreadPrompt`).
  const promptTemplate = widget.emailConfig?.proofreadPrompt || null;
  // Original customer message = the email being replied to (fall back to last thread message).
  const src = activeEmail || (Array.isArray(thread) && thread.length ? thread[thread.length - 1] : null);
  const customerMessage = src
    ? `Subject: ${src.subject || ''}\n\n${src.bodyText || src.snippet || (src.bodyHtml ? src.bodyHtml.replace(/<[^>]+>/g, ' ') : '')}`.trim()
    : '';
  dispatch(setIsFetchingAiDraft(true));
  dispatch(setAiProofreadResult(null));
  try {
    const provider = createAiProvider(cfg.type || 'mock', cfg);
    const result = await provider.proofread(currentDraft, locale, { customerMessage, promptTemplate });
    dispatch(setAiProofreadResult(result));
  } catch (err) {
    console.error('[EmailSlice] proofreadDraft error:', err);
  } finally {
    dispatch(setIsFetchingAiDraft(false));
  }
};

export const generateGroundedReply = (instruction, tone, locale) => async (dispatch, getState) => {
  const cfg = await resolveAiConfig(dispatch, getState);
  if (!cfg) return;
  const { email, widget } = getState();
  const kbConfig = widget.emailConfig?.knowledgeBase;
  const { thread, aiEnrichment, activeEmail } = email;
  dispatch(setIsFetchingAiDraft(true));
  dispatch(setKnowledgeSources([]));
  try {
    const provider = createAiProvider(cfg.type || 'mock', cfg);
    const result = await provider.generateGroundedReply(
      { thread, aiEnrichment, activeEmail },
      { kbArticles: kbConfig, fileSearchStoreName: cfg.fileSearchStoreName },
      instruction, tone, locale,
    );
    dispatch(setAiReplyDraft(result.replyHtml || result.replyText || ''));
    if (result.sources?.length) dispatch(setKnowledgeSources(result.sources));
  } catch (err) {
    console.error('[EmailSlice] generateGroundedReply error:', err);
  } finally {
    dispatch(setIsFetchingAiDraft(false));
  }
};

/**
 * Apply a template by ID: substitute {{variable}} tokens from current Redux
 * state (agent info, customer info, date) then set as the draft.
 */
export const applyTemplate = (templateId) => (dispatch, getState) => {
  const { email, widget } = getState();
  const tpl = email.templates.find((t) => t.id === templateId);
  if (!tpl) return;

  // Build variable map from Redux state
  const fromRaw = email.activeEmail?.from || '';
  const nameMatch = fromRaw.match(/^([^<]+?)(?:\s*<.*>)?$/);
  const customerName = nameMatch?.[1]?.trim() || fromRaw.split('@')[0] || '';
  const customerEmailAddr = fromRaw.match(/<([^>]+)>/)?.[1] || fromRaw;

  const vars = {
    customerName,
    customerEmail: customerEmailAddr,
    agentName: widget.agentName || widget.agent?.agentName || '',
    agentEmail: widget.agent?.agentEmailId || '',
    date: new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date()),
    taskId: email.activeInteractionId || '',
    subject: email.activeEmail?.subject || '',
    orderNumber: '',
  };

  const substituted = tpl.body.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
  // Insert at the composer cursor instead of replacing the whole draft.
  dispatch(setPendingComposerInsert(substituted));
  if (tpl.subject) {
    // Subject override is informational — no Redux field for it yet, just log
    console.log('[EmailSlice] Template subject:', tpl.subject);
  }
};

// ─── Gmail drafts: hand off an in-progress reply between agents ────────────────

// Build the Gmail message fields for a draft from the active email + current body.
const buildDraftMessageFields = (state) => {
  const { activeEmail, aiReplyDraft } = state.email;
  if (!activeEmail) return null;
  const isSent = Array.isArray(activeEmail.labelIds) && activeEmail.labelIds.includes('SENT');
  const toAddress = isSent ? activeEmail.to : activeEmail.from;
  const subject = activeEmail.subject?.startsWith('Re:') ? activeEmail.subject : `Re: ${activeEmail.subject || ''}`;
  return {
    toAddress,
    subject,
    replyHtml: aiReplyDraft,
    threadId: activeEmail.threadId,
    inReplyTo: activeEmail.messageId,
    references: activeEmail.references ? `${activeEmail.references} ${activeEmail.messageId}` : activeEmail.messageId,
  };
};

// Save the current reply as a Gmail draft (create or update). The draft lives in
// the shared mailbox keyed to the thread, so another agent who receives the
// transferred task resumes exactly where this one left off.
export const saveEmailDraft = () => async (dispatch, getState) => {
  const state = getState();
  const { activeEmail, aiReplyDraft, gmailDraftId } = state.email;
  if (!activeEmail?.threadId) return; // only thread-bound replies are transferable
  const bodyText = String(aiReplyDraft || '').replace(/<[^>]+>/g, '').trim();
  if (!bodyText) return;
  const token = await dispatch(ensureGmailToken());
  if (!token) return;
  const fields = buildDraftMessageFields(state);
  if (!fields) return;
  dispatch(setDraftSync({ status: 'saving' }));
  try {
    if (gmailDraftId) {
      await apiUpdateGmailDraft(token, gmailDraftId, fields);
    } else {
      const created = await apiCreateGmailDraft(token, fields);
      if (created?.id) dispatch(setGmailDraftId(created.id));
    }
    dispatch(setDraftSync({ status: 'saved', savedAt: Date.now() }));
  } catch (err) {
    console.warn('[EmailSlice] saveEmailDraft failed:', err.message);
    dispatch(setDraftSync({ status: 'error' }));
  }
};

// On task open, resume any Gmail draft left for this thread by a previous agent.
export const loadEmailDraftForThread = (threadId) => async (dispatch, getState) => {
  if (!threadId) return;
  const { email } = getState();

  // With per-thread draft caching, a resumed draft must go into the cache for
  // this thread BEFORE it becomes the active thread.  If we are already on the
  // requested thread, stash the current (empty) state first so the restore path
  // below has a stable cache row to update.
  const isTargetActive = email.activeEmail?.threadId === threadId;
  if (isTargetActive) {
    dispatch(setThreadDraftCache({
      threadId,
      patch: {
        aiReplyDraft: email.aiReplyDraft,
        gmailDraftId: email.gmailDraftId,
        draftSync: email.draftSync,
        aiProofreadResult: email.aiProofreadResult,
        emailTouched: email.emailTouched,
        lastSentReply: email.lastSentReply,
        pendingComposerInsert: email.pendingComposerInsert,
      },
    }));
  }

  // Never clobber an agent who has already started typing on this task.
  const cached = getThreadDraft(getState().email, threadId);
  if (String(cached.aiReplyDraft || '').replace(/<[^>]+>/g, '').trim()) return;
  const token = await dispatch(ensureGmailToken());
  if (!token) return;
  try {
    const found = await apiFindGmailDraftForThread(token, threadId);
    if (found?.draftId && (found.html || found.text)) {
      // Guard against a stale lookup: only cache the draft if this thread is
      // still the one being opened (for active) or still known in the sidebar.
      // Using resolvedThreadId here would reject every historical thread.
      const { activeEmail, customerThreads } = getState().email;
      const stillRelevant =
        activeEmail?.threadId === threadId ||
        customerThreads.some((t) => t.threadId === threadId);
      if (!stillRelevant) return;
      // Write into the cache via a Redux action so the new reference triggers
      // re-renders of thread-list draft badges, without mutating the currently
      // active thread's working fields.
      dispatch(setThreadDraftCache({
        threadId,
        patch: {
          aiReplyDraft: found.html || `<p>${found.text}</p>`,
          gmailDraftId: found.draftId,
          draftSync: { status: 'saved', savedAt: Date.now(), resumed: true },
          emailTouched: true,
          aiProofreadResult: null,
          lastSentReply: null,
          pendingComposerInsert: null,
        },
      }));
      // Ensure the thread list shows the draft pill for this thread even if
      // the initial draft-list pre-fetch missed it.
      const ctIdx = customerThreads.findIndex((t) => t.threadId === threadId);
      if (ctIdx >= 0) {
        const nextThreads = [...customerThreads];
        nextThreads[ctIdx] = { ...nextThreads[ctIdx], hasDraft: true };
        dispatch(setCustomerThreads(nextThreads));
      }
      // If this thread is currently open, mirror the restored draft to the
      // scalar working fields so the composer shows it immediately.
      if (getState().email.activeEmail?.threadId === threadId) {
        dispatch(setGmailDraftId(found.draftId));
        dispatch(setAiReplyDraft(found.html || `<p>${found.text}</p>`));
        dispatch(setDraftSync({ status: 'saved', savedAt: Date.now(), resumed: true }));
      }
      console.log('[EmailSlice] Resumed Gmail draft', found.draftId, 'for thread', threadId);
    }
  } catch (err) {
    console.warn('[EmailSlice] loadEmailDraftForThread failed:', err.message);
  }
};

// Remove the Gmail draft (after the reply is sent, or when starting fresh).
export const deleteEmailDraft = () => async (dispatch, getState) => {
  const state = getState().email;
  const draftId = state.gmailDraftId;
  const activeThreadId = state.activeEmail?.threadId || null;
  dispatch(setGmailDraftId(null));
  dispatch(setDraftSync({ status: null, savedAt: null, resumed: false }));
  // Also clear the cached draft for this thread so returning to it later starts
  // fresh after a successful send.
  if (activeThreadId) {
    setThreadDraft(state, activeThreadId, emptyThreadDraft());
    // Remove the draft pill from the thread list metadata for this thread.
    const idx = state.customerThreads.findIndex((t) => t.threadId === activeThreadId);
    if (idx >= 0) {
      state.customerThreads[idx] = { ...state.customerThreads[idx], hasDraft: false };
    }
  }
  if (!draftId) return;
  const token = await dispatch(ensureGmailToken());
  if (!token) return;
  try { await apiDeleteGmailDraft(token, draftId); }
  catch (err) { console.warn('[EmailSlice] deleteEmailDraft failed:', err.message); }
};

// ─── AI wrap-up summary (customer issue + agent response) ─────────────────────

export const generateWrapUpSummary = (locale) => async (dispatch, getState) => {
  const cfg = await resolveAiConfig(dispatch, getState);
  const { email, widget } = getState();
  const incoming = email.aiEnrichment?.summary || '';
  const response = email.lastSentReply
    || String(email.aiReplyDraft || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!incoming && !response) return;

  dispatch(setWrapUpSummary({ status: 'generating' }));
  // Signal the headless wrap-up handler to show a “generating summary” spinner.
  try {
    const pbc = new BroadcastChannel('crm-sync');
    pbc.postMessage({ type: 'WRAP_SUMMARY_PENDING', interactionId: email.activeInteractionId });
    pbc.close();
  } catch { /* BroadcastChannel unavailable */ }
  try {
    let sections = null;
    if (cfg) {
      const provider = createAiProvider(cfg.type || 'mock', cfg);
      const res = await provider.wrapUpSummary(incoming, response, locale);
      sections = res?.sections || null;
    }
    if (!sections) {
      sections = {
        initialContactReason: incoming || '',
        additionalContext: '',
        additionalContactReasons: '',
        keyActionsTaken: response ? response.slice(0, 200) : '',
        nextSteps: '',
      };
    }
    // Short "Label: value" text for JDS + any in-widget display.
    const LABELS = {
      initialContactReason: 'Contact reason', additionalContext: 'Details',
      additionalContactReasons: 'Additional topics', keyActionsTaken: 'Actions taken', nextSteps: 'Next steps',
    };
    const text = Object.keys(LABELS)
      .filter((k) => sections[k] && String(sections[k]).trim())
      .map((k) => `${LABELS[k]}: ${sections[k]}`)
      .join('\n');
    dispatch(setWrapUpSummary({ status: 'ready', text, sections }));

    // Broadcast the structured summary so the headless wrap-up handler can write
    // it straight into the native wrap-up AdaptiveCard (contact reason / details /
    // additional topics / actions taken / next steps).
    try {
      const bc = new BroadcastChannel('crm-sync');
      bc.postMessage({ type: 'WRAP_SUMMARY', sections, text, interactionId: email.activeInteractionId });
      bc.close();
    } catch { /* BroadcastChannel unavailable */ }

    // Persist to JDS so the summary is retrievable later.
    const { accesstoken, workspaceid, datacenter } = widget;
    const customerEmail = email.customerEmail;
    if (text && customerEmail && accesstoken && workspaceid) {
      try {
        await publishCloudEvent({
          id: generateCorrelationId(),
          specversion: '1.0',
          type: 'email:wrapup-summary',
          source: 'task-management-widget',
          time: new Date().toISOString(),
          eventTime: Date.now(),
          identity: customerEmail,
          identitytype: 'email',
          datacontenttype: 'application/json',
          data: { summary: text, sections, taskId: email.activeInteractionId },
        }, accesstoken, workspaceid, datacenter);
      } catch (jdsErr) { console.warn('[EmailSlice] wrapup-summary JDS publish failed:', jdsErr.message); }
    }
  } catch (err) {
    console.error('[EmailSlice] generateWrapUpSummary error:', err);
    dispatch(setWrapUpSummary({ status: 'error' }));
    try {
      const ebc = new BroadcastChannel('crm-sync');
      ebc.postMessage({ type: 'WRAP_SUMMARY_ERROR', interactionId: getState().email.activeInteractionId });
      ebc.close();
    } catch { /* ignore */ }
  }
};

export const sendEmailReply = (payload) => async (dispatch, getState) => {
  dispatch(setIsSending(true));
  dispatch(setSendResult(null));

  try {
    // Use the cached Gmail token when still valid (the send scope is now the
    // default), so a routine send doesn't wait on a token-broker round-trip.
    const token = await dispatch(ensureGmailToken());
    if (!token) {
      dispatch(setIsSending(false));
      dispatch(setSendResult({ success: false, error: 'email.error.noToken' }));
      return;
    }

    const sentMessage = await apiSendEmailViaGmail(token, payload);
    console.log('[EmailSlice] Gmail send success:', sentMessage.id, 'thread:', sentMessage.threadId);

    dispatch(setIsSending(false));
    dispatch(setSendResult({ success: true, messageId: sentMessage.id }));

    // Capture the sent reply text (input for the wrap-up summary) and remove the
    // Gmail draft now that the reply has actually gone out.
    dispatch(setLastSentReply(payload.replyText || String(payload.replyHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()));
    dispatch(deleteEmailDraft());

    // Refresh the thread so the sent reply appears immediately in the conversation.
    // Gmail needs ~1s to index the newly sent message before threads.get returns it.
    const threadId = sentMessage.threadId || payload.threadId;
    if (threadId) {
      setTimeout(() => dispatch(fetchEmailThread(threadId)), 1500);
    }

    // Post a JDS event so the sent reply can be retrieved later via Gmail messageId/threadId.
    // Pattern follows email:ai-summary: identity = customer email, data contains Gmail identifiers.
    const { widget, email } = getState();
    const { accesstoken, workspaceid, datacenter } = widget;
    const customerEmail = email.customerEmail || payload.toAddress;
    if (customerEmail && accesstoken && workspaceid) {
      try {
        const now = new Date().toISOString();
        const jdsEvent = {
          id: generateCorrelationId(),
          specversion: '1.0',
          type: 'email:reply-sent',
          source: 'task-management-widget',
          time: now,
          eventTime: Date.now(),
          identity: customerEmail,
          identitytype: 'email',
          previousidentity: null,
          datacontenttype: 'application/json',
          data: {
            gmailMessageId: sentMessage.id,
            gmailThreadId: sentMessage.threadId || payload.threadId,
            subject: payload.subject,
            to: payload.toAddress,
            taskId: payload.interactionId,
          },
        };
        await publishCloudEvent(jdsEvent, accesstoken, workspaceid, datacenter);
        console.log('[EmailSlice] JDS email:reply-sent posted for', customerEmail);
      } catch (jdsErr) {
        // JDS publish failure is non-fatal — reply was already sent
        console.warn('[EmailSlice] JDS publish failed (non-fatal):', jdsErr.message);
      }
    }
  } catch (err) {
    console.error('[EmailSlice] sendEmailReply error:', err);
    dispatch(setIsSending(false));
    dispatch(setSendResult({ success: false, error: err.message }));
  }
};

export const handleSseEvent = (event) => (dispatch, getState) => {
  if (!event?.type) return;
  console.log('[EmailSlice] SSE event received:', event.type, event.id);

  // Append the raw event to customerHistory so the History view updates in
  // real-time without needing a full re-fetch. HistoryView.normalizeEvent
  // handles all known Webex CC CloudEvent types plus our custom events.
  // Normalise the JDS envelope shape to match fetchJourneyEvents output:
  // { id, type, time, eventTime, identity, data, ... }
  const normalized = {
    id:           event.id || `sse-${Date.now()}`,
    type:         event.type,
    time:         event.time || new Date().toISOString(),
    timestamp:    event.eventTime || event.time || Date.now(),
    eventTime:    event.eventTime || Date.now(),
    identity:     event.identity,
    identitytype: event.identitytype,
    channel:      event.data?.channelType || event.channel || null,
    data:         event.data || {},
    taskId:       event.data?.taskId || null,
    source:       event.source || 'sse',
  };
  dispatch(appendCustomerHistoryEvent(normalized));

  // When an AI summary SSE event arrives for the active task, update aiEnrichment
  // immediately so the AiPanel shows the summary and suggested reply without
  // waiting for a manual refresh or re-fetch.
  if (event.type === AI_SUMMARY_EVENT_TYPE && event.data) {
    const { email: emailState } = getState();
    const activeId = emailState.activeInteractionId;
    const eventTaskId = event.data.taskId || null;
    // Accept if taskId matches (specific) OR no taskId on event (broadcast)
    const taskMatch = !eventTaskId || !activeId || eventTaskId === activeId;
    // Skip while the agent is browsing a historical thread so its per-thread
    // summary is not overwritten by the active task's live summary.
    const browsingHistorical = Boolean(emailState.activeEmail) && !isActiveThreadOpen(emailState);
    if (taskMatch && !browsingHistorical) {
      const summaryText = event.data.aiSummary || event.data.summary || null;
      const suggestedReply = event.data.suggestedReply || null;
      if (summaryText || suggestedReply) {
        console.log('[EmailSlice] SSE ai-summary: updating aiEnrichment for task', activeId);
        // Merge with any existing enrichment (e.g. category/sentiment from CAD)
        const existing = emailState.aiEnrichment || {};
        const riskDetected = parseRiskValue(event.data?.riskDetected);
        dispatch(setAiEnrichment({
          ...existing,
          summary: summaryText || existing.summary || null,
          suggestedReply: suggestedReply || existing.suggestedReply || null,
          riskDetected,
          riskMessageId: riskDetected ? normMsgId(event.data?.messageId) : null,
          source: 'jds-cache',
        }));
      }
    }
  }
};

export const submitWrapUp = (interactionId, wrapUpData) => async (dispatch, getState) => {
  dispatch(setWrapUp({ ...wrapUpData }));

  // Clean up SSE subscription
  if (emailSseUnsubscribe) {
    emailSseUnsubscribe();
    emailSseUnsubscribe = null;
  }
  if (sendTimeoutTimer) {
    clearTimeout(sendTimeoutTimer);
    sendTimeoutTimer = null;
  }

  const { widget } = getState();
  // desktopSDK is now stored as a boolean flag (true = SDK available).
  // Import Desktop directly for the live SDK reference.
  let Desktop = null;
  if (widget.desktopSDK) {
    try {
      ({ Desktop } = await import('@wxcc-desktop/sdk'));
    } catch { /* SDK not available */ }
  }

  if (!Desktop) {
    console.warn('[EmailSlice] Desktop SDK not available for wrapup (demo mode)');
    dispatch(setWrapUp({ submitted: true }));
    return;
  }

  try {
    await Desktop.agentContact.endV2({ interactionId });
    await Desktop.agentContact.wrapupV2({
      interactionId,
      data: {
        wrapUpReason: wrapUpData.reason || '',
        auxCodeId: wrapUpData.auxCodeId || '',
      },
    });
    dispatch(setWrapUp({ submitted: true }));
  } catch (err) {
    console.error('[EmailSlice] submitWrapUp error:', err);
    dispatch(setError('email.error.wrapupFailed'));
  }
};

/**
 * Pick a durable interaction summary we previously persisted to JDS for a given
 * task/interaction id. email:wrapup-summary / task:wrapup-summary carry the
 * structured `sections` the History InteractionSummary renders; email:ai-summary
 * is a plain-text fallback. Returns null when nothing was stored for the task.
 */
export const pickStoredSummaryForTask = (events, taskId) => {
  const evs = (events || []).filter(
    (ev) =>
      (ev.type === 'email:wrapup-summary' ||
        ev.type === 'task:wrapup-summary' ||
        ev.type === AI_SUMMARY_EVENT_TYPE) &&
      ev.data?.taskId === taskId
  );
  if (!evs.length) return null;
  evs.sort((a, b) => eventTs(b) - eventTs(a));

  const wrap = evs.find(
    (e) => (e.type === 'email:wrapup-summary' || e.type === 'task:wrapup-summary') && e.data?.sections
  );
  if (wrap) {
    const s = wrap.data.sections;
    return {
      initialContactReason: s.initialContactReason || null,
      keyActionsTaken: s.keyActionsTaken || null,
      nextSteps: s.nextSteps || null,
      additionalContactReasons: s.additionalContactReasons || s.additionalContext || null,
    };
  }
  const ai = evs.find((e) => e.data?.aiSummary || e.data?.summary);
  if (ai) return { initialContactReason: ai.data.aiSummary || ai.data.summary };
  return null;
};

// Human-readable labels for the wrap-up summary text stored in JDS.
const WRAPUP_SUMMARY_LABELS = {
  initialContactReason: 'Contact reason',
  additionalContext: 'Details',
  additionalContactReasons: 'Additional topics',
  keyActionsTaken: 'Actions taken',
  nextSteps: 'Next steps',
};

/** Convert an AI-assistant POST_CALL summary into the JDS {sections,text} shape. */
const summaryToJdsPayload = (summary) => {
  const sections = {
    initialContactReason: summary.initialContactReason || '',
    additionalContext: summary.additionalContext || '',
    additionalContactReasons: summary.additionalContactReasons || '',
    keyActionsTaken: summary.keyActionsTaken || '',
    nextSteps: summary.nextSteps || '',
  };
  const text = Object.keys(WRAPUP_SUMMARY_LABELS)
    .filter((k) => sections[k] && String(sections[k]).trim())
    .map((k) => `${WRAPUP_SUMMARY_LABELS[k]}: ${sections[k]}`)
    .join('\n');
  return { sections, text };
};

/**
 * Best-effort: resolve a customer identity (phone/email) to key a stored summary
 * on, so the customer's JDS history query returns it later. Prefers the
 * interaction's own origin (guaranteed to be one of the identities History
 * queried, since the interaction appeared in customerHistory), then falls back
 * to the resolved customer identities.
 */
const deriveCustomerIdentityForTask = (email, taskId) => {
  for (const ev of (email.customerHistory || [])) {
    if (ev.data?.interactionId === taskId || ev.data?.taskId === taskId) {
      const o = ev.data?.origin;
      if (o && (String(o).includes('@') || /\d/.test(String(o)))) return o;
    }
  }
  const ids = email.customerIdentities || [];
  return ids[0] || email.customerEmail || null;
};

/**
 * Persist a voice/interaction wrap-up summary to JDS so it survives the short
 * AI-assistant summary/list retention window (~1-2 days). Keyed by a customer
 * identity so the customer's JDS history query returns it. Best-effort — never
 * throws into the caller.
 */
export const persistTaskSummaryToJds = (taskId, summary, identity) => async (dispatch, getState) => {
  if (!taskId || !summary || !identity) return;
  const { accesstoken, workspaceid, datacenter } = getState().widget;
  if (!accesstoken || !workspaceid) return;
  // Don't write a duplicate if we already stored one for this task.
  const already = (getState().email.customerHistory || []).some(
    (ev) => ev.type === 'task:wrapup-summary' && ev.data?.taskId === taskId
  );
  if (already) return;
  const { sections, text } = summaryToJdsPayload(summary);
  if (!text) return;
  const identitytype = String(identity).includes('@') ? 'email' : 'phone';
  try {
    await publishCloudEvent(
      {
        id: generateCorrelationId(),
        specversion: '1.0',
        type: 'task:wrapup-summary',
        source: 'task-management-widget',
        time: new Date().toISOString(),
        eventTime: Date.now(),
        identity,
        identitytype,
        datacontenttype: 'application/json',
        data: { summary: text, sections, taskId },
      },
      accesstoken,
      workspaceid,
      datacenter
    );
    console.log('[EmailSlice] Persisted wrap-up summary to JDS for task', taskId);
  } catch (err) {
    console.warn('[EmailSlice] task:wrapup-summary JDS publish failed:', err.message);
  }
};

/**
 * Fetch an AI-generated POST_CALL summary for a past interaction and store it
 * in state.email.interactionSummaries[taskId].
 * Safe to call multiple times — skips the network call if a summary already
 * exists for that taskId.
 */
export const fetchInteractionSummary = (taskId) => async (dispatch, getState) => {
  if (!taskId) return;

  const state = getState();
  // Skip if already fetched
  if (state.email?.interactionSummaries?.[taskId]) return;

  // 1) Durable source: a summary we persisted to JDS (email:wrapup-summary /
  //    email:ai-summary). Survives far longer than the AI-assistant summary/list
  //    retention window, so older interactions still show their summary.
  const stored = pickStoredSummaryForTask(state.email?.customerHistory || [], taskId);
  if (stored) {
    dispatch(setInteractionSummary({ taskId, summary: stored }));
    return;
  }

  const { widget } = state;
  const orgId       = widget.orgid || widget.orgId;
  const datacenter  = widget.datacenter;
  const accessToken = widget.accesstoken;

  if (!orgId || !datacenter || !accessToken) {
    // Demo mode or missing credentials — nothing to fetch
    return;
  }

  try {
    const summary = await getTaskSummary(orgId, taskId, datacenter, accessToken);
    if (summary) {
      dispatch(setInteractionSummary({ taskId, summary }));
      // Persist to JDS while the summary is still fresh so it survives the short
      // AI-assistant retention window and remains visible on future visits.
      const identity = deriveCustomerIdentityForTask(state.email, taskId);
      if (identity) dispatch(persistTaskSummaryToJds(taskId, summary, identity));
    }
  } catch (err) {
    console.error('[EmailSlice] fetchInteractionSummary error:', err);
  }
};

import { createSlice } from '@reduxjs/toolkit';
import { getMockData } from '../../mock/mockData';
import {
  subscribeToCustomerEvents,
  fetchGmailToken as apiFetchGmailToken,
  fetchEmailThread as apiFetchEmailThread,
  fetchEmailThreadMetadata as apiFetchEmailThreadMetadata,
  fetchCustomerEmailThreads as apiFetchCustomerEmailThreads,
  findGmailThreadByRfcMessageId as apiFindGmailThreadByRfcMessageId,
  findGmailThreadBySubjectAndSender as apiFindGmailThreadBySubjectAndSender,
  sendEmailViaGmail as apiSendEmailViaGmail,
  pollGmailThreadHistory as apiPollGmailThreadHistory,
  publishCloudEvent,
  fetchJourneyEvents,
  getTaskSummary,
  searchCustomerByIdentity,
} from '../../api';
import { createAiProvider } from '../../ai/aiProvider';

// Non-serializable refs stored outside Redux (per State Serialization Discipline)
let emailSseUnsubscribe = null;
// Per-interactionId in-flight guard — prevents duplicate concurrent initEmailTask calls
// (e.g. two widget instances mounting simultaneously both bypass the idempotency guard
// before either has loaded the thread into Redux state).
const initInFlight = new Set();

// ─── Helpers ───────────────────────────────────────────────────────────────

const generateCorrelationId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

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
  lastHistoryId: null,      // Gmail historyId from last thread fetch — used for update polling
  thread: [],
  customerThreads: [],
  customerHistory: [],
  customerIdentities: [],    // All known identity values for the current customer (phone + email + JDS aliases)
  customerProfile: null,     // Normalised JDS person record { id, name, firstName, lastName, email, phone } for the active task
  interactionSummaries: {}, // { [taskId]: { initialContactReason, keyActionsTaken, nextSteps, ... } }
  aiEnrichment: null,
  aiReplyDraft: '',
  templates: [],
  signatures: [],
  activeSignatureId: null,
  aiProofreadResult: null,     // { correctedHtml, issues: [{type, original, suggestion}] }
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
      state.activeEmail = action.payload;
    },
    setActiveInteractionId: (state, action) => {
      state.activeInteractionId = action.payload;
    },
    setResolvedThreadId: (state, action) => {
      state.resolvedThreadId = action.payload;
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
    setCustomerThreads: (state, action) => {
      state.customerThreads = action.payload;
    },
    setCustomerHistory: (state, action) => {
      state.customerHistory = action.payload;
    },
    setCustomerIdentities: (state, action) => {
      state.customerIdentities = action.payload;
    },
    setCustomerProfile: (state, action) => {
      state.customerProfile = action.payload;
    },
    appendCustomerHistoryEvent: (state, action) => {
      // Prepend so newest events appear first (HistoryView sorts desc by ts)
      // Deduplicate by event id to guard against reconnect replays.
      const incoming = action.payload;
      if (!incoming?.id) return;
      const alreadyPresent = state.customerHistory.some((e) => e.id === incoming.id);
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
    },
    setIsCorrectingGrammar: (state, action) => {
      state.isCorrectingGrammar = action.payload;
    },
    setKnowledgeSources: (state, action) => {
      state.knowledgeSources = action.payload;
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
    resetEmail: () => ({ ...initialState }),
    resetEmailContent: (state) => ({
      // Preserves everything that was loaded for the current task so that
      // switching to another tab and back does NOT trigger a full reload:
      //   - customerHistory / interactionSummaries  → History tab
      //   - thread / activeEmail / aiEnrichment / customerThreads → Email reading pane
      //   - gmailToken / activeInteractionId / resolvedThreadId / lastHistoryId → Gmail state
      // Only volatile UI state (wrapUp, sending, errors, drafts) is reset.
      ...initialState,
      gmailToken: state.gmailToken,
      geminiToken: state.geminiToken,
      activeInteractionId: state.activeInteractionId,
      customerEmail: state.customerEmail,
      resolvedThreadId: state.resolvedThreadId,
      lastHistoryId: state.lastHistoryId,
      thread: state.thread,
      activeEmail: state.activeEmail,
      aiEnrichment: state.aiEnrichment,
      customerThreads: state.customerThreads,
      customerHistory: state.customerHistory,
      customerIdentities: state.customerIdentities,
      customerProfile: state.customerProfile,
      interactionSummaries: state.interactionSummaries,
      // Persist config-level lists across tab switches
      templates: state.templates,
      signatures: state.signatures,
      activeSignatureId: state.activeSignatureId,
    }),
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
      state.aiReplyDraft   = '';
      state.customerThreads = emailData.customerThreads;
      state.isFetchingToken = false;
      state.isFetchingEmail = false;
      state.error  = null;
      state.wrapUp = { submitted: false, reason: '', notes: '' };
      // Load templates, signatures, KB from mock data (locale-aware)
      if (m.emailComposer) {
        state.templates  = m.emailComposer.templates  || [];
        state.signatures = m.emailComposer.signatures || [];
        state.activeSignatureId = m.emailComposer.defaultSignatureId || null;
      }
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
  setLastHistoryId,
  setThread,
  setCustomerThreads,
  setCustomerHistory,
  appendCustomerHistoryEvent,
  setCustomerIdentities,
  setCustomerProfile,
  setAiEnrichment,
  setAiReplyDraft,
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
  resetEmail,
  resetEmailContent,
  setMockEmailData,
  setInteractionSummary,
} = emailSlice.actions;

export default emailSlice.reducer;

// ─── Thunks ─────────────────────────────────────────────────────────────────

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
      console.log('[EmailSlice] initEmailTask: task already loaded, skipping re-initialization');
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
      dispatch(setLastHistoryId(null));
    }
    dispatch(setActiveInteractionId(interactionId));

    // ── Load templates / signatures from config ───────────────────────────
    // Both may come from a remote URL or inline in the layout config.
    {
      const { emailConfig: cfg } = getState().widget;
      if (cfg.templatesUrl) {
        // Fire-and-forget — templates arrive shortly after task init
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
          source: 'cad',
        })
      );
    }

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
    //   1. gmailThreadId from CAD (direct — requires Webex Connect flow to map it)
    //   2. rfcMessageId via rfc822msgid: Gmail search (exact, works once Webex Connect
    //      maps the Message-Id header as a CAD variable)
    //   3. sender + subject search (current fallback, less reliable)
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
          const searchQuery = `from:${customerEmail}${subject ? ` subject:"${subject}"` : ''}`;
          console.log('[EmailSlice] Searching thread via subject/sender:', searchQuery);
          resolvedThreadId = await apiFindGmailThreadBySubjectAndSender(customerEmail, subject, token);
          console.log('[EmailSlice] subject/sender search result:', resolvedThreadId);
        }
      } catch (err) {
        console.warn('[EmailSlice] Thread ID resolution failed:', err.message);
      }
    }

    console.log('[EmailSlice] Resolved threadId:', resolvedThreadId, '| customerEmail:', customerEmail);
    // Cache the resolved threadId so future tab re-visits skip the Gmail search.
    if (resolvedThreadId) dispatch(setResolvedThreadId(resolvedThreadId));
    await Promise.all([
      resolvedThreadId ? dispatch(fetchEmailThread(resolvedThreadId)) : Promise.resolve(),
      customerEmail ? dispatch(fetchCustomerThreads(customerEmail)) : Promise.resolve(),
    ]);

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
    dispatch(setMockEmailData({ locale: locale || 'en', taskId: taskId === 'default' ? null : taskId }));
  }
};

export const fetchEmailThread = (threadId) => async (dispatch, getState) => {
  const token = await dispatch(ensureGmailToken());
  if (!token) return;

  // When the user selects a historical thread from OtherThreadsList (a different
  // thread than the active interaction's thread), clear the AI summary — it was
  // loaded for the active task and is not relevant to the historical thread.
  const { resolvedThreadId } = getState().email;
  if (resolvedThreadId && threadId !== resolvedThreadId) {
    dispatch(setAiEnrichment(null));
  }

  try {
    const threadData = await apiFetchEmailThread(threadId, token);
    if (!threadData) return;

    const messages = (threadData.messages || []).map((msg) => parseGmailMessage(msg));
    dispatch(setThread(messages));

    if (messages.length > 0) {
      dispatch(setActiveEmail(messages[messages.length - 1]));
    }
    // Cache the Gmail historyId so incremental updates can be polled cheaply.
    if (threadData.historyId) {
      dispatch(setLastHistoryId(threadData.historyId));
    }

    // Always try the JDS history cache first (covers voice-context email browsing where
    // customerHistory contains all historical email:ai-summary events).
    dispatch(loadCachedAiSummary());

    // If the cache missed, fetch from JDS. This handles both:
    //   • Navigating back to the active task's thread from a historical one
    //   • Browsing historical threads during a voice call (no resolvedThreadId)
    const updatedState = getState().email;
    if (!updatedState.aiEnrichment) {
      const email = updatedState.customerEmail;
      if (email) dispatch(fetchJdsAiSummary(email));
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
 */
export const checkGmailThreadUpdates = () => async (dispatch, getState) => {
  const { email } = getState();
  const { resolvedThreadId, lastHistoryId, activeInteractionId } = email;
  if (!resolvedThreadId || !lastHistoryId || !activeInteractionId) return;

  const token = await dispatch(ensureGmailToken());
  if (!token) return;

  try {
    const { newHistoryId, addedMessageIds, expired } =
      await apiPollGmailThreadHistory(lastHistoryId, resolvedThreadId, token);

    if (expired) {
      // historyId too old — do a full refresh silently
      console.log('[EmailSlice] Gmail historyId expired, doing full thread refresh');
      await dispatch(fetchEmailThread(resolvedThreadId));
      return;
    }

    if (newHistoryId) dispatch(setLastHistoryId(newHistoryId));

    if (addedMessageIds.length > 0) {
      console.log('[EmailSlice] Gmail: new messages detected, refreshing thread', addedMessageIds);
      await dispatch(fetchEmailThread(resolvedThreadId));
    }
  } catch (err) {
    console.warn('[EmailSlice] checkGmailThreadUpdates error:', err.message);
  }
};

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
  } catch (err) {
    console.error('[EmailSlice] fetchCustomerThreads error:', err);
  }
};

// Guard against concurrent fetches for the same identity (e.g. TaskManagement
// and initEmailTask both triggering JDS at the same time).
const jdsInFlight = new Set();

export const fetchCustomerJdsHistory =
  (identity, accessToken, workspaceId, datacenter, maxPages = 5, expectedInteractionId = null) => async (dispatch, getState) => {
    // Normalise to array so the rest of the function is uniform.
    const identities = (Array.isArray(identity) ? identity : [identity]).filter(Boolean);
    if (!identities.length) return;
    // Stable cache key works for both single and multi-identity queries.
    const cacheKey = [...identities].sort().join('|');
    if (jdsInFlight.has(cacheKey)) return;
    jdsInFlight.add(cacheKey);
    try {
      // JDS optimization: cap at maxPages (default 5 = 500 events) — more than enough
      // for the history timeline. Full 20-page fetch (2000 events) is wasteful.
      const events = await fetchJourneyEvents(identities, accessToken, workspaceId, datacenter, null, maxPages);
      // Staleness guard: discard results if the agent switched to a different task
      // while this fetch was in-flight.
      if (expectedInteractionId && getState().email.activeInteractionId !== expectedInteractionId) {
        console.log('[EmailSlice] fetchCustomerJdsHistory: stale result for', expectedInteractionId, '— discarding');
        return;
      }
      dispatch(setCustomerHistory(events || []));
      // After history loads, scan it for a cached ai-summary event and apply it to
      // aiEnrichment so the AiPanel shows the summary without a separate JDS query
      // (covers the case where fetchJdsAiSummary was called before the event was written).
      dispatch(loadCachedAiSummary());
    } catch (err) {
      console.error('[EmailSlice] fetchCustomerJdsHistory error:', err);
    } finally {
      jdsInFlight.delete(cacheKey);
    }
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

/**
 * Scan customerHistory for the newest email:ai-summary event that matches
 * the active message, and seed aiEnrichment from it if still fresh.
 */
export const loadCachedAiSummary = () => (dispatch, getState) => {
  const { email, widget } = getState();
  const messageId = email.activeEmail?.messageId;
  if (!messageId) return;
  const ttl = widget.emailConfig?.aiSummaryTtlMs ?? DEFAULT_AI_SUMMARY_TTL_MS;
  const cutoff = Date.now() - ttl;

  const cached = (email.customerHistory || [])
    .filter(
      (ev) =>
        ev.type === AI_SUMMARY_EVENT_TYPE &&
        ev.data?.messageId === messageId &&
        (ev.eventTime ?? 0) > cutoff
    )
    .sort((a, b) => (b.eventTime ?? 0) - (a.eventTime ?? 0))[0];

  if (cached?.data?.summary || cached?.data?.aiSummary) {
    const summaryText = cached.data.summary || cached.data.aiSummary;
    const suggestedReply = cached.data.suggestedReply || null;
    console.log('[EmailSlice] Loaded AI summary from JDS cache for message', messageId);
    dispatch(setAiEnrichment({ summary: summaryText, suggestedReply, source: 'jds-cache' }));
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
  if (!interactionId || !customerEmail) return;

  const { accesstoken, workspaceid, datacenter } = widget;
  if (!accesstoken || !workspaceid) return;

  const ttl = widget.emailConfig?.aiSummaryTtlMs ?? DEFAULT_AI_SUMMARY_TTL_MS;
  const cutoff = Date.now() - ttl;

  // Match only by taskId (globally unique UUID). Do NOT check ev.identity — JDS events
  // are sometimes stored with the agent email instead of the customer email, which
  // would cause a miss if we required identity === customerEmail.
  const findByTaskId = (events) =>
    events
      .filter((ev) =>
        ev.data?.taskId === interactionId &&
        (ev.raw?.eventTime ?? ev.eventTime ?? 0) > cutoff
      )
      .sort((a, b) => (b.raw?.eventTime ?? b.eventTime ?? 0) - (a.raw?.eventTime ?? a.eventTime ?? 0))[0];

  try {
    // Primary: compound FIQL AND (identity + type). Confirmed working in JDS.
    // Returns only this customer's ai-summary events — much cheaper than workspace-wide.
    const primaryFilter = `identity==${customerEmail};type==email:ai-summary`;
    const primaryEvents = await fetchJourneyEvents(null, accesstoken, workspaceid, datacenter, primaryFilter, 1);
    let cached = findByTaskId(primaryEvents);

    // Fallback: workspace-wide type query. Handles events stored with the wrong identity
    // (e.g. agent email instead of customer email). Match by taskId alone.
    if (!cached?.data?.summary && !cached?.data?.aiSummary) {
      console.log('[EmailSlice] fetchJdsAiSummary: primary identity query missed, trying workspace fallback');
      const fallbackEvents = await fetchJourneyEvents(null, accesstoken, workspaceid, datacenter, 'type==email:ai-summary', 1);
      cached = findByTaskId(fallbackEvents);
    }

    if (cached?.data?.summary || cached?.data?.aiSummary) {
      const summaryText = cached.data.summary || cached.data.aiSummary;
      const suggestedReply = cached.data.suggestedReply || null;
      console.log('[EmailSlice] Loaded AI summary from JDS cache for task', interactionId);
      dispatch(setAiEnrichment({ summary: summaryText, suggestedReply, source: 'jds-cache' }));
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
  dispatch(setIsFetchingAiDraft(true));
  dispatch(setAiProofreadResult(null));
  try {
    const provider = createAiProvider(cfg.type || 'mock', cfg);
    const result = await provider.proofread(currentDraft, locale);
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
  dispatch(setAiReplyDraft(substituted));
  if (tpl.subject) {
    // Subject override is informational — no Redux field for it yet, just log
    console.log('[EmailSlice] Template subject:', tpl.subject);
  }
};

export const sendEmailReply = (payload) => async (dispatch, getState) => {
  dispatch(setIsSending(true));
  dispatch(setSendResult(null));

  try {
    // Ensure we have a valid Gmail token with send permissions.
    // Force a fresh token for every send — the cached token may have been obtained
    // with the old gmail.readonly scope before the Cloud Function was redeployed
    // with https://mail.google.com/ scope.
    const token = await dispatch(fetchGmailToken());
    if (!token) {
      dispatch(setIsSending(false));
      dispatch(setSendResult({ success: false, error: 'email.error.noToken' }));
      return;
    }

    const sentMessage = await apiSendEmailViaGmail(token, payload);
    console.log('[EmailSlice] Gmail send success:', sentMessage.id, 'thread:', sentMessage.threadId);

    dispatch(setIsSending(false));
    dispatch(setSendResult({ success: true, messageId: sentMessage.id }));

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
    if (taskMatch) {
      const summaryText = event.data.aiSummary || event.data.summary || null;
      const suggestedReply = event.data.suggestedReply || null;
      if (summaryText || suggestedReply) {
        console.log('[EmailSlice] SSE ai-summary: updating aiEnrichment for task', activeId);
        // Merge with any existing enrichment (e.g. category/sentiment from CAD)
        const existing = emailState.aiEnrichment || {};
        dispatch(setAiEnrichment({
          ...existing,
          summary: summaryText || existing.summary || null,
          suggestedReply: suggestedReply || existing.suggestedReply || null,
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
    }
  } catch (err) {
    console.error('[EmailSlice] fetchInteractionSummary error:', err);
  }
};

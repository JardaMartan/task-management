import { createSlice } from '@reduxjs/toolkit';
import {
  subscribeToCustomerEvents,
  fetchGmailToken as apiFetchGmailToken,
  fetchEmailThread as apiFetchEmailThread,
  fetchCustomerEmailThreads as apiFetchCustomerEmailThreads,
  sendEmailViaWebexConnect as apiSendEmailViaWebexConnect,
  fetchJourneyEvents,
} from '../../api';
import { createAiProvider } from '../../ai/aiProvider';

// Non-serializable refs stored outside Redux (per State Serialization Discipline)
let emailSseUnsubscribe = null;
let sendTimeoutTimer = null;

// ─── Helpers ───────────────────────────────────────────────────────────────

const generateCorrelationId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

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
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc'),
    subject: getHeader('Subject'),
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
  activeEmail: null,
  thread: [],
  customerThreads: [],
  customerHistory: [],
  aiEnrichment: null,
  aiReplyDraft: '',
  templates: [],
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
    setActiveEmail: (state, action) => {
      state.activeEmail = action.payload;
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
    setAiEnrichment: (state, action) => {
      state.aiEnrichment = action.payload;
    },
    setAiReplyDraft: (state, action) => {
      state.aiReplyDraft = action.payload;
    },
    setTemplates: (state, action) => {
      state.templates = action.payload;
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
    setMockEmailData: (state) => {
      const bodyHtml = `
        <div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;">
          <p>Hello Support Team,</p>
          <p>I am writing to urgently follow up on the payment processing failure for
            <strong>Invoice #INV-2024-0892</strong> ($12,500.00). This is now our
            <strong>third attempt</strong> to resolve this issue and the payment has
            still not cleared our account.</p>
          <p>The payment was originally initiated on <strong>29 May 2025</strong> via
            SEPA transfer (ref: SEPA-20250529-8821). Our finance team has confirmed
            the funds were debited from our account, yet your system shows no record
            of the transaction.</p>
          <ul>
            <li>Invoice number: INV-2024-0892</li>
            <li>Amount: $12,500.00</li>
            <li>IBAN: DE89 3704 0044 0532 0130 00</li>
            <li>Reference: SEPA-20250529-8821</li>
          </ul>
          <p>Please treat this as a <strong>priority case</strong>. I am attaching the
            original invoice and bank confirmation for your reference.</p>
          <p>Best regards,<br/>Sarah Johnson<br/>Finance Manager, ACME Corp</p>
        </div>`;

      const msg1 = {
        messageId: 'mock-msg-001',
        threadId: 'mock-thread-001',
        from: 'Sarah Johnson <sarah.j@acme-corp.com>',
        to: 'support@moneta-bank.com',
        cc: 'john.doe@acme-corp.com',
        subject: 'Urgent: Invoice #INV-2024-0892 — Payment Not Processed',
        date: 'Thu, 5 Jun 2025 14:22',
        snippet: 'This is our third attempt to resolve the payment failure for Invoice #INV-2024-0892 ($12,500.00). SEPA ref: SEPA-20250529-8821.',
        bodyHtml,
        bodyText: '',
        attachments: [
          { attachmentId: 'mock-att-1', filename: 'invoice_INV-2024-0892.pdf', mimeType: 'application/pdf', size: 45820 },
          { attachmentId: 'mock-att-2', filename: 'bank_confirmation_SEPA.pdf', mimeType: 'application/pdf', size: 23440 },
        ],
      };

      const msg2 = {
        messageId: 'mock-msg-000',
        threadId: 'mock-thread-001',
        from: 'Support Team <support@moneta-bank.com>',
        to: 'sarah.j@acme-corp.com',
        cc: '',
        subject: 'Re: Invoice #INV-2024-0892 — Payment Not Processed',
        date: 'Wed, 4 Jun 2025 10:05',
        snippet: 'Dear Sarah, we have received your query and our payments team is looking into this matter. We will update you within 24 hours.',
        bodyHtml: '<p>Dear Sarah,</p><p>We have received your query and our payments team is looking into this. We will update you within 24 hours.</p><p>Kind regards,<br/>Moneta Bank Support</p>',
        bodyText: '',
        attachments: [],
      };

      const msg3 = {
        messageId: 'mock-msg-002',
        threadId: 'mock-thread-001',
        from: 'Sarah Johnson <sarah.j@acme-corp.com>',
        to: 'support@moneta-bank.com',
        cc: '',
        subject: 'Re: Invoice #INV-2024-0892 — Payment Not Processed',
        date: 'Wed, 4 Jun 2025 16:48',
        snippet: 'Still no update. Can you please escalate this to a supervisor?',
        bodyHtml: '<p>Hi,</p><p>I still have not received an update. Can you please escalate this to a supervisor? We cannot close our books until this is resolved.</p><p>Sarah</p>',
        bodyText: '',
        attachments: [],
      };

      state.activeEmail = msg1;
      state.thread = [msg2, msg3, msg1];
      state.aiEnrichment = {
        summary: 'Customer reports repeated payment failure for Invoice #INV-2024-0892 ($12,500). Third follow-up in 5 days. SEPA transfer debited from customer account but not reflected in system. Customer escalating to supervisor level.',
        category: 'Payment Issue',
        sentiment: 'urgent',
        confidence: 0.94,
        suggestedReply: 'Dear Sarah, thank you for your follow-up. I have escalated your case (ref: INC-20250605-4421) to our payments investigation team as a priority. A senior specialist will contact you directly within 2 business hours. We sincerely apologise for the inconvenience and delay.',
        source: 'ai',
      };
      state.aiReplyDraft = '';
      state.customerThreads = [
        { threadId: 'mock-thread-prev', subject: 'Account access issue — resolved', date: 'May 12, 2025', snippet: 'Thank you for your help, the issue is now resolved.' },
      ];
      state.isFetchingToken = false;
      state.isFetchingEmail = false;
      state.error = null;
      state.wrapUp = { submitted: false, reason: '', notes: '' };
    },
  },
});

export const {
  setGmailToken,
  setActiveEmail,
  setThread,
  setCustomerThreads,
  setCustomerHistory,
  setAiEnrichment,
  setAiReplyDraft,
  setTemplates,
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
  setMockEmailData,
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
    let desktopToken = null;
    try {
      const sdk = window.__wxcc_desktop_sdk__;
      if (sdk) {
        desktopToken = await sdk.actions.getToken();
      } else {
        const { Desktop } = await import('@wxcc-desktop/sdk');
        desktopToken = await Desktop.actions.getToken();
      }
    } catch (sdkErr) {
      console.warn('[EmailSlice] Desktop SDK unavailable for token exchange:', sdkErr.message);
      dispatch(setIsFetchingToken(false));
      return null;
    }

    const result = await apiFetchGmailToken(tokenBrokerUrl, desktopToken);
    if (result?.gmailToken) {
      dispatch(
        setGmailToken({
          value: result.gmailToken,
          expiresAt: result.expiresAt || Date.now() + 55 * 60 * 1000,
        })
      );
      return result.gmailToken;
    }
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

  if (value && expiresAt && Date.now() < expiresAt - 60_000) {
    return value;
  }
  return dispatch(fetchGmailToken());
};

export const initEmailTask =
  (interactionId, callAssociatedDetails) => async (dispatch, getState) => {
    dispatch(setIsFetchingEmail(true));
    dispatch(setError(null));

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

    const threadId = callAssociatedDetails?.threadId || null;
    const customerEmail =
      callAssociatedDetails?.fromAddress ||
      callAssociatedDetails?.from ||
      callAssociatedDetails?.customerEmail ||
      null;

    const token = await dispatch(ensureGmailToken());

    if (!token) {
      dispatch(setIsFetchingEmail(false));
      return;
    }

    const { widget } = getState();
    const { accesstoken, workspaceid, datacenter } = widget;

    // Parallel data fetches
    await Promise.all([
      threadId ? dispatch(fetchEmailThread(threadId)) : Promise.resolve(),
      customerEmail ? dispatch(fetchCustomerThreads(customerEmail)) : Promise.resolve(),
      customerEmail && accesstoken && workspaceid
        ? dispatch(fetchCustomerJdsHistory(customerEmail, accesstoken, workspaceid, datacenter))
        : Promise.resolve(),
    ]);

    // Subscribe to JDS SSE for async send-result events
    if (customerEmail && accesstoken && workspaceid) {
      if (emailSseUnsubscribe) {
        emailSseUnsubscribe();
      }
      emailSseUnsubscribe = subscribeToCustomerEvents(
        customerEmail,
        accesstoken,
        workspaceid,
        datacenter,
        (event) => dispatch(handleSseEvent(event)),
        (err) => console.error('[EmailSlice] SSE error:', err)
      );
    }

    dispatch(setIsFetchingEmail(false));
  };

export const fetchEmailThread = (threadId) => async (dispatch, getState) => {
  const token = await dispatch(ensureGmailToken());
  if (!token) return;

  try {
    const threadData = await apiFetchEmailThread(threadId, token);
    if (!threadData) return;

    const messages = (threadData.messages || []).map((msg) => parseGmailMessage(msg));
    dispatch(setThread(messages));

    if (messages.length > 0) {
      dispatch(setActiveEmail(messages[messages.length - 1]));
    }
  } catch (err) {
    console.error('[EmailSlice] fetchEmailThread error:', err);
  }
};

export const fetchCustomerThreads = (customerEmail) => async (dispatch) => {
  const token = await dispatch(ensureGmailToken());
  if (!token) return;

  try {
    const data = await apiFetchCustomerEmailThreads(customerEmail, token);
    const threads = (data?.threads || []).map((t) => ({
      threadId: t.id,
      snippet: t.snippet || '',
      historyId: t.historyId || null,
    }));
    dispatch(setCustomerThreads(threads));
  } catch (err) {
    console.error('[EmailSlice] fetchCustomerThreads error:', err);
  }
};

export const fetchCustomerJdsHistory =
  (identity, accessToken, workspaceId, datacenter) => async (dispatch) => {
    try {
      const events = await fetchJourneyEvents(identity, accessToken, workspaceId, datacenter);
      dispatch(setCustomerHistory(events || []));
    } catch (err) {
      console.error('[EmailSlice] fetchCustomerJdsHistory error:', err);
    }
  };

export const refreshAiEnrichment = () => async (dispatch, getState) => {
  const { email, widget } = getState();
  const aiConfig = widget.emailConfig?.aiProvider;

  if (!aiConfig) {
    console.warn('[EmailSlice] AI provider not configured');
    return;
  }

  const { thread, customerHistory } = email;
  const threadText = thread
    .map((m) => `From: ${m.from}\nDate: ${m.date}\n\n${m.bodyText || m.snippet}`)
    .join('\n---\n');

  try {
    const provider = createAiProvider(aiConfig.type || 'mock', aiConfig);
    const result = await provider.summarize(threadText, customerHistory);
    dispatch(setAiEnrichment({ ...result, source: 'ai' }));
  } catch (err) {
    console.error('[EmailSlice] refreshAiEnrichment error:', err);
  }
};

export const generateAiReply = (instruction, tone) => async (dispatch, getState) => {
  const { email, widget } = getState();
  const aiConfig = widget.emailConfig?.aiProvider;

  if (!aiConfig) return;

  const { thread, aiEnrichment } = email;

  dispatch(setIsFetchingAiDraft(true));
  try {
    const provider = createAiProvider(aiConfig.type || 'mock', aiConfig);
    const result = await provider.generateReply({ thread, aiEnrichment }, instruction, tone);
    dispatch(setAiReplyDraft(result.replyHtml || result.replyText || ''));
  } catch (err) {
    console.error('[EmailSlice] generateAiReply error:', err);
  } finally {
    dispatch(setIsFetchingAiDraft(false));
  }
};

export const improveAiDraft = (currentDraft, instruction) => async (dispatch, getState) => {
  const { widget } = getState();
  const aiConfig = widget.emailConfig?.aiProvider;

  if (!aiConfig) return;

  dispatch(setIsFetchingAiDraft(true));
  try {
    const provider = createAiProvider(aiConfig.type || 'mock', aiConfig);
    const result = await provider.improveText(currentDraft, instruction);
    dispatch(setAiReplyDraft(result.improvedHtml || result.improvedText || currentDraft));
  } catch (err) {
    console.error('[EmailSlice] improveAiDraft error:', err);
  } finally {
    dispatch(setIsFetchingAiDraft(false));
  }
};

export const sendEmailReply = (payload) => async (dispatch, getState) => {
  const { widget } = getState();
  const webhookUrl = widget.emailConfig?.webexConnectOutboundWebhook;

  if (!webhookUrl) {
    dispatch(setError('email.error.noWebhookUrl'));
    return;
  }

  const correlationId = generateCorrelationId();
  dispatch(setIsSending(true));
  dispatch(setSendResult(null));
  dispatch(setPendingCorrelationId(correlationId));

  if (sendTimeoutTimer) clearTimeout(sendTimeoutTimer);

  sendTimeoutTimer = setTimeout(() => {
    dispatch(setIsSending(false));
    dispatch(setSendResult({ success: false, timeout: true }));
    dispatch(clearPendingCorrelationId());
    sendTimeoutTimer = null;
  }, 30_000);

  try {
    await apiSendEmailViaWebexConnect(webhookUrl, {
      ...payload,
      correlationId,
      orgId: widget.orgid,
      workspaceId: widget.workspaceid,
    });
    // Confirmed via SSE; isSending clears in handleSseEvent
  } catch (err) {
    clearTimeout(sendTimeoutTimer);
    sendTimeoutTimer = null;
    console.error('[EmailSlice] sendEmailReply error:', err);
    dispatch(setIsSending(false));
    dispatch(setSendResult({ success: false, error: err.message }));
    dispatch(clearPendingCorrelationId());
  }
};

export const handleSseEvent = (event) => (dispatch, getState) => {
  if (event?.type !== 'custom:email.sent.result') return;

  const { email } = getState();
  if (event.data?.correlationId !== email.pendingCorrelationId) return;

  if (sendTimeoutTimer) {
    clearTimeout(sendTimeoutTimer);
    sendTimeoutTimer = null;
  }

  dispatch(setIsSending(false));
  dispatch(
    setSendResult({
      success: event.data.success,
      messageId: event.data.sentMessageId || null,
      error: event.data.errorMessage || null,
    })
  );
  dispatch(clearPendingCorrelationId());
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
  const sdk = widget.desktopSDK;

  if (!sdk) {
    console.warn('[EmailSlice] Desktop SDK not available for wrapup (demo mode)');
    dispatch(setWrapUp({ submitted: true }));
    return;
  }

  try {
    await sdk.agentContact.endV2({ interactionId });
    await sdk.agentContact.wrapupV2({
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

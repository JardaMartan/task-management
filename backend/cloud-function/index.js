'use strict';

const functions = require('@google-cloud/functions-framework');
const { fetchInboundEmail, watchGmailInbox } = require('./gmail');
const { enrichEmailWithAi } = require('./ai');
const { mintGmailToken, mintGeminiToken, verifyWebexIdentity } = require('./token-broker');

// ─── Health ───────────────────────────────────────────────────────────────────

functions.http('health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Inbound: Gmail Pub/Sub push → Webex Connect ──────────────────────────────
/**
 * Receives a Gmail push notification via Cloud Pub/Sub HTTP push subscription.
 * Fetches the new message, enriches with AI, then forwards to Webex Connect.
 *
 * Expected body: { message: { data: base64(JSON), messageId, publishTime } }
 */
functions.http('inbound', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const envelope = req.body?.message;
    if (!envelope?.data) {
      console.error('[inbound] Invalid Pub/Sub envelope');
      return res.status(400).send('Invalid Pub/Sub envelope');
    }

    const notification = JSON.parse(
      Buffer.from(envelope.data, 'base64').toString('utf8')
    );

    const { emailAddress, historyId } = notification;
    if (!emailAddress || !historyId) {
      console.warn('[inbound] Missing emailAddress or historyId in notification');
      return res.status(200).send('ack'); // ACK to avoid redelivery of malformed messages
    }

    // Fetch new messages from Gmail using historyId
    const messages = await fetchInboundEmail(emailAddress, historyId);
    if (!messages || messages.length === 0) {
      return res.status(200).send('ack'); // Nothing new
    }

    const webexConnectUrl = process.env.WEBEX_CONNECT_INBOUND_WEBHOOK;
    if (!webexConnectUrl) {
      throw new Error('WEBEX_CONNECT_INBOUND_WEBHOOK env var not set');
    }

    // Process each new inbound message
    await Promise.all(
      messages.map(async (msg) => {
        const aiEnrichment = await enrichEmailWithAi(msg).catch((err) => {
          console.warn('[inbound] AI enrichment failed:', err.message);
          return null;
        });

        const payload = buildWebexConnectPayload(msg, aiEnrichment);

        const response = await fetch(webexConnectUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[inbound] Webex Connect forward failed ${response.status}: ${text}`);
        } else {
          console.log(`[inbound] Forwarded message ${msg.messageId} to Webex Connect`);
        }
      })
    );

    return res.status(200).send('ack');
  } catch (err) {
    console.error('[inbound] Error:', err);
    return res.status(500).send('Internal error');
  }
});

// ─── Auth: Token Broker ───────────────────────────────────────────────────────
/**
 * Validates the agent's Webex CI token, then mints a Gmail service-account token.
 * Required header: Authorization: Bearer <webex-ci-token>
 * Returns: { gmailToken: string, expiresAt: number (ms epoch) }
 */
functions.http('auth', async (req, res) => {
  // CORS preflight
  res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const desktopToken = authHeader.slice('Bearer '.length).trim();

  try {
    // Verify the agent's Webex CI identity
    const identity = await verifyWebexIdentity(desktopToken);
    if (!identity) {
      return res.status(401).json({ error: 'Invalid Webex token' });
    }

    // Mint Gmail token (DWD, support inbox) and Gemini token (service account)
    // in parallel — both come from the same service account key.
    const [gmailResult, geminiResult] = await Promise.all([
      mintGmailToken(),
      mintGeminiToken().catch((err) => {
        // Gemini token is optional — Gmail can still work without it
        console.warn('[auth] Gemini token mint failed (AI features will be unavailable):', err.message);
        return null;
      }),
    ]);

    const responsePayload = {
      gmailToken: gmailResult.gmailToken,
      expiresAt: gmailResult.expiresAt,
    };
    if (geminiResult?.geminiToken) {
      responsePayload.geminiToken = geminiResult.geminiToken;
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('[auth] Token broker error:', err);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
});

// ─── Watch renewal: keep Gmail push subscription alive ────────────────────────
/**
 * Called by Cloud Scheduler daily to renew Gmail watch() subscription.
 */
functions.http('renewWatch', async (req, res) => {
  try {
    const emailAddress = process.env.SUPPORT_EMAIL;
    if (!emailAddress) throw new Error('SUPPORT_EMAIL env var not set');

    await watchGmailInbox(emailAddress);
    console.log(`[renewWatch] Gmail watch renewed for ${emailAddress}`);
    return res.status(200).json({ renewed: true });
  } catch (err) {
    console.error('[renewWatch] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWebexConnectPayload(msg, aiEnrichment) {
  const attachmentsJson = JSON.stringify(
    (msg.attachments || []).map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      attachmentId: a.attachmentId,
      messageId: msg.messageId,
    }))
  );

  return {
    // Core identifiers — all three are usable by the widget to locate the email in Gmail.
    // gmailMessageId and gmailThreadId are direct; rfcMessageId enables rfc822msgid: search.
    gmailMessageId: msg.messageId,
    gmailThreadId: msg.threadId,
    rfcMessageId: msg.rfcMessageId || '',
    // Addressing
    fromAddress: msg.from,
    toAddress: msg.to,
    ccAddress: msg.cc || '',
    subject: msg.subject,
    date: msg.date,
    snippet: msg.snippet || '',
    // AI enrichment (pre-populated CAD variables)
    aiSummary: aiEnrichment?.summary || '',
    aiCategory: aiEnrichment?.category || '',
    aiSentiment: aiEnrichment?.sentiment || '',
    aiConfidence: aiEnrichment?.confidence?.toString() || '',
    aiSuggestedReply: aiEnrichment?.suggestedReply || '',
    // Attachments as JSON string (Webex Connect CAD limitation)
    attachmentsJson,
    hasAttachments: (msg.attachments || []).length > 0 ? 'true' : 'false',
    // Body in plain text for Webex Connect flow variables
    bodyText: (msg.bodyText || '').slice(0, 4000),
  };
}

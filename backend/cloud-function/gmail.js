'use strict';

const { google } = require('googleapis');

/**
 * Returns an authenticated Gmail API client using the service account
 * with Domain-Wide Delegation (DWD) impersonating the support inbox.
 */
const getGmailClient = (emailToImpersonate) => {
  const auth = new google.auth.GoogleAuth({
    // Credentials loaded from GOOGLE_APPLICATION_CREDENTIALS env var or default ADC
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    clientOptions: {
      subject: emailToImpersonate || process.env.SUPPORT_EMAIL,
    },
  });

  return google.gmail({ version: 'v1', auth });
};

/**
 * Fetch new inbound messages from Gmail history since a given historyId.
 * Returns an array of parsed message objects.
 *
 * @param {string} emailAddress - The mailbox to check (e.g. support@company.com)
 * @param {string} historyId    - The historyId from the Pub/Sub notification
 * @returns {Promise<Array>}    - Parsed message objects
 */
const fetchInboundEmail = async (emailAddress, historyId) => {
  const gmail = getGmailClient(emailAddress);

  // List history records since last known historyId
  const historyResponse = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: historyId,
    historyTypes: ['messageAdded'],
    labelId: 'INBOX',
  });

  const historyRecords = historyResponse.data.history || [];
  const messageIds = new Set();

  historyRecords.forEach((record) => {
    (record.messagesAdded || []).forEach((entry) => {
      if (entry.message?.id) {
        messageIds.add(entry.message.id);
      }
    });
  });

  if (messageIds.size === 0) return [];

  // Fetch full message details
  const messages = await Promise.all(
    Array.from(messageIds).map(async (id) => {
      try {
        const msgResponse = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'full',
        });
        return parseGmailApiMessage(msgResponse.data);
      } catch (err) {
        console.error(`[gmail] Failed to fetch message ${id}:`, err.message);
        return null;
      }
    })
  );

  return messages.filter(Boolean);
};

/**
 * Renew the Gmail push notification watch subscription.
 * Must be called at least once every 7 days; recommend daily via Cloud Scheduler.
 *
 * @param {string} emailAddress - Mailbox to watch
 */
const watchGmailInbox = async (emailAddress) => {
  const gmail = getGmailClient(emailAddress);
  const topicName = process.env.PUBSUB_TOPIC;

  if (!topicName) throw new Error('PUBSUB_TOPIC env var not set');

  const response = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
      labelFilterBehavior: 'INCLUDE',
    },
  });

  console.log('[gmail] Watch renewed:', response.data);
  return response.data;
};

// ─── Message Parsing ──────────────────────────────────────────────────────────

const getHeader = (headers, name) =>
  (headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

const decodeBase64Url = (data) => {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
};

const extractBodyParts = (payload, result = { html: '', text: '', attachments: [] }) => {
  if (!payload) return result;

  const mimeType = (payload.mimeType || '').toLowerCase();

  if (mimeType === 'text/html' && payload.body?.data) {
    result.html = decodeBase64Url(payload.body.data);
  } else if (mimeType === 'text/plain' && payload.body?.data && !result.text) {
    result.text = decodeBase64Url(payload.body.data);
  } else if (payload.body?.attachmentId) {
    result.attachments.push({
      attachmentId: payload.body.attachmentId,
      filename: payload.filename || '',
      mimeType,
      size: payload.body.size || 0,
    });
  }

  if (Array.isArray(payload.parts)) {
    payload.parts.forEach((part) => extractBodyParts(part, result));
  }

  return result;
};

const parseGmailApiMessage = (msg) => {
  const headers = msg.payload?.headers || [];
  const body = extractBodyParts(msg.payload);

  return {
    messageId: msg.id,
    threadId: msg.threadId,
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    cc: getHeader(headers, 'Cc'),
    subject: getHeader(headers, 'Subject'),
    date: getHeader(headers, 'Date'),
    snippet: msg.snippet || '',
    bodyHtml: body.html,
    bodyText: body.text,
    attachments: body.attachments,
  };
};

module.exports = { fetchInboundEmail, watchGmailInbox };

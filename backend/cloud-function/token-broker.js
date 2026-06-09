'use strict';

const crypto = require('crypto');

const WEBEX_PEOPLE_ME = 'https://webexapis.com/v1/people/me';

/**
 * Verify a Webex CI bearer token by calling /people/me.
 * Returns the identity object on success, null on failure.
 *
 * @param {string} desktopToken - Webex CI token from Desktop SDK
 * @returns {Promise<{ id, emails, displayName, orgId }|null>}
 */
const verifyWebexIdentity = async (desktopToken) => {
  try {
    const response = await fetch(WEBEX_PEOPLE_ME, {
      headers: { Authorization: `Bearer ${desktopToken}` },
    });

    if (!response.ok) {
      console.warn(`[token-broker] Webex identity check failed: ${response.status}`);
      return null;
    }

    const person = await response.json();

    // Basic sanity check
    if (!person?.id || !person?.emails?.length) {
      return null;
    }

    return {
      id: person.id,
      emails: person.emails,
      displayName: person.displayName,
      orgId: person.orgId,
    };
  } catch (err) {
    console.error('[token-broker] verifyWebexIdentity error:', err.message);
    return null;
  }
};

/**
 * Mint a short-lived Google OAuth2 access token from the service account.
 * Re-uses the same JWT assertion pattern for both Gmail (DWD) and Gemini
 * (service-account-as-itself) to avoid duplicating the signing code.
 *
 * @param {string} scope - Google OAuth2 scope URI
 * @param {string|null} subject - Email address to impersonate via DWD, or null
 * @returns {Promise<{ access_token: string, expiresAt: number }>}
 */
const mintServiceAccountToken = async (scope, subject = null) => {
  const saJson = process.env.SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    throw new Error(
      'SERVICE_ACCOUNT_JSON env var not set. ' +
      'Provide the service-account key JSON (with DWD enabled) as this variable.'
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(saJson);
  } catch (err) {
    throw new Error(`SERVICE_ACCOUNT_JSON is not valid JSON: ${err.message}`);
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('SERVICE_ACCOUNT_JSON must contain client_email and private_key');
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';

  const jwtPayload = {
    iss: credentials.client_email,
    scope,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };
  if (subject) jwtPayload.sub = subject; // DWD impersonation (Gmail only)

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');
  const signingInput = `${header}.${payload}`;

  const privateKey = crypto.createPrivateKey({
    key: credentials.private_key,
    format: 'pem',
    type: 'pkcs8',
  });

  const signature = crypto.sign('sha256', Buffer.from(signingInput), privateKey).toString('base64url');
  const assertion = `${signingInput}.${signature}`;

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`No access_token in Google response: ${JSON.stringify(data)}`);
  }

  return {
    access_token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in || 3600) * 1000) - 60_000,
  };
};

/**
 * Mint a short-lived Gmail access token using Domain-Wide Delegation (DWD).
 * The token is issued for the shared support inbox (SUPPORT_EMAIL env var).
 *
 * @returns {Promise<{ gmailToken: string, expiresAt: number }>}
 */
const mintGmailToken = async () => {
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) throw new Error('SUPPORT_EMAIL env var not set');

  const { access_token, expiresAt } = await mintServiceAccountToken(
    // gmail.readonly is not enough for sending. Use full Gmail scope so the
    // same DWD token can both read threads and send replies from the widget.
    'https://mail.google.com/',
    supportEmail,  // DWD: impersonate the support inbox
  );

  return { gmailToken: access_token, expiresAt };
};

/**
 * Mint a short-lived Gemini API access token for the service account itself.
 * No DWD — the service account calls the Gemini API on its own behalf.
 * The frontend uses this as `Authorization: Bearer <token>` instead of an API key.
 *
 * @returns {Promise<{ geminiToken: string, expiresAt: number }>}
 */
const mintGeminiToken = async () => {
  const { access_token, expiresAt } = await mintServiceAccountToken(
    'https://www.googleapis.com/auth/generative-language',
  );

  return { geminiToken: access_token, expiresAt };
};

module.exports = { verifyWebexIdentity, mintGmailToken, mintGeminiToken };

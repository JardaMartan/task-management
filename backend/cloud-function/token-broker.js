'use strict';

const { GoogleAuth } = require('google-auth-library');

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
 * Mint a short-lived Gmail access token using the service account with
 * Domain-Wide Delegation (DWD), scoped to gmail.readonly.
 *
 * The token is issued for the shared support inbox (SUPPORT_EMAIL env var),
 * not for the individual agent — this is correct and intentional.
 *
 * @param {object} _identity - Verified agent identity (unused beyond logging)
 * @returns {Promise<{ gmailToken: string, expiresAt: number }>}
 */
const mintGmailToken = async (_identity) => {
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) {
    throw new Error('SUPPORT_EMAIL env var not set');
  }

  // Use Application Default Credentials (ADC) or GOOGLE_APPLICATION_CREDENTIALS
  // The service account must have DWD enabled for SUPPORT_EMAIL's domain
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    clientOptions: {
      subject: supportEmail,
    },
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  if (!tokenResponse?.token) {
    throw new Error('Failed to obtain Gmail access token from service account');
  }

  // Approximate expiry: service account tokens typically last 1 hour
  const expiresAt = Date.now() + 55 * 60 * 1000; // 55 minutes

  return {
    gmailToken: tokenResponse.token,
    expiresAt,
  };
};

module.exports = { verifyWebexIdentity, mintGmailToken };

'use strict';

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const PORT = process.env.PORT || 3001;

// ── Org-level access control ──────────────────────────────────────────────────
// Comma-separated list of allowed Webex org IDs.
// Empty / unset = allow all connections (suitable for local development).
//
// Accepts EITHER format for each entry:
//   - raw UUID:            fc5af61b-06a3-4122-be5c-bb344cffffdc
//   - Webex hydra base64:  Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi9mYzVh...
//   - unencoded URN:       ciscospark://us/ORGANIZATION/fc5af61b-...
// The Webex /people/me API returns the base64 hydra form, so we normalize both
// the allow-list and the token's orgId down to the bare UUID before comparing.
const ALLOWED_ORG_IDS = (process.env.ALLOWED_ORG_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Reduce any Webex org identifier to its bare lowercase UUID.
 * Handles raw UUIDs, `ciscospark://us/ORGANIZATION/<uuid>` URNs, and the
 * base64-encoded hydra IDs returned by the People API.
 * @param {string} value
 * @returns {string} bare UUID (lowercased) or '' when none can be extracted
 */
function extractOrgUuid(value) {
  if (!value) return '';
  let v = String(value).trim();
  // Base64 hydra id (no scheme, no slash) → decode to the URN form.
  if (!v.includes('://') && !v.includes('/')) {
    try {
      const decoded = Buffer.from(v, 'base64').toString('utf8');
      if (decoded.includes('ORGANIZATION/') || decoded.includes('ciscospark://')) v = decoded;
    } catch { /* not base64 — fall through */ }
  }
  const m = v.match(/ORGANIZATION\/([0-9a-f-]{36})/i) || v.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m ? m[1].toLowerCase() : v.toLowerCase();
}

const ALLOWED_ORG_UUIDS = new Set(ALLOWED_ORG_IDS.map(extractOrgUuid).filter(Boolean));

const orgAuthEnabled = ALLOWED_ORG_UUIDS.size > 0;
if (orgAuthEnabled) {
  console.log(`[relay] Org auth enabled. Allowed org UUIDs: ${[...ALLOWED_ORG_UUIDS].join(', ')}`);
} else {
  console.log('[relay] Org auth disabled (ALLOWED_ORG_IDS not set). All connections accepted.');
}

/**
 * Verify a Webex bearer token by calling /people/me and check that the
 * agent's org is in the allowed list.
 *
 * @param {string} token - Webex CI access token
 * @returns {Promise<{ allowed: boolean, orgId?: string, agentEmail?: string }>}
 */
async function verifyWebexToken(token) {
  if (!orgAuthEnabled) return { allowed: true };
  if (!token) return { allowed: false };

  try {
    const resp = await fetch('https://webexapis.com/v1/people/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      console.warn(`[relay] Webex /people/me returned ${resp.status}`);
      return { allowed: false };
    }

    const person = await resp.json();
    const orgId = person?.orgId;
    const agentEmail = person?.emails?.[0];

    if (!orgId) return { allowed: false };

    const allowed = ALLOWED_ORG_UUIDS.has(extractOrgUuid(orgId));
    if (!allowed) {
      // Log the normalized org UUID for diagnostics but never log the token itself
      console.warn(`[relay] Auth denied: orgUuid=${extractOrgUuid(orgId)} not in allowed list`);
    }
    return { allowed, orgId, agentEmail };
  } catch (err) {
    console.error('[relay] verifyWebexToken error:', err.message);
    return { allowed: false };
  }
}

const app = express();

// Serve CRM Tab Manager static files
app.use('/crm-tab-manager', express.static(path.join(__dirname, '..', 'crm-tab-manager')));

// Serve the CRM Click-to-Contact browser extension (unpacked folder + demo).
// The packaged zip is downloadable from /dist/crm-clicktocall-extension.zip.
app.use('/crm-clicktocall-extension', express.static(path.join(__dirname, '..', 'crm-clicktocall-extension')));

// Serve pre-built headless/header widget JS files
app.use('/dist', express.static(path.join(__dirname, '..', 'dist')));

// Health check
app.get('/health', (_req, res) => {
  let webexccCount = 0;
  let crmCount = 0;
  for (const meta of clients.values()) {
    if (meta.role === 'webexcc') webexccCount++;
    if (meta.role === 'crm') crmCount++;
  }
  res.json({ status: 'ok', clients: { total: clients.size, webexcc: webexccCount, crm: crmCount } });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Map<ws, { id, role, sessionId, orgId?, agentEmail?, authenticated }>
const clients = new Map();
let clientIdCounter = 0;

wss.on('connection', (ws, req) => {
  const id = ++clientIdCounter;
  clients.set(ws, { id, role: null, sessionId: null, authenticated: false });
  console.log(`[relay] Client #${id} connected from ${req.socket.remoteAddress}`);

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn(`[relay] Client #${id} sent non-JSON`);
      return;
    }

    const meta = clients.get(ws);

    // ── REGISTER ────────────────────────────────────────────────────────────
    if (msg.type === 'REGISTER') {
      const role = msg.role;
      const sessionId = msg.sessionId || '';

      if (role === 'webexcc') {
        // Validate Webex token and org membership
        const { allowed, orgId, agentEmail } = await verifyWebexToken(msg.accessToken);
        if (!allowed) {
          console.warn(`[relay] Client #${id} rejected (org not authorized)`);
          ws.close(4001, 'Unauthorized');
          clients.delete(ws);
          return;
        }

        meta.role = 'webexcc';
        meta.sessionId = sessionId;
        meta.authenticated = true;
        if (orgId) meta.orgId = orgId;
        if (agentEmail) meta.agentEmail = agentEmail;

        console.log(`[relay] Client #${id} registered as webexcc | session=${sessionId}${orgId ? ' | org=' + orgId : ''}`);
        ws.send(JSON.stringify({ type: 'REGISTERED', role: 'webexcc' }));

      } else if (role === 'crm') {
        // CRM clients are trusted if a webexcc client with the same sessionId
        // is already connected and authenticated.
        const matchingWebexcc = [...clients.values()].find(
          (c) => c.role === 'webexcc' && c.sessionId === sessionId && c.authenticated,
        );

        if (orgAuthEnabled && !matchingWebexcc) {
          console.warn(`[relay] CRM client #${id} rejected — no authenticated webexcc session for sessionId=${sessionId}`);
          ws.close(4002, 'Session not authorized');
          clients.delete(ws);
          return;
        }

        meta.role = 'crm';
        meta.sessionId = sessionId;
        meta.authenticated = true;

        console.log(`[relay] Client #${id} registered as crm | session=${sessionId}`);
        ws.send(JSON.stringify({ type: 'REGISTERED', role: 'crm' }));

        // Notify same-session webexcc clients so they can re-flush interaction state.
        for (const [clientWs, clientMeta] of clients.entries()) {
          if (
            clientMeta.role === 'webexcc' &&
            clientMeta.sessionId === sessionId &&
            clientWs.readyState === WebSocket.OPEN
          ) {
            clientWs.send(JSON.stringify({ type: 'CRM_CLIENT_CONNECTED' }));
          }
        }
      }
      return;
    }

    // ── HEARTBEAT ───────────────────────────────────────────────────────────
    if (msg.type === 'HEARTBEAT') {
      ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK' }));
      return;
    }

    // ── Message forwarding (session-scoped) ─────────────────────────────────
    if (!meta.role || !meta.sessionId) {
      console.warn(`[relay] Client #${id} sent ${msg.type} before REGISTER — ignored`);
      return;
    }

    const targetRole = meta.role === 'webexcc' ? 'crm' : 'webexcc';
    console.log(`[relay] #${id} (${meta.role}, session=${meta.sessionId}) → ${targetRole}: ${msg.type}`);

    let forwarded = 0;
    for (const [clientWs, clientMeta] of clients.entries()) {
      if (
        clientMeta.role === targetRole &&
        clientMeta.sessionId === meta.sessionId &&
        clientWs.readyState === WebSocket.OPEN
      ) {
        clientWs.send(JSON.stringify(msg));
        forwarded++;
      }
    }

    if (forwarded === 0) {
      console.warn(`[relay] No ${targetRole} clients for session=${meta.sessionId} to receive ${msg.type}`);
    }
  });

  ws.on('close', () => {
    const meta = clients.get(ws);
    console.log(`[relay] Client #${meta?.id} (${meta?.role || 'unregistered'}, session=${meta?.sessionId || '-'}) disconnected`);
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error(`[relay] Client #${id} error: ${err.message}`);
  });
});

server.listen(PORT, () => {
  console.log(`\n[relay] ✓ Relay server running`);
  console.log(`[relay]   HTTP:       http://localhost:${PORT}`);
  console.log(`[relay]   WebSocket:  ws://localhost:${PORT}`);
  console.log(`[relay]   Tab Manager: http://localhost:${PORT}/crm-tab-manager/\n`);
});

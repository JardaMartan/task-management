'use strict';

const zlib = require('zlib');
const functions = require('@google-cloud/functions-framework');
const { fetchInboundEmail, watchGmailInbox } = require('./gmail');
const { enrichEmailWithAi } = require('./ai');
const { mintGmailToken, mintGeminiToken, verifyWebexIdentity } = require('./token-broker');
const { ingestEvents, queryAgentEvents, queryTeamEvents, queryAgents } = require('./activity');
const { queryAgentState, queryTeamState, queryAgentRoster, queryTaskContacts } = require('./agent-state');
const { queryTeams, queryUsers, loadDirectory, canonicalUser, resolveAgentIds } = require('./config-api');

/**
 * Send JSON, gzip-compressed when the client supports it. Activity/state JSON is
 * large and highly repetitive (segment/event arrays) → gzip cuts it ~85-90%,
 * slashing transfer + client receive time. Small bodies are sent as-is.
 */
function sendJson(req, res, obj, status = 200) {
  const json = JSON.stringify(obj);
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.set('Vary', 'Accept-Encoding');
  if (json.length > 1024 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
    const buf = zlib.gzipSync(json);
    res.set('Content-Encoding', 'gzip');
    return res.status(status).send(buf);
  }
  return res.status(status).send(json);
}

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

// ─── Activity analytics: ingest + query ───────────────────────────────────────
/**
 * Agent activity timeline endpoint.
 *   POST /activity            — ingest a batch of activity events { events: [...] }
 *   GET  /activity?agentId=…&from=…&to=…  — query an agent's historical events
 *
 * Called by the browser (headless widget emitter + reporting widget), so CORS
 * is enabled. POC auth: the emitter forwards the agent's Webex token as a Bearer
 * header; production should verify it via verifyWebexIdentity before persisting.
 */
functions.http('activity', async (req, res) => {
  res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    if (req.method === 'POST') {
      const events = req.body?.events;
      if (!Array.isArray(events)) {
        return res.status(400).json({ error: 'Body must be { events: [...] }' });
      }
      const result = await ingestEvents(events);
      return res.status(200).json(result);
    }

    if (req.method === 'GET') {
      const { agentId, from, to, limit, agents, days, team, state, teams } = req.query || {};
      // Teams: GET /activity?teams=1 → AGENT teams (Webex CC Config API) so the
      // supervisor can pick a real team to scope the roster / team view.
      if (teams) {
        const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
        const { orgId, datacenter } = req.query;
        const list = await queryTeams({ accessToken, datacenter, orgId }).catch(() => []);
        return res.status(200).json({ teams: list });
      }
      // Roster: GET /activity?agents=1 → agents that have events (BigQuery) or
      // Webex CC agent-state data, so the picker lists real, queryable agents.
      // Names + team membership are resolved from the Config API (v2/user).
      //   &teamId=…  → list ALL members of that team (even with no activity yet).
      if (agents) {
        const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
        const { datacenter, orgId, teamId } = req.query;
        const [bqAgents, webexAgents, dir] = await Promise.all([
          queryAgents({ days, from, to }).catch(() => []),
          queryAgentRoster({ accessToken, datacenter, days, from, to }).catch(() => []),
          loadDirectory({ accessToken, datacenter, orgId }).catch(() => ({ byId: new Map(), byCi: new Map(), users: [] })),
        ]);
        const users = dir.users || [];
        // Collapse an id (WxCC user id OR Desktop CI id) to its canonical entry.
        const canon = (id) => {
          const u = canonicalUser(dir, id);
          return u
            ? { id: u.id, name: u.name, teamIds: u.teamIds }
            : { id, name: `Agent ${String(id).slice(0, 8)}`, teamIds: [] };
        };
        let roster;
        if (teamId) {
          // Every member of the picked team — resolved names, regardless of activity.
          roster = users
            .filter((u) => Array.isArray(u.teamIds) && u.teamIds.includes(teamId))
            .map((u) => ({ id: u.id, name: u.name, teamIds: u.teamIds }));
        } else {
          // Agents with recent activity (BigQuery + Webex sessions), name-resolved
          // and de-duplicated across the user-id / CI-id spaces.
          const map = new Map();
          for (const a of bqAgents) if (a && a.id) { const c = canon(a.id); if (!map.has(c.id)) map.set(c.id, c); }
          for (const a of webexAgents) if (a && a.id) { const c = canon(a.id); if (!map.has(c.id)) map.set(c.id, c); }
          roster = [...map.values()];
        }
        roster.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return res.status(200).json({ agents: roster });
      }
      // Agent state / idle breakdown (sourced from Webex CC, not our DB).
      //   GET /activity?state=1&agentId=…            → one agent
      //   GET /activity?state=1&team=1&agentId=a,b,c → team (comma list)
      if (state) {
        const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
        const { orgId, datacenter } = req.query;
        if (team) {
          const agentIds = String(agentId || '').split(',').map((s) => s.trim()).filter(Boolean);
          const states = await queryTeamState({ agentIds, from, to, accessToken, orgId, datacenter });
          return sendJson(req, res, { states });
        }
        const agentState = await queryAgentState({ agentId, from, to, accessToken, orgId, datacenter });
        return sendJson(req, res, { state: agentState });
      }
      // Team occupancy: GET /activity?team=1 → all agents' events in range.
      if (team) {
        const rows = await queryTeamEvents({ from, to, limit });
        // Interaction events are tagged with the Desktop CI id; remap to the
        // canonical WxCC user id so they line up with the roster + agent-state
        // (which key on user id) in the team view.
        const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
        const { orgId, datacenter } = req.query;
        if (accessToken && orgId) {
          try {
            const dir = await loadDirectory({ accessToken, datacenter, orgId });
            for (const r of rows) {
              const u = canonicalUser(dir, r.agent_id);
              if (u) r.agent_id = u.id;
            }
          } catch (e) {
            console.warn('[activity] team id remap failed:', e.message);
          }
        }
        return sendJson(req, res, { count: rows.length, events: rows });
      }
      if (!agentId) {
        return res.status(400).json({ error: 'agentId query param is required' });
      }
      // The emitter tags events with the Desktop CI id while the picker selects a
      // WxCC user id — resolve both id variants so the query matches either.
      const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
      const { orgId, datacenter } = req.query;
      let agentIds = [agentId];
      if (accessToken && orgId) {
        try {
          const dir = await loadDirectory({ accessToken, datacenter, orgId });
          const resolved = resolveAgentIds(dir, agentId);
          if (resolved.length) agentIds = resolved;
        } catch (e) {
          console.warn('[activity] id resolution failed, using raw agentId:', e.message);
        }
      }
      const rows = await queryAgentEvents({ agentIds, from, to, limit });
      // Augment (display only — NOT stored) with the customer contact resolved
      // live from the Search API, so no customer PII lives in our event store.
      try {
        const ids = [...new Set(rows.map((r) => r.interaction_id).filter(Boolean))];
        const contacts = await queryTaskContacts({ interactionIds: ids, from, to, accessToken, datacenter });
        for (const r of rows) { const c = contacts[r.interaction_id]; if (c) r.customer_contact = c.contact; }
      } catch (e) {
        console.warn('[activity] contact augmentation failed:', e.message);
      }
      return sendJson(req, res, { agentId, count: rows.length, events: rows });
    }

    return res.status(405).send('Method Not Allowed');
  } catch (err) {
    console.error('[activity] Error:', err);
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

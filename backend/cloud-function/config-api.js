'use strict';

/**
 * config-api.js
 *
 * Webex Contact Center Configuration (Management) API source.
 *
 * The Search API (agent-state.js) supplies state / activity but carries NO agent
 * names and NO team membership. The Config API fills that gap:
 *   • Teams:  GET /organization/{orgId}/v2/team  → { id, name, teamType, userIds }
 *   • Users:  GET /organization/{orgId}/v2/user  → { id, firstName, lastName, teamIds }
 *
 * Verified (wxcc-eu1): the Config `user.id` is the SAME identifier as the Search
 * API `agentSession.agentId`, so names/teams line up 1:1 with state + events.
 *
 * Both endpoints are paginated: { meta: { page, pageSize, totalPages }, data: [] }.
 * On any failure the functions return [] so the widget degrades gracefully.
 *
 * Env override: WEBEX_CC_API_HOST (shared with agent-state.js via resolveHost).
 */

const { resolveHost } = require('./agent-state');

const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap (~5000 records) against runaway pagination

async function fetchAllPages({ host, path, accessToken }) {
  const out = [];
  let page = 0;
  let totalPages = 1;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${host}${path}${sep}page=${page}&pageSize=${PAGE_SIZE}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`config HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    const data = Array.isArray(body) ? body : (body.data || []);
    for (const row of data) out.push(row);
    totalPages = (body && body.meta && Number(body.meta.totalPages)) || 1;
    page += 1;
  } while (page < totalPages && page < MAX_PAGES);
  return out;
}

/**
 * List AGENT teams for the org.
 * @returns {Promise<Array<{id:string, name:string, memberCount:number, userIds:string[]}>>}
 */
async function queryTeams({ accessToken, datacenter, orgId }) {
  const host = resolveHost(datacenter);
  if (!accessToken || !host || !orgId) {
    console.log('[config-api] teams not configured (token/host/orgId missing)');
    return [];
  }
  try {
    const rows = await fetchAllPages({ host, path: `/organization/${orgId}/v2/team`, accessToken });
    return rows
      .filter((t) => t && t.id && (t.teamType ? t.teamType === 'AGENT' : true))
      .map((t) => ({
        id: t.id,
        name: t.name || `Team ${String(t.id).slice(0, 8)}`,
        memberCount: Array.isArray(t.userIds) ? t.userIds.length : 0,
        userIds: Array.isArray(t.userIds) ? t.userIds : [],
      }))
      .filter((t) => t.memberCount > 0) // hide empty teams — nothing to show for them
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.warn('[config-api] queryTeams failed:', err.message);
    return [];
  }
}

/**
 * List contact-center users (agents) with resolved names + team membership.
 * `id` is the WxCC user id (matches Search agentSession.agentId); `ciUserId` is
 * the Common Identity id (matches the Desktop `$STORE.agent.agentId` used by the
 * activity emitter, i.e. the agent_id stored in BigQuery events).
 * @returns {Promise<Array<{id:string, name:string, teamIds:string[], ciUserId:string|null}>>}
 */
async function queryUsers({ accessToken, datacenter, orgId }) {
  const host = resolveHost(datacenter);
  if (!accessToken || !host || !orgId) {
    console.log('[config-api] users not configured (token/host/orgId missing)');
    return [];
  }
  try {
    const rows = await fetchAllPages({ host, path: `/organization/${orgId}/v2/user`, accessToken });
    return rows
      .filter((u) => u && u.id)
      .map((u) => ({
        id: u.id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || `Agent ${String(u.id).slice(0, 8)}`,
        teamIds: Array.isArray(u.teamIds) ? u.teamIds : [],
        ciUserId: u.ciUserId || null,
      }));
  } catch (err) {
    console.warn('[config-api] queryUsers failed:', err.message);
    return [];
  }
}

// ── Directory cache (id ↔ ciUserId reconciliation) ──────────────────────────
// The activity emitter tags BigQuery events with the Desktop CI id, while the
// Search/Config APIs key on the WxCC user id. We cache a user directory so we
// can translate between the two id spaces cheaply on every (5s) live poll.
const DIR_TTL_MS = 5 * 60 * 1000;
let _dir = { ts: 0, orgId: null, byId: new Map(), byCi: new Map() };

/**
 * Load (and cache) the org user directory as { byId, byCi, users }.
 * @returns {Promise<{byId:Map, byCi:Map, users:Array}>}
 */
async function loadDirectory({ accessToken, datacenter, orgId, force } = {}) {
  const now = Date.now();
  if (!force && _dir.orgId === orgId && _dir.byId.size && (now - _dir.ts) < DIR_TTL_MS) {
    return _dir;
  }
  const users = await queryUsers({ accessToken, datacenter, orgId });
  if (users.length) {
    const byId = new Map();
    const byCi = new Map();
    for (const u of users) {
      byId.set(u.id, u);
      if (u.ciUserId) byCi.set(u.ciUserId, u);
    }
    _dir = { ts: now, orgId, byId, byCi, users };
  }
  return _dir;
}

/** The canonical user for an id given as either a WxCC user id or a CI id. */
function canonicalUser(dir, id) {
  if (!id || !dir) return null;
  return dir.byId.get(id) || dir.byCi.get(id) || null;
}

/**
 * All id variants an agent's events could be stored under, so a BigQuery
 * `agent_id IN (…)` match works regardless of which id the caller supplied.
 * @returns {string[]}
 */
function resolveAgentIds(dir, id) {
  const ids = new Set();
  if (id) ids.add(id);
  const u = canonicalUser(dir, id);
  if (u) {
    ids.add(u.id);
    if (u.ciUserId) ids.add(u.ciUserId);
  }
  return [...ids];
}

module.exports = { queryTeams, queryUsers, loadDirectory, canonicalUser, resolveAgentIds };

// Pure async API layer for the Bulk Reskilling widget.
// NO Redux logic here — functions return raw data. The read path NEVER throws:
// on any live failure it degrades to deterministic mock data so the widget
// always renders. The thunk layer owns loading/error/state dispatch.
//
// Webex CC Configuration APIs (region base, e.g. https://api.wxcc-eu1.cisco.com):
//   GET  /organization/{orgId}/team           → teams   [{id,name,teamType,...}]
//   GET  /organization/{orgId}/user           → users   [{id,firstName,lastName,
//                                                         teamIds,skillProfileId,
//                                                         contactCenterEnabled}]
//   GET  /organization/{orgId}/skill          → skills  [{id,name,skillType,
//                                                         enumSkillValues[]}]
//   GET  /organization/{orgId}/skill-profile  → profiles[{id,name,activeSkills:
//                                                [{skillId,proficiencyValue|
//                                                  booleanValue|textValue|
//                                                  enumSkillValueId}]}]
//   PUT  /organization/{orgId}/user/{id}            → assign skill profile (apply)
//   PUT  /organization/{orgId}/skill-profile/{id}   → edit profile values (apply)
//
// Responses are bare JSON arrays and are paginated via ?page=&pageSize=.
// Iteration 1 is preview-only: the apply path is intentionally not invoked.

import { getMockConfig } from './mock/mockData';

const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap (~5000 records per resource)

// Known Webex CC datacenter regions, longest first so 'anz1' wins over 'an'.
const DC_REGIONS = ['anz1', 'eu1', 'eu2', 'us1', 'ca1', 'jp1', 'in1', 'sg1'];

// Resolved-base cache keyed by orgId so we only region-probe once per session.
const resolvedBaseCache = new Map();

/**
 * Map a datacenter identifier to the Configuration API base URL. Handles bare
 * region codes ('eu1') and prefixed forms ('prodeu1', 'produs1'). Falls back to
 * us1 when nothing matches (the live path then region-probes anyway).
 */
export function configBaseForDatacenter(datacenter) {
  const raw = String(datacenter || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const region = DC_REGIONS.find((r) => raw.includes(r)) || 'us1';
  return `https://api.wxcc-${region}.cisco.com`;
}

const headers = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
  Accept: 'application/json',
});

/**
 * Resolve the correct regional base for an org. Tries the datacenter-derived
 * base first; if the org isn't found there (wrong region → 404), probes the
 * other known regions. Caches the working base per org.
 */
async function resolveConfigBase(orgId, accessToken, datacenter) {
  if (resolvedBaseCache.has(orgId)) return resolvedBaseCache.get(orgId);

  const primary = configBaseForDatacenter(datacenter);
  const all = DC_REGIONS.map((r) => `https://api.wxcc-${r}.cisco.com`);
  const candidates = [primary, ...all.filter((b) => b !== primary)];
  const org = encodeURIComponent(orgId);

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/organization/${org}/team?page=0&pageSize=1`, {
        headers: headers(accessToken),
      });
      if (res.ok) {
        resolvedBaseCache.set(orgId, base);
        return base;
      }
      // 401/403 → token problem, not a region issue; stop probing.
      if (res.status === 401 || res.status === 403) break;
    } catch (_e) {
      // network error — try the next region
    }
  }
  return primary;
}

/** Fetch every page of a bare-array list endpoint and concatenate. */
async function getAllPages(base, org, path, accessToken) {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${base}/organization/${org}/${path}?page=${page}&pageSize=${PAGE_SIZE}`;
    const res = await fetch(url, { headers: headers(accessToken) });
    if (!res.ok) {
      throw new Error(`Webex CC config request failed (${res.status}) for ${path}`);
    }
    const json = await res.json();
    const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
    out.push(...list);
    if (list.length < PAGE_SIZE) break;
  }
  return out;
}

/**
 * Fetch the full reskilling configuration (teams, agents, skills, profiles).
 * NEVER throws — returns mock data (with source:'mock') on any failure so the
 * widget always has something to render.
 *
 * @returns {Promise<{skills, teams, agents, skillProfiles, source:'live'|'mock'}>}
 */
export async function fetchReskillConfig(ctx = {}) {
  const { isDemo, accessToken, orgId, datacenter } = ctx;

  // Demo / no-credentials path → deterministic mock config, no network at all.
  if (isDemo || !accessToken || !orgId) {
    return { ...getMockConfig(), source: 'mock' };
  }

  try {
    const base = await resolveConfigBase(orgId, accessToken, datacenter);
    const org = encodeURIComponent(orgId);

    const [skillsRaw, teamsRaw, usersRaw, profilesRaw] = await Promise.all([
      getAllPages(base, org, 'skill', accessToken),
      getAllPages(base, org, 'team', accessToken),
      getAllPages(base, org, 'user', accessToken),
      getAllPages(base, org, 'skill-profile', accessToken),
    ]);

    const config = normalizeConfig({ skillsRaw, teamsRaw, usersRaw, profilesRaw });
    return { ...config, source: 'live' };
  } catch (error) {
    console.warn('[reskill] live config fetch failed — falling back to mock:', error?.message);
    return { ...getMockConfig(), source: 'mock' };
  }
}

const SKILL_TYPE = { PROFICIENCY: 'proficiency', BOOLEAN: 'boolean', TEXT: 'text', ENUM: 'enum' };

/** Extract an agent's value for one activeSkills entry, type-agnostic. */
function activeSkillValue(sv, enumNameById) {
  if (sv.proficiencyValue !== undefined && sv.proficiencyValue !== null) return sv.proficiencyValue;
  if (sv.booleanValue !== undefined && sv.booleanValue !== null) return sv.booleanValue;
  if (sv.textValue !== undefined && sv.textValue !== null) return sv.textValue;
  if (sv.enumSkillValueId !== undefined) return enumNameById.get(sv.enumSkillValueId) || sv.enumSkillValueId;
  if (sv.enumValue !== undefined) return sv.enumValue;
  return undefined;
}

/**
 * Normalize Webex CC config payloads into the widget's internal contract.
 * Defensive against envelope shapes (`{data:[...]}` vs bare array).
 */
export function normalizeConfig({ skillsRaw, teamsRaw, usersRaw, profilesRaw }) {
  const arr = (x) => (Array.isArray(x) ? x : (Array.isArray(x?.data) ? x.data : []));

  // enum-value id → display name (across all skills) for profile value resolution.
  const enumNameById = new Map();
  arr(skillsRaw).forEach((s) => {
    (s.enumSkillValues || []).forEach((v) => { if (v?.id) enumNameById.set(v.id, v.name); });
  });

  const skills = arr(skillsRaw)
    .filter((s) => s.active !== false)
    .map((s) => {
      const type = SKILL_TYPE[s.skillType] || String(s.type || s.skillType || 'proficiency').toLowerCase();
      const out = { id: s.id, name: s.name, type };
      if (type === 'proficiency') out.maxLevel = s.maxValue ?? s.maxLevel ?? 10;
      if (type === 'enum') out.values = (s.enumSkillValues || []).map((v) => v.name);
      if (type === 'text') out.maxLength = s.maxLength ?? 40;
      return out;
    });

  const teams = arr(teamsRaw)
    .filter((t) => t.active !== false)
    .map((t) => ({ id: t.id, name: t.name }));

  // skill-profile id → { skillId: value }
  const profileById = new Map();
  const profileMeta = [];
  arr(profilesRaw).forEach((p) => {
    const map = {};
    (p.activeSkills || p.skills || []).forEach((sv) => {
      const sid = sv.skillId;
      if (!sid) return;
      const value = activeSkillValue(sv, enumNameById);
      if (value !== undefined) map[sid] = value;
    });
    profileById.set(p.id, map);
    profileMeta.push({ id: p.id, name: p.name, skills: map });
  });

  const agents = arr(usersRaw)
    .filter((u) => u.contactCenterEnabled !== false)
    .filter((u) => Array.isArray(u.teamIds) && u.teamIds.length > 0)
    .map((u) => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id,
      teamId: (u.teamIds || [])[0] || null,
      skillProfileId: u.skillProfileId || null,
      skills: { ...(profileById.get(u.skillProfileId) || {}) },
    }));

  return { skills, teams, agents, skillProfiles: profileMeta };
}

/**
 * Apply staged reskilling changes.
 *
 * Demo mode / missing credentials → simulated success (no network), so the
 * widget can demo the full flow. Live PROFILE reassignments are persisted with a
 * safe read-modify-write per user (GET the full user, set skillProfileId, PUT it
 * back). Live per-skill GRID edits have no per-user write API in Webex CC (skills
 * are governed by skill profiles), so they are committed locally only and the
 * result is flagged `localOnly`.
 *
 * @param {object} ctx     { isDemo, accessToken, orgId, datacenter }
 * @param {object} payload { mode:'grid'|'profiles', profileChanges:[{agentId,profileId}], skillChangeCount }
 * @returns {Promise<{applied:boolean, simulated:boolean, count:number, failed:number, localOnly?:boolean}>}
 */
export async function applyReskillChanges(ctx = {}, payload = {}) {
  const { isDemo, accessToken, orgId, datacenter } = ctx;
  const { mode, profileChanges = [], skillChangeCount = 0 } = payload;

  // Demo / no credentials → simulate (no network call).
  if (isDemo || !accessToken || !orgId) {
    const count = mode === 'profiles' ? profileChanges.length : skillChangeCount;
    return { applied: count > 0, simulated: true, count, failed: 0 };
  }

  // Live per-skill grid edits: Webex CC has no per-user skill write API, so these
  // are applied to local state only (a faithful backend apply would require
  // creating/editing skill profiles, which is out of scope here).
  if (mode !== 'profiles') {
    return { applied: skillChangeCount > 0, simulated: true, count: skillChangeCount, failed: 0, localOnly: true };
  }

  // Live profile reassignments → safe read-modify-write per user.
  const base = await resolveConfigBase(orgId, accessToken, datacenter);
  const org = encodeURIComponent(orgId);
  let applied = 0;
  let failed = 0;

  for (const { agentId, profileId } of profileChanges) {
    const userUrl = `${base}/organization/${org}/user/${encodeURIComponent(agentId)}`;
    try {
      const getRes = await fetch(userUrl, { headers: headers(accessToken) });
      if (!getRes.ok) throw new Error(`GET user failed (${getRes.status})`);
      const user = await getRes.json();
      user.skillProfileId = profileId;

      const putRes = await fetch(userUrl, {
        method: 'PUT',
        headers: { ...headers(accessToken), 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (!putRes.ok) throw new Error(`PUT user failed (${putRes.status})`);
      applied += 1;
    } catch (error) {
      console.warn('[reskill] apply failed for agent', agentId, '—', error?.message);
      failed += 1;
    }
  }

  return { applied: applied > 0, simulated: false, count: applied, failed };
}

// ─── Operational analytics (Search API / GraphQL) ────────────────────────────
//
// Trends + KPIs are sourced from the Webex CC Search API, a GraphQL endpoint at
// POST {region}/search (scopes: cjp:config_read; roles: Administrator/Supervisor).
//   • taskDetails query over Customer Session Records (CSR) → volume, AHT,
//     service level, ASA, abandon rate.
//   • agentSession query over Agent Session Records (ASR) → occupancy.
// Each block is fetched independently and NEVER throws: a failing block returns
// null so the analytics layer can fall back to a synthesized value for just
// that metric while keeping the rest live.

const DAY_MS = 86400000;
const SL_THRESHOLD_MS = 20000; // answered-within target for the service-level KPI

/** POST a GraphQL query to the Search API. Throws on HTTP or GraphQL errors. */
async function runSearchGql(base, accessToken, query) {
  const res = await fetch(`${base}/search`, {
    method: 'POST',
    headers: { ...headers(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Search API request failed (${res.status})`);
  const json = await res.json();
  if (Array.isArray(json?.errors) && json.errors.length) {
    throw new Error(json.errors[0]?.message || 'Search API GraphQL error');
  }
  return json?.data || {};
}

/** Flatten a record's `aggregation` list into a { name: numericValue } map. */
function aggMap(aggList) {
  const m = {};
  (aggList || []).forEach((a) => { if (a && a.name != null) m[a.name] = Number(a.value); });
  return m;
}

/** Collapse all aggregation buckets (no group-by → single bucket) into one map. */
function flattenAggregations(data, root, listKey) {
  const list = data?.[root]?.[listKey] || [];
  const m = {};
  list.forEach((row) => Object.assign(m, aggMap(row.aggregation)));
  return m;
}

const trendsGql = (from, to, interval, taskFilter) => `{
  taskDetails(from: ${from}, to: ${to},${taskFilter}
    aggregations: [
      { field: "id", name: "vol", type: count }
      { field: "connectedDuration", name: "aht", type: average }
    ],
    aggregationInterval: { interval: ${interval} }) {
    tasks { intervalStartTime aggregation { name value } }
  }
}`;

const kpiGql = (from, to, taskFilter) => `{
  taskDetails(from: ${from}, to: ${to},${taskFilter}
    aggregations: [
      { field: "id", name: "total", type: count }
      { field: "id", name: "withinSL", type: count, filter: { queueDuration: { lte: ${SL_THRESHOLD_MS} } } }
      { field: "id", name: "abandoned", type: count, filter: { connectedDuration: { equals: 0 } } }
      { field: "queueDuration", name: "asa", type: average }
    ]) {
    tasks { aggregation { name value } }
  }
}`;

const occupancyGql = (from, to, asrFilter) => `{
  agentSession(from: ${from}, to: ${to},${asrFilter}
    aggregations: [
      { field: "connectedDuration", name: "conn", type: sum }
      { field: "idleDuration", name: "idle", type: sum }
    ]) {
    agentSessions { aggregation { name value } }
  }
}`;

/** Build an `or` filter over a list, or '' when the list is empty. */
function orFilter(values, toClause) {
  const list = (values || []).filter((v) => v != null && v !== '');
  if (list.length === 0) return '';
  const clauses = list.map(toClause).join(' ');
  return ` filter: { or: [${clauses}] },`;
}

/** Parse the interval-aggregation trend response into volume + AHT series. */
function parseTrends(data) {
  const tasks = data?.taskDetails?.tasks || [];
  const rows = tasks
    .map((t) => {
      const m = aggMap(t.aggregation);
      return { ts: Number(t.intervalStartTime) || 0, vol: m.vol || 0, aht: m.aht || 0 };
    })
    .sort((a, b) => a.ts - b.ts);
  if (rows.length === 0) return null;
  return {
    volumeTrend: rows.map((r) => Math.round(r.vol)),
    ahtTrend: rows.map((r) => +(r.aht / 60000).toFixed(1)), // ms → minutes
  };
}

/**
 * Fetch live operational analytics (trends + KPIs) from the Search API.
 * Returns null in demo mode / without credentials, or when every block fails,
 * so the caller can synthesize. Partial results are allowed — any missing block
 * is simply omitted and the analytics layer fills it with a synthesized value.
 *
 * When team scope is supplied the queries are filtered to those teams
 * (taskDetails by `lastTeam.name`, agentSession by `teamId`).
 *
 * @returns {Promise<null | { source:'live', volumeTrend?, ahtTrend?, slPct?, kpis? }>}
 */
export async function fetchLiveAnalytics(ctx = {}) {
  const { isDemo, accessToken, orgId, datacenter, trendDays = 30, teamNames = [], teamIds = [] } = ctx;
  if (isDemo || !accessToken || !orgId) return null;

  let base;
  try {
    base = await resolveConfigBase(orgId, accessToken, datacenter);
  } catch (_e) {
    return null;
  }

  const now = Date.now();
  const trendFrom = now - Math.max(1, trendDays) * DAY_MS;
  const kpiFrom = now - DAY_MS; // rolling 24h window for real-time KPIs
  // 24h window → hourly granularity; longer windows → one point per day.
  const interval = trendDays <= 1 ? 'HOURLY' : 'DAILY';

  // Team scope: taskDetails filters on lastTeam.name; agentSession on teamId.
  const taskFilter = orFilter(teamNames, (n) => `{ lastTeam: { name: { equals: ${JSON.stringify(n)} } } }`);
  const asrFilter = orFilter(teamIds, (id) => `{ teamId: { equals: ${JSON.stringify(id)} } }`);

  const [trends, kpi, occ] = await Promise.all([
    runSearchGql(base, accessToken, trendsGql(trendFrom, now, interval, taskFilter)).then(parseTrends).catch(() => null),
    runSearchGql(base, accessToken, kpiGql(kpiFrom, now, taskFilter))
      .then((d) => flattenAggregations(d, 'taskDetails', 'tasks')).catch(() => null),
    runSearchGql(base, accessToken, occupancyGql(kpiFrom, now, asrFilter))
      .then((d) => flattenAggregations(d, 'agentSession', 'agentSessions')).catch(() => null),
  ]);

  if (!trends && !kpi && !occ) return null;

  const out = { source: 'live' };
  if (trends) {
    out.volumeTrend = trends.volumeTrend;
    out.ahtTrend = trends.ahtTrend;
  }

  const kpis = {};
  if (kpi) {
    const total = kpi.total || 0;
    if (total > 0) {
      const slPct = Math.round(((kpi.withinSL || 0) / total) * 100);
      out.slPct = slPct;
      kpis.serviceLevel = slPct;
      kpis.abandonPct = +(((kpi.abandoned || 0) / total) * 100).toFixed(1);
    }
    if (kpi.asa != null && !Number.isNaN(kpi.asa)) kpis.asaSec = Math.round(kpi.asa / 1000);
  }
  if (occ) {
    const conn = occ.conn || 0;
    const idle = occ.idle || 0;
    if (conn + idle > 0) kpis.occupancyPct = Math.round((conn / (conn + idle)) * 100);
  }
  if (Object.keys(kpis).length) out.kpis = kpis;

  return out;
}

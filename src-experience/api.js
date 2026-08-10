// Pure async API layer for the Agent Experience widget.
// NO Redux logic here — functions return raw data. The read path NEVER throws:
// on any live failure it degrades to deterministic mock data so the widget
// always renders. The thunk layer owns loading/error/state dispatch.
//
// Two backends are used:
//   1. Webex CC Configuration API (region base, e.g. https://api.wxcc-eu1.cisco.com)
//      GET /organization/{orgId}/team → the supervisor's teams.
//   2. The Agent Experience settings service (a Cloud Function `experience`
//      endpoint, Firestore-backed) for reading/writing template/signature
//      assignments and per-team proofread prompts. Its URL is passed in via the
//      `experienceurl` web-component prop.

import { getMockConfig, getMockTeams } from './mock/mockData';
import { DEFAULT_PROOFREAD_PROMPT } from './constants';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

// Known Webex CC datacenter regions, longest first so 'anz1' wins over 'an'.
const DC_REGIONS = ['anz1', 'eu1', 'eu2', 'us1', 'ca1', 'jp1', 'in1', 'sg1'];

const resolvedBaseCache = new Map();

export function configBaseForDatacenter(datacenter) {
  const raw = String(datacenter || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const region = DC_REGIONS.find((r) => raw.includes(r)) || 'us1';
  return `https://api.wxcc-${region}.cisco.com`;
}

const authHeaders = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
  Accept: 'application/json',
});

async function resolveConfigBase(orgId, accessToken, datacenter) {
  if (resolvedBaseCache.has(orgId)) return resolvedBaseCache.get(orgId);
  const primary = configBaseForDatacenter(datacenter);
  const all = DC_REGIONS.map((r) => `https://api.wxcc-${r}.cisco.com`);
  const candidates = [primary, ...all.filter((b) => b !== primary)];
  const org = encodeURIComponent(orgId);
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/organization/${org}/team?page=0&pageSize=1`, {
        headers: authHeaders(accessToken),
      });
      if (res.ok) {
        resolvedBaseCache.set(orgId, base);
        return base;
      }
      if (res.status === 401 || res.status === 403) break;
    } catch (_e) { /* try next region */ }
  }
  return primary;
}

async function getAllPages(base, org, path, accessToken) {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${base}/organization/${org}/${path}?page=${page}&pageSize=${PAGE_SIZE}`;
    const res = await fetch(url, { headers: authHeaders(accessToken) });
    if (!res.ok) throw new Error(`Webex CC config request failed (${res.status}) for ${path}`);
    const json = await res.json();
    const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
    out.push(...list);
    if (list.length < PAGE_SIZE) break;
  }
  return out;
}

/**
 * Fetch the supervisor's teams from the Config API. NEVER throws — returns mock
 * teams (with source:'mock') on any failure so the widget always has teams to
 * render. Only AGENT teams are returned, sorted by name.
 *
 * @returns {Promise<{teams:Array<{id,name}>, source:'live'|'mock'}>}
 */
export async function fetchTeams(ctx = {}) {
  const { isDemo, accessToken, orgId, datacenter } = ctx;
  if (isDemo || !accessToken || !orgId) {
    return { teams: getMockTeams(), source: 'mock' };
  }
  try {
    const base = await resolveConfigBase(orgId, accessToken, datacenter);
    const org = encodeURIComponent(orgId);
    const raw = await getAllPages(base, org, 'team', accessToken);
    const teams = raw
      .filter((t) => t && t.id && (t.teamType == null || t.teamType === 'AGENT'))
      .map((t) => ({ id: t.id, name: t.name || t.id }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
    if (teams.length === 0) return { teams: getMockTeams(), source: 'mock' };
    return { teams, source: 'live' };
  } catch (error) {
    console.warn('[experience] live team fetch failed — falling back to mock:', error?.message);
    return { teams: getMockTeams(), source: 'mock' };
  }
}

/** Wrap a legacy flat signature ({name, html}) into the language-grouped shape. */
function migrateLegacySignature(sig) {
  if (!sig || typeof sig !== 'object') return sig;
  if (sig.variants && typeof sig.variants === 'object') return sig;
  if (sig.name || sig.html) {
    return { id: sig.id, variants: { en: { name: sig.name || '', html: sig.html || '' } } };
  }
  return { id: sig.id, variants: {} };
}

/** Derive the language set from templates' + signatures' variants (fallback ['en']). */
function deriveLanguages(templates, signatures) {
  const set = new Set();
  const scan = (arr) => (arr || []).forEach((it) => Object.keys(it?.variants || {}).forEach((l) => set.add(l)));
  scan(templates);
  scan(signatures);
  return set.size ? Array.from(set) : ['en'];
}

/** Merge a stored config with safe defaults so the UI always has complete shape. */
function normalizeConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const prompts = c.proofreadPrompts && typeof c.proofreadPrompts === 'object' ? c.proofreadPrompts : {};
  const templates = Array.isArray(c.templates) ? c.templates : [];
  const signatures = (Array.isArray(c.signatures) ? c.signatures : []).map(migrateLegacySignature);
  return {
    languages: Array.isArray(c.languages) && c.languages.length ? c.languages : deriveLanguages(templates, signatures),
    templates,
    signatures,
    templateAssignments: c.templateAssignments && typeof c.templateAssignments === 'object' ? c.templateAssignments : {},
    signatureAssignments: c.signatureAssignments && typeof c.signatureAssignments === 'object' ? c.signatureAssignments : {},
    proofreadPrompts: {
      default: typeof prompts.default === 'string' && prompts.default.trim() ? prompts.default : DEFAULT_PROOFREAD_PROMPT,
      teams: prompts.teams && typeof prompts.teams === 'object' ? prompts.teams : {},
    },
  };
}

/**
 * Load the persisted Agent Experience configuration (templates, signatures,
 * assignments, prompts) from the settings service. NEVER throws — falls back to
 * mock config on any failure or when no service URL is configured.
 *
 * @returns {Promise<{config:object, source:'live'|'mock'}>}
 */
export async function fetchExperienceConfig(ctx = {}) {
  const { isDemo, accessToken, orgId, experienceUrl } = ctx;
  if (isDemo || !experienceUrl || !accessToken || !orgId) {
    return { config: normalizeConfig(getMockConfig()), source: 'mock' };
  }
  try {
    const url = `${experienceUrl}?orgId=${encodeURIComponent(orgId)}`;
    const res = await fetch(url, { headers: authHeaders(accessToken) });
    if (!res.ok) throw new Error(`experience config GET failed (${res.status})`);
    const json = await res.json();
    // An empty document (first-time org) → seed from mock so supervisors have a
    // starting point they can edit and save.
    const hasData = json && (Array.isArray(json.templates) ? json.templates.length : 0) > 0;
    const config = normalizeConfig(hasData ? json : getMockConfig());
    return { config, source: 'live' };
  } catch (error) {
    console.warn('[experience] live config fetch failed — falling back to mock:', error?.message);
    return { config: normalizeConfig(getMockConfig()), source: 'mock' };
  }
}

/**
 * Persist the configuration to the settings service. In demo mode (or without a
 * service URL) the save is simulated locally so the UX still completes.
 *
 * @returns {Promise<{saved:boolean, simulated:boolean, error?:string}>}
 */
export async function saveExperienceConfig(ctx = {}, config = {}) {
  const { isDemo, accessToken, orgId, experienceUrl } = ctx;
  if (isDemo || !experienceUrl || !accessToken || !orgId) {
    return { saved: true, simulated: true };
  }
  try {
    const res = await fetch(experienceUrl, {
      method: 'POST',
      headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, config: normalizeConfig(config) }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`experience config POST failed (${res.status}) ${text}`.trim());
    }
    return { saved: true, simulated: false };
  } catch (error) {
    console.error('[experience] save failed:', error?.message);
    return { saved: false, simulated: false, error: error?.message || 'save failed' };
  }
}

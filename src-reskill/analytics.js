// Operational analytics for the Bulk Reskilling supervisor view.
//
// Pure compute layer — no Redux. In demo mode it synthesizes realistic
// real-time + historical metrics from the loaded config (deterministic with a
// light per-tick jitter so the bar feels "live"). In a future live iteration
// each block is sourced from a Webex CC reporting API:
//
//   • Real-time (agent state mix, contacts waiting, Service Level now, ASA,
//     abandon %, occupancy) → Webex CC Queue/Agent Statistics (real-time stats).
//   • Historical (volume + AHT trends, SLA attainment, skill demand) → Webex CC
//     Search API (GraphQL /search) over CSR/CAR (task) and ASR/AAR (agent) records.
//
// Coverage is computed from the EFFECTIVE skill values (base config + staged
// draft) so the bar reacts live as the supervisor stages reskilling changes.

import { SKILL_TYPES } from './mock/mockData';
import { effectiveValue, agentsForTeams } from './selectors';

// Deterministic hash → [0,1) so synthesized values are stable per (key, tick).
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Is an agent currently "covering" a skill (usable proficiency / enabled / set)? */
export function skillActive(skill, value) {
  if (value === null || value === undefined || value === '') return false;
  if (skill.type === SKILL_TYPES.BOOLEAN) return value === true;
  if (skill.type === SKILL_TYPES.PROFICIENCY) return Number(value) >= 1;
  return Boolean(value); // enum / text → any non-empty value counts
}

// State colours aligned with Webex CC agent-state semantics.
const STATE_COLORS = {
  available: '#1a7f37',
  engaged:   '#0e7fc1',
  wrapup:    '#9854cb',
  idle:      '#f5a623',
  notReady:  '#97a4b1',
};

const SKILL_DEMAND_COLOR = '#0e7fc1';

// Agent-state assignment — deterministic per agent so the donut counts are real
// and clicking a segment yields a STABLE filter (states don't reshuffle each tick).
// Distribution roughly: 30% available, 44% engaged, 8% wrap-up, 11% idle, 7% not-ready.
const STATE_ORDER = ['available', 'engaged', 'wrapup', 'idle', 'notReady'];
const STATE_CUM = [0.30, 0.74, 0.82, 0.93, 1.0];

/** Stable real-time state for a single agent (used by both the donut and filters). */
export function assignAgentState(agentId) {
  const r = hash01(`astate-${agentId}`);
  for (let i = 0; i < STATE_CUM.length; i++) {
    if (r < STATE_CUM[i]) return STATE_ORDER[i];
  }
  return 'notReady';
}

/**
 * Compute the full analytics payload for the analytics bar.
 *
 * @param {object}   p
 * @param {Array}    p.agents
 * @param {Array}    p.skills
 * @param {Array}    p.selectedTeamIds
 * @param {object}   p.draft       staged changes (folded into coverage)
 * @param {number}   p.trendDays   7 | 30 | 90
 * @param {number}   p.tick        bumps each refresh for a light "live" jitter
 * @param {object}   p.live        live trends/KPIs from the Search API (or null)
 * @param {function} p.t           i18n translator
 */
export function computeAnalytics({ agents, skills, selectedTeamIds, draft, trendDays = 30, tick = 0, live = null, t }) {
  // Scope to selected teams; fall back to the whole org when nothing is selected.
  const scoped = selectedTeamIds && selectedTeamIds.length > 0
    ? agentsForTeams(agents, selectedTeamIds)
    : agents;
  const agentCount = scoped.length;
  const jt = (key) => hash01(`${key}|${tick}`);

  // ── Real-time agent-state mix (real per-agent counts → filterable donut) ────
  const stateCounts = { available: 0, engaged: 0, wrapup: 0, idle: 0, notReady: 0 };
  scoped.forEach((agent) => { stateCounts[assignAgentState(agent.id)] += 1; });
  const agentState = STATE_ORDER.map((key) => ({
    key,
    label: t(`analytics.state.${key}`),
    value: stateCounts[key],
    color: STATE_COLORS[key],
  }));
  const availableCount = stateCounts.available;

  // ── Skill demand vs coverage (the reskilling headline) ─────────────────────
  const skillCoverage = skills.map((skill) => {
    let covering = 0;
    scoped.forEach((agent) => {
      if (skillActive(skill, effectiveValue(agent, skill.id, draft))) covering += 1;
    });
    // Synthesized real-time demand: contacts waiting for this skill right now.
    const demandWeight = 0.4 + 0.6 * hash01(`demand-${skill.id}`);
    const waiting = Math.round(demandWeight * (3 + jt(`wait-${skill.id}`) * 9));
    // A skill is "under-covered" when live demand outstrips the agents able to take it.
    const underCovered = covering === 0 ? waiting > 0 : waiting / covering > 1.5;
    return {
      skillId: skill.id,
      name: skill.name,
      type: skill.type,
      covering,
      waiting,
      underCovered,
    };
  }).sort((a, b) => (b.underCovered - a.underCovered) || (b.waiting - a.waiting));

  const underCoveredCount = skillCoverage.filter((s) => s.underCovered).length;

  // ── Service level (real-time, rolling) ─────────────────────────────────────
  // Synthesized baseline; overridden below by the live Search API value.
  let slPct = Math.round(72 + jt('sl') * 22); // 72–94%

  // ── Historical trends (volume + AHT) ───────────────────────────────────────
  // 24h window → 24 hourly points; otherwise one point per day (capped at 30).
  const points = trendDays <= 1 ? 24 : Math.min(trendDays, 30);
  let volumeTrend = Array.from({ length: points }, (_, i) =>
    Math.round(40 + 30 * hash01(`vol-${i}-${trendDays}`) + 12 * Math.sin(i / 2)));
  let ahtTrend = Array.from({ length: points }, (_, i) =>
    +(4 + 3 * hash01(`aht-${i}-${trendDays}`)).toFixed(1));

  // ── KPIs ───────────────────────────────────────────────────────────────────
  let kpis = {
    serviceLevel: slPct,
    asaSec: Math.round(18 + jt('asa') * 40),       // average speed of answer
    abandonPct: +(2 + jt('aband') * 6).toFixed(1), // abandon rate
    occupancyPct: Math.round(68 + jt('occ') * 22), // occupancy
  };

  // ── Live overrides (Search API) ────────────────────────────────────────────
  // Fold in real data per-metric; anything the live fetch couldn't supply keeps
  // its synthesized fallback so the bar always renders fully.
  if (live) {
    if (Array.isArray(live.volumeTrend) && live.volumeTrend.length) volumeTrend = live.volumeTrend;
    if (Array.isArray(live.ahtTrend) && live.ahtTrend.length) ahtTrend = live.ahtTrend;
    if (typeof live.slPct === 'number') slPct = live.slPct;
    if (live.kpis) kpis = { ...kpis, ...live.kpis };
  }

  const serviceLevel = [
    { key: 'met',    label: t('analytics.sl.met'),    value: slPct,       color: '#1a7f37' },
    { key: 'missed', label: t('analytics.sl.missed'), value: 100 - slPct, color: '#e8453c' },
  ];

  return {
    agentCount,
    availableCount,
    agentState,
    skillCoverage,
    underCoveredCount,
    serviceLevel,
    slPct,
    volumeTrend,
    ahtTrend,
    kpis,
    demandColor: SKILL_DEMAND_COLOR,
  };
}

// Deterministic mock agent-state generator for demo mode.
//
// In production this data comes from Webex CC (Search API AgentActivity/AAR or
// the real-time Desktop SDK state feed) — NOT from our event DB. The mock mirrors
// the shape the backend /activity?state=1 endpoint returns so the widget renders
// identically in demo and live: shift login/logout + idle time broken down by
// agent state / Not-Ready (auxiliary) reason codes.

import { AGENTS } from './mockEvents';

// Idle / Not-Ready breakdown categories (Available = ready-but-idle; the rest
// are Not-Ready auxiliary reason codes an admin configures in Webex CC).
export const IDLE_REASONS = ['available', 'break', 'lunch', 'meeting', 'training', 'rona'];

const REASON_WEIGHT = { available: 0.5, break: 0.15, lunch: 0.18, meeting: 0.1, training: 0.05, rona: 0.02 };

function seedFrom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @returns {{agentId,agentName,loginMs,logoutMs,breakdown:Array,segments:Array}}
 */
export function generateAgentState(agentId, fromMs, toMs) {
  const agent = AGENTS.find((a) => a.id === agentId) || { id: agentId, name: agentId };
  const rand = mulberry32(seedFrom('state:' + agentId + ':' + Math.floor(fromMs / 3600000)));

  const loginMs = fromMs + Math.round(rand() * 12 * 60 * 1000);
  const logoutMs = null; // still on shift (ongoing)
  const end = toMs;

  // Weighted state pool (durations in minutes). Together these form a plausible
  // shift sequence; the aggregate breakdown is derived from the segments so the
  // distribution bar and the state timeline stay consistent.
  const POOL = [
    { code: 'available', name: 'Available', w: 0.40, min: 4, max: 22 },
    { code: 'engaged', name: 'Engaged', w: 0.22, min: 3, max: 12 },
    { code: 'wrapup', name: 'Wrap-up', w: 0.08, min: 1, max: 3 },
    { code: 'break', name: null, w: 0.09, min: 5, max: 15 },
    { code: 'lunch', name: null, w: 0.07, min: 20, max: 40 },
    { code: 'meeting', name: null, w: 0.06, min: 12, max: 30 },
    { code: 'training', name: null, w: 0.04, min: 15, max: 35 },
    { code: 'rona', name: 'Ringing', w: 0.04, min: 0.1, max: 0.3 },
  ];
  const cum = [];
  let acc = 0;
  for (const p of POOL) { acc += p.w; cum.push(acc); }

  const segments = [];
  let cur = loginMs;
  let guard = 0;
  while (cur < end && guard++ < 500) {
    const r = rand() * acc;
    let pick = POOL[POOL.length - 1];
    for (let i = 0; i < cum.length; i++) { if (r <= cum[i]) { pick = POOL[i]; break; } }
    const durMs = (pick.min + rand() * (pick.max - pick.min)) * 60 * 1000;
    const segEnd = Math.min(cur + durMs, end);
    if (segEnd > cur) segments.push({ code: pick.code, name: pick.name, startMs: cur, endMs: Math.round(segEnd) });
    cur = segEnd;
  }

  // Derive the aggregate breakdown from the segments (ordered engaged→…→idle).
  const byCode = {};
  for (const s of segments) {
    const k = s.code;
    if (!byCode[k]) byCode[k] = { code: k, name: s.name, ms: 0 };
    byCode[k].ms += s.endMs - s.startMs;
  }
  const ORDER = ['engaged', 'wrapup', 'available', 'break', 'lunch', 'meeting', 'training', 'rona', 'other'];
  const breakdown = Object.values(byCode)
    .sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code));

  return { agentId: agent.id, agentName: agent.name, loginMs, logoutMs, breakdown, segments };
}

/** All agents' state for the team view. */
export function generateTeamState(fromMs, toMs) {
  return AGENTS.map((a) => generateAgentState(a.id, fromMs, toMs));
}

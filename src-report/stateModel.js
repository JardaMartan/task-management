// Shared model for the agent state / shift distribution.
// The authoritative breakdown is sourced from Webex CC (agentSession AAR) as an
// array of { code, name, ms } segments. When state data is unavailable we fall
// back to engaged + wrap-up derived from our own interaction events.

export const STATE_COLORS = {
  engaged: '#2e9e5b', connected: '#2e9e5b',
  wrapup: '#9854cb',
  available: '#8ecae6',
  break: '#f5a623', lunch: '#e0559b', meeting: '#17a2b8', training: '#3b7dd8',
  rona: '#d9534f', ringing: '#d9534f',
  other: '#6b7a89',
};

// Segments that count as "productive" (not idle) for the idle total.
const PRODUCTIVE = new Set(['engaged', 'connected', 'wrapup']);

export function stateColor(code) {
  return STATE_COLORS[code] || STATE_COLORS.other;
}

/** Fallback breakdown from our event data when Webex state is unavailable. */
export function fallbackBreakdown(occupiedMs = 0, wrapupMs = 0) {
  return [
    { code: 'engaged', ms: Math.max(0, occupiedMs - wrapupMs) },
    { code: 'wrapup', ms: wrapupMs },
  ];
}

/** Totals over a breakdown array. */
export function breakdownTotals(breakdown = []) {
  let total = 0;
  let idleMs = 0;
  let wrapupMs = 0;
  for (const s of breakdown) {
    total += s.ms;
    if (!PRODUCTIVE.has(s.code)) idleMs += s.ms;
    if (s.code === 'wrapup') wrapupMs += s.ms;
  }
  return { total: total || 1, idleMs, wrapupMs };
}

/** i18n key for a distribution segment. */
export function stateLabelKey(code) {
  return `state.${code}`;
}

// Priority when overlapping states occur across channels (higher wins for the
// single wall-clock state lane): engaged > wrap-up > ringing > not-ready > available.
const STATE_PRIORITY = {
  engaged: 5, connected: 5, wrapup: 4, rona: 3, ringing: 3,
  break: 2, lunch: 2, meeting: 2, training: 2, other: 2, available: 1,
};

/**
 * Resolve overlapping AAR state segments into a single non-overlapping
 * wall-clock timeline (highest-priority state wins at each instant), merging
 * consecutive identical states.
 * @param {Array<{code,name,startMs,endMs}>} segments
 * @returns {Array<{code,name,startMs,endMs}>}
 */
export function resolveStateTimeline(segments) {
  const segs = (segments || []).filter((s) => s.endMs > s.startMs);
  if (!segs.length) return [];
  const bset = new Set();
  for (const s of segs) { bset.add(s.startMs); bset.add(s.endMs); }
  const b = [...bset].sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < b.length - 1; i++) {
    const s = b[i];
    const e = b[i + 1];
    if (e <= s) continue;
    const mid = (s + e) / 2;
    let best = null;
    let bestP = -1;
    for (const seg of segs) {
      if (mid >= seg.startMs && mid < seg.endMs) {
        const p = STATE_PRIORITY[seg.code] ?? 1;
        if (p > bestP) { bestP = p; best = seg; }
      }
    }
    if (!best) continue;
    const prev = out[out.length - 1];
    if (prev && prev.code === best.code && prev.name === best.name && prev.endMs === s) prev.endMs = e;
    else out.push({ code: best.code, name: best.name, startMs: s, endMs: e });
  }
  return out;
}

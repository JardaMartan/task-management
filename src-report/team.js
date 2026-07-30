// Pure transform: flat activity events → per-agent multi-lane interaction view.
//
// For each agent we reconstruct their interactions (reusing buildTimeline) and
// pack them into as few sub-lanes as possible (greedy interval scheduling), so
// overlapping interactions stack and non-overlapping ones share a lane. Each
// agent row therefore shows every interaction as a thin line with its active
// span, wrap-up tail, focus segments and focus-change (interruption) markers —
// while the number of sub-lanes equals the agent's peak parallel handling.
//
// We also keep an occupancy summary per agent: occupied / wrap-up / idle time
// and peak concurrency.

import { buildTimeline } from './timeline';

/**
 * @param {Array<object>} events schema-shaped events for the whole team
 * @param {object} [options]
 * @param {number} [options.openEndMs] live "now" — open interactions extend to it
 * @returns {{groups:Array, perAgent:object, bounds:{min:number,max:number}|null}}
 */
export function buildTeamTimeline(events, options = {}) {
  const openEndMs = Number.isFinite(options.openEndMs) ? options.openEndMs : null;

  // Group events by agent.
  const agents = new Map();
  for (const e of events || []) {
    if (!e.agent_id || !e.interaction_id) continue;
    let a = agents.get(e.agent_id);
    if (!a) { a = { id: e.agent_id, name: e.agent_name || e.agent_id, events: [] }; agents.set(e.agent_id, a); }
    if (e.agent_name && a.name === a.id) a.name = e.agent_name;
    a.events.push(e);
  }

  const groups = [];
  const perAgent = {};
  let min = Infinity;
  let max = -Infinity;

  for (const a of agents.values()) {
    const tl = buildTimeline(a.events, { openEndMs });
    if (!tl.bounds) continue;

    // Pack interactions into sub-lanes (greedy: first free lane).
    const ivs = Object.values(tl.byInteraction)
      .sort((x, y) => x.startMs - y.startMs || x.endMs - y.endMs);
    const laneEnds = [];
    const laneOf = {};
    for (const iv of ivs) {
      let placed = -1;
      for (let l = 0; l < laneEnds.length; l++) {
        if (iv.startMs >= laneEnds[l] - 1) { placed = l; break; }
      }
      if (placed === -1) { placed = laneEnds.length; laneEnds.push(0); }
      laneEnds[placed] = iv.endMs;
      laneOf[iv.id] = placed;
    }
    const lanes = Math.max(1, laneEnds.length);

    // Occupancy summary (handling vs wrap-up vs idle) via a boundary sweep.
    const wrapStartById = {};
    for (const it of tl.items) if (it.type === 'wrapup') wrapStartById[it.group] = it.start;
    const intervals = ivs.map((iv) => ({
      start: iv.startMs, end: iv.endMs, wrapupStart: wrapStartById[iv.id] ?? null,
    }));
    const summary = occupancySummary(intervals);

    // Per-agent cumulative totals (summed across the agent's interactions) so the
    // team table can show — and sort by — handle / focus / wrap-up like the
    // single-agent overview. maxConcurrency comes from the occupancy sweep.
    let sumHandle = 0;
    let sumFocus = 0;
    let sumWrap = 0;
    let sumIntr = 0;
    for (const iv of ivs) {
      sumHandle += iv.handleMs || 0;
      sumFocus += iv.focusMs || 0;
      sumWrap += iv.wrapupMs || 0;
      sumIntr += iv.interruptions || 0;
    }
    const totals = {
      handled: ivs.length,
      handleMs: sumHandle,
      focusMs: sumFocus,
      wrapupMs: sumWrap,
      interruptions: sumIntr,
      maxConcurrency: summary.maxConcurrency,
      // Canonical agent-performance KPIs derived from the same data:
      //  • AHT (Average Handle Time) = total handle ÷ interactions handled
      //  • Occupancy = busy time (handling + wrap-up) ÷ logged-in span
      ahtMs: ivs.length ? sumHandle / ivs.length : 0,
      occupancy: (tl.bounds.max - tl.bounds.min) > 0
        ? Math.min(1, ((summary.occupiedMs || 0) + (summary.wrapupMs || 0)) / (tl.bounds.max - tl.bounds.min))
        : 0,
    };

    const shiftStart = tl.bounds.min;
    const shiftEnd = tl.bounds.max;
    min = Math.min(min, shiftStart);
    max = Math.max(max, shiftEnd);

    groups.push({ id: a.id, name: a.name, lanes });
    perAgent[a.id] = { lanes, items: tl.items, byInteraction: tl.byInteraction, laneOf, summary, totals, shiftStart, shiftEnd };
  }

  groups.sort((x, y) => (x.name || '').localeCompare(y.name || ''));

  return {
    groups,
    perAgent,
    bounds: Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null,
  };
}

/** Sweep intervals to sum occupied (handling), wrap-up-only and idle time. */
function occupancySummary(intervals) {
  const bset = new Set();
  for (const iv of intervals) {
    bset.add(iv.start); bset.add(iv.end);
    if (iv.wrapupStart != null) bset.add(iv.wrapupStart);
  }
  const bnds = [...bset].sort((x, y) => x - y);
  let occupiedMs = 0;
  let wrapupMs = 0;
  let idleMs = 0;
  let maxConcurrency = 0;
  for (let i = 0; i < bnds.length - 1; i++) {
    const s = bnds[i];
    const en = bnds[i + 1];
    if (en <= s) continue;
    const mid = (s + en) / 2;
    let active = 0;
    let inWrap = 0;
    for (const iv of intervals) {
      if (mid >= iv.start && mid < iv.end) {
        active++;
        if (iv.wrapupStart != null && mid >= iv.wrapupStart) inWrap++;
      }
    }
    const handling = active - inWrap;
    if (active === 0) idleMs += en - s;
    else if (handling === 0) wrapupMs += en - s;
    else occupiedMs += en - s;
    if (handling > maxConcurrency) maxConcurrency = handling;
  }
  return { occupiedMs, wrapupMs, idleMs, maxConcurrency, handled: intervals.length };
}

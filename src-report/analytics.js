// Pure KPI compute for the Agent Activity overview bar.
// Consumes the timeline model (byInteraction) + raw events; returns business
// metrics. No Redux, no i18n (labels are applied at render).

import { channelOrderIndex } from './timeline';

/**
 * @param {object} p
 * @param {object} p.byInteraction  from buildTimeline()
 * @param {{min:number,max:number}|null} p.bounds
 * @param {number} [p.windowMs]     analysed window length (for occupancy)
 * @returns {object} KPI payload
 */
export function computeOverview({ byInteraction, bounds, windowMs }) {
  const list = Object.values(byInteraction || {});
  const handled = list.length;

  let totalHandleMs = 0;
  let totalFocusMs = 0;
  let totalWrapupMs = 0;
  let totalInterruptions = 0;
  const byChannel = {};

  for (const it of list) {
    totalHandleMs += it.handleMs;
    totalFocusMs += it.focusMs;
    totalWrapupMs += it.wrapupMs || 0;
    totalInterruptions += it.interruptions;
    const ch = it.channel || 'unknown';
    const c = byChannel[ch] || (byChannel[ch] = { channel: ch, count: 0, handleMs: 0, focusMs: 0, wrapupMs: 0, minHandleMs: Infinity, maxHandleMs: 0 });
    c.count += 1;
    c.handleMs += it.handleMs;
    c.focusMs += it.focusMs;
    c.wrapupMs += it.wrapupMs || 0;
    c.minHandleMs = Math.min(c.minHandleMs, it.handleMs);
    c.maxHandleMs = Math.max(c.maxHandleMs, it.handleMs);
  }

  const ahtMs = handled ? totalHandleMs / handled : 0;

  // Concurrency: sweep interaction [start,end] intervals for simultaneous count.
  const { avg: avgConcurrency, max: maxConcurrency } = concurrency(list, bounds);

  // Occupancy: share of the window during which ≥1 interaction was active.
  const span = windowMs || (bounds ? bounds.max - bounds.min : 0);
  const busyMs = unionBusyMs(list);
  const occupancy = span > 0 ? Math.min(1, busyMs / span) : 0;

  // Per-channel cumulative totals + averages (handle + focus), in desktop order.
  const perChannel = Object.values(byChannel)
    .map((c) => ({
      channel: c.channel,
      count: c.count,
      handleMs: c.handleMs,
      focusMs: c.focusMs,
      wrapupMs: c.wrapupMs,
      avgHandleMs: c.count ? c.handleMs / c.count : 0,
      avgFocusMs: c.count ? c.focusMs / c.count : 0,
      minHandleMs: c.minHandleMs === Infinity ? 0 : c.minHandleMs,
      maxHandleMs: c.maxHandleMs,
    }))
    .sort((a, b) => channelOrderIndex(a.channel) - channelOrderIndex(b.channel));

  return {
    handled,
    avgConcurrency,
    maxConcurrency,
    ahtMs,
    totalInterruptions,
    totalFocusMs,
    totalWrapupMs,
    totalHandleMs,
    busyMs,
    occupancy,
    perChannel,
  };
}

function concurrency(list, bounds) {
  if (!list.length || !bounds) return { avg: 0, max: 0 };
  const points = [];
  for (const it of list) {
    points.push([it.startMs, 1]);
    points.push([it.endMs, -1]);
  }
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let maxC = 0;
  let weighted = 0;
  let prevT = points[0][0];
  for (const [t, d] of points) {
    weighted += cur * (t - prevT);
    prevT = t;
    cur += d;
    if (cur > maxC) maxC = cur;
  }
  const span = bounds.max - bounds.min;
  // Average concurrency over the busy span (excludes fully-idle stretches by
  // dividing by the union-busy time, giving "how many at once while working").
  const busy = unionBusyMs(list) || span || 1;
  return { avg: weighted / busy, max: maxC };
}

function unionBusyMs(list) {
  if (!list.length) return 0;
  const intervals = list
    .map((it) => [it.startMs, it.endMs])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [cs, ce] = intervals[0];
  for (let i = 1; i < intervals.length; i++) {
    const [s, e] = intervals[i];
    if (s > ce) { total += ce - cs; cs = s; ce = e; }
    else if (e > ce) ce = e;
  }
  total += ce - cs;
  return total;
}

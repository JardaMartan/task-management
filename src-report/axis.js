// Adaptive time-axis ticks for the activity timelines.
// Picks a "nice" step for the visible span so intraday views show times and
// multi-day views show dates — with a sensible label density (no overlap).

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const NICE_STEPS = [
  MIN, 2 * MIN, 5 * MIN, 10 * MIN, 15 * MIN, 30 * MIN,
  HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
  DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 90 * DAY,
];

function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
function isMidnight(ms) { const d = new Date(ms); return d.getHours() === 0 && d.getMinutes() === 0; }

export function dateLabel(ms) {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
export function clockLabel(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * @param {number} startMs visible window start
 * @param {number} endMs   visible window end
 * @param {number} [target] desired number of labelled ticks
 * @returns {Array<{ms:number, label:string, major:boolean}>}
 *   `major` marks day boundaries / day-granularity ticks (stronger gridline + date).
 */
export function buildTicks(startMs, endMs, target = 7) {
  const span = Math.max(endMs - startMs, MIN);
  const raw = span / target;
  let step = NICE_STEPS[NICE_STEPS.length - 1];
  for (const s of NICE_STEPS) { if (s >= raw) { step = s; break; } }

  const dayStep = step >= DAY;
  let t0;
  if (dayStep) {
    t0 = startOfDay(startMs);
    while (t0 < startMs) t0 += DAY;
  } else {
    const d = new Date(startMs);
    if (step >= HOUR) {
      d.setMinutes(0, 0, 0);
    } else {
      const m = step / MIN;
      d.setSeconds(0, 0);
      d.setMinutes(Math.ceil(d.getMinutes() / m) * m);
    }
    t0 = d.getTime();
    while (t0 < startMs) t0 += step;
  }

  const ticks = [];
  for (let t = t0; t <= endMs; t += step) {
    const midnight = isMidnight(t);
    const major = dayStep || midnight;
    const label = major ? dateLabel(t) : clockLabel(t);
    ticks.push({ ms: t, label, major });
    if (ticks.length > 300) break; // safety
  }
  return ticks;
}

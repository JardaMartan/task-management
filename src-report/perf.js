// Opt-in performance instrumentation for the Agent Activity widget.
//
// Enabled from the Webex CC Desktop layout JSON (no URL access needed) via:
//   • a `debug` attribute/property on the widget, e.g. debug="perf", or
//   • `config: { "debug": "perf" }`
// It logs client-side CPU timings (JSON parse + timeline/analytics transforms +
// event volumes) to the console — the parts a HAR capture cannot see. When
// disabled (default) every helper is a zero-overhead pass-through.

let enabled = false;

/** Enable/disable from a Desktop config value (perf | true | 1 → on). */
export function setPerfEnabled(value) {
  const v = typeof value === 'string' ? value.toLowerCase() : value;
  enabled = v === true || v === 'perf' || v === 'true' || v === '1' || v === 'debug';
  if (enabled) {
    // eslint-disable-next-line no-console
    console.info('[activity-perf] performance instrumentation ENABLED');
  }
  return enabled;
}

export function isPerfEnabled() { return enabled; }

const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

function logDur(label, ms, detail) {
  let d = '';
  if (detail != null) d = ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail));
  // eslint-disable-next-line no-console
  console.info(`[activity-perf] ${label}: ${ms.toFixed(1)}ms${d}`);
}

/** Time a synchronous function and return its result (no-op when disabled). */
export function perfSync(label, fn, detail) {
  if (!enabled) return fn();
  const t0 = nowMs();
  try { return fn(); } finally { logDur(label, nowMs() - t0, detail); }
}

/** Time an async function (awaits it) and return its result. */
export async function perfAsync(label, fn, detail) {
  if (!enabled) return fn();
  const t0 = nowMs();
  try { return await fn(); } finally { logDur(label, nowMs() - t0, detail); }
}

/**
 * Start a manual span. Returns a stop() that logs the elapsed time.
 *   const end = perfStart('x'); ...; end({ count });
 * Returns a no-op stop when disabled.
 */
export function perfStart(label) {
  if (!enabled) return () => {};
  const t0 = nowMs();
  return (detail) => logDur(label, nowMs() - t0, detail);
}

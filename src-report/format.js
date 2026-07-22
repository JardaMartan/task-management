// Small formatting helpers for the activity widget (pure).

/** Human-friendly duration from milliseconds, e.g. "5m 12s" / "42s". */
export function formatDuration(msValue) {
  const totalSec = Math.max(0, Math.round((msValue || 0) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Clock label HH:MM for a ms timestamp. */
export function formatClock(msValue) {
  const d = new Date(msValue);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Percentage 0..1 → integer percent. */
export function formatPercent(ratio) {
  return `${Math.round((ratio || 0) * 100)}%`;
}

// Pure transform: flat activity-event stream → timeline swim-lane model.
//
// Output shape is intentionally vis-timeline compatible (groups + items with
// { id, group, start, end, type, className, title }) so the custom renderer in
// components/ActivityTimeline.jsx can be swapped for vis-timeline with no change
// to this module.
//
// Per interaction we derive:
//   • the "active" span   (task_accepted → task_ended)      → background bar
//   • "focused" segments  (focus_gained → focus_lost)       → solid bars
//   • the "wrap-up" span  (wrapup → task_ended)             → hatched tail
//   • interruption points (focus_lost while still active)   → markers
// plus metrics: handleMs, focusMs, interruptionCount.

const ms = (iso) => Date.parse(iso);

// Map raw Webex CC media-type strings onto the widget's canonical channel set:
// voice, chat, email, social, custom, workitem (+ sms). Unknown values pass
// through lowercased and fall back to the "unknown" color/label.
const CHANNEL_ALIASES = {
  telephony: 'voice', voice: 'voice', call: 'voice', outdial: 'voice',
  chat: 'chat',
  email: 'email',
  social: 'social', facebook: 'social', messenger: 'social', whatsapp: 'social', fbmessenger: 'social',
  custom: 'custom', custommessaging: 'custom', customchannel: 'custom',
  sms: 'sms',
  workitem: 'workitem', task: 'workitem',
};

export function normalizeChannel(raw) {
  const c = String(raw || '').toLowerCase().replace(/[\s_-]/g, '');
  return CHANNEL_ALIASES[c] || (raw ? String(raw).toLowerCase() : 'unknown');
}

// Canonical channel order, matching the agent's Webex CC desktop channel order.
// Used to order channel breakdowns consistently (never by metric value).
export const CHANNEL_ORDER = ['voice', 'chat', 'email', 'social', 'custom', 'workitem', 'sms'];

/** Sort index for a channel (unknown / unlisted channels sort last, stable). */
export function channelOrderIndex(channel) {
  const i = CHANNEL_ORDER.indexOf(channel);
  return i === -1 ? CHANNEL_ORDER.length : i;
}

/**
 * @param {Array<object>} events schema-shaped events, any order
 * @param {object} [options]
 * @param {number} [options.openEndMs] when set (live mode "now"), interactions
 *   that have not ended yet extend their active bar + current focus to this
 *   timestamp so they grow with the now-marker instead of freezing.
 * @returns {{groups:Array, items:Array, bounds:{min:number,max:number}|null, byInteraction:object}}
 */
export function buildTimeline(events, options = {}) {
  const openEndMs = Number.isFinite(options.openEndMs) ? options.openEndMs : null;
  const byId = new Map();
  for (const e of events || []) {
    if (!e.interaction_id) continue;
    const ch = normalizeChannel(e.channel);
    if (!byId.has(e.interaction_id)) {
      byId.set(e.interaction_id, { id: e.interaction_id, channel: ch, customer: e.customer_id || null, events: [] });
    }
    const g = byId.get(e.interaction_id);
    g.events.push(e);
    if (!g.channel || g.channel === 'unknown') g.channel = ch;
    if (!g.customer) g.customer = e.customer_id || g.customer;
  }

  const groups = [];
  const items = [];
  const byInteraction = {};
  let min = Infinity;
  let max = -Infinity;

  // Order swim-lanes by first activity time.
  const ordered = [...byId.values()].sort((a, b) => firstTs(a) - firstTs(b));

  for (const g of ordered) {
    g.events.sort((a, b) => ms(a.event_ts) - ms(b.event_ts));
    const offered  = firstOf(g.events, 'task_offered');
    const accepted = firstOf(g.events, 'task_accepted');
    const ended    = lastOf(g.events, 'task_ended');

    const startMs = ms(accepted?.event_ts || offered?.event_ts || g.events[0].event_ts);
    let endMs = ms(ended?.event_ts || g.events[g.events.length - 1].event_ts);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;

    // Still-open interaction (no task_ended yet): in live mode extend it to
    // "now" so the active bar and the current focus segment keep growing.
    const isOpen = !ended;
    if (isOpen && openEndMs && openEndMs > endMs) endMs = openEndMs;

    min = Math.min(min, startMs);
    max = Math.max(max, endMs);

    groups.push({ id: g.id, content: shortLabel(g.id), channel: g.channel });

    // Active background span.
    items.push({
      id: `${g.id}::active`, group: g.id, start: startMs, end: Math.max(endMs, startMs + 1000),
      type: 'active', className: `lane-active channel-${g.channel}`,
    });

    // Wrap-up: sum every CONTIGUOUS wrap-up interval (wrapup → re-connect | end).
    // The interaction can toggle wrap-up ⇄ connected (e.g. an email reply sent →
    // wrap-up, then reopened → connected, then wrapped again). Measuring a single
    // first-wrapup→end tail would swallow that reconnected active/focused time and
    // wildly overcount wrap-up, so we close each interval at the next task_accepted
    // (re-connect) and only carry the trailing interval to the interaction end.
    let wrapupMs = 0;
    {
      let wStart = null;
      let wIdx = 0;
      for (const e of g.events) {
        const ts = ms(e.event_ts);
        if (!Number.isFinite(ts)) continue;
        if (e.event_type === 'wrapup') {
          if (wStart == null) wStart = ts;
        } else if (e.event_type === 'task_accepted' || e.event_type === 'task_offered') {
          if (wStart != null && ts > wStart) {
            items.push({ id: `${g.id}::wrapup::${wIdx++}`, group: g.id, start: wStart, end: ts, type: 'wrapup', className: 'lane-wrapup' });
            wrapupMs += ts - wStart;
          }
          wStart = null;
        }
      }
      if (wStart != null && endMs > wStart) {
        items.push({ id: `${g.id}::wrapup::${wIdx++}`, group: g.id, start: wStart, end: endMs, type: 'wrapup', className: 'lane-wrapup' });
        wrapupMs += endMs - wStart;
      }
    }

    // Focus segments + interruptions.
    let focusStart = null;
    let focusMs = 0;
    let interruptions = 0;
    let segIdx = 0;
    for (const e of g.events) {
      if (e.event_type === 'focus_gained') {
        focusStart = ms(e.event_ts);
      } else if (e.event_type === 'focus_lost' && focusStart != null) {
        const fEnd = ms(e.event_ts);
        if (fEnd > focusStart) {
          items.push({
            id: `${g.id}::focus::${segIdx++}`, group: g.id, start: focusStart, end: fEnd,
            type: 'focus', className: `lane-focus channel-${g.channel}`,
          });
          focusMs += fEnd - focusStart;
          // An interruption = focus lost while the interaction is still active.
          if (fEnd < endMs - 1000) {
            interruptions++;
            items.push({ id: `${g.id}::intr::${segIdx}`, group: g.id, start: fEnd, type: 'interruption', className: 'lane-interruption' });
          }
        }
        focusStart = null;
      }
    }
    // Dangling focus (still focused at window end / interaction end).
    if (focusStart != null) {
      const fEnd = endMs;
      if (fEnd > focusStart) {
        items.push({ id: `${g.id}::focus::${segIdx++}`, group: g.id, start: focusStart, end: fEnd, type: 'focus', className: `lane-focus channel-${g.channel}` });
        focusMs += fEnd - focusStart;
      }
    }

    byInteraction[g.id] = {
      id: g.id,
      channel: g.channel,
      customer: g.customer,
      startMs,
      endMs,
      handleMs: Math.max(0, endMs - startMs),
      focusMs,
      interruptions,
      open: isOpen,
      wrapupMs,
    };
  }

  return {
    groups,
    items,
    bounds: Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null,
    byInteraction,
  };
}

function firstTs(g) {
  return Math.min(...g.events.map((e) => ms(e.event_ts)));
}
function firstOf(list, type) { return list.find((e) => e.event_type === type) || null; }
function lastOf(list, type) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].event_type === type) return list[i];
  return null;
}
function shortLabel(id) {
  const s = String(id);
  return s.length > 14 ? '…' + s.slice(-12) : s;
}

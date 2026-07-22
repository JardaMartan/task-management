// Deterministic mock activity-event generator for the Agent Activity widget.
//
// Produces schema-shaped events (matching backend/cloud-function/activity.js and
// src/activity-emitter.js) so the demo path exercises the exact same transform
// and analytics code as the live path. Given the same agentId + window it always
// returns the same events (seeded PRNG), so the timeline is stable across ticks
// except for the advancing "now" marker in live mode.

export const AGENTS = [
  { id: 'agent-alan',    name: 'Alan Turing',       teamIds: ['team-sales'] },
  { id: 'agent-grace',   name: 'Grace Hopper',      teamIds: ['team-sales', 'team-support'] },
  { id: 'agent-katherine', name: 'Katherine Johnson', teamIds: ['team-support'] },
  { id: 'agent-linus',   name: 'Linus Torvalds',    teamIds: ['team-support'] },
];

const CHANNELS = ['voice', 'chat', 'email', 'social', 'custom', 'workitem'];

// Small deterministic PRNG (mulberry32) seeded from a string.
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
 * Generate a coherent stream of activity events for one agent over [fromMs, toMs].
 * Simulates concurrent interactions with focus switching (interruptions).
 *
 * @returns {Array<object>} events sorted ascending by event_ts
 */
export function generateEvents(agentId, fromMs, toMs) {
  const agent = AGENTS.find((a) => a.id === agentId) || { id: agentId, name: agentId };
  const rand = mulberry32(seedFrom(agentId + ':' + Math.floor(fromMs / 3600000)));
  const events = [];
  const S = 1000;

  const push = (tsMs, type, interaction) => {
    events.push({
      event_ts: new Date(tsMs).toISOString(),
      agent_id: agent.id,
      agent_name: agent.name,
      session_id: 'demo-' + agent.id,
      interaction_id: interaction.id,
      channel: interaction.channel,
      event_type: type,
      customer_id: interaction.customer,
      queue: interaction.queue,
      org_id: 'demo-org',
    });
  };

  const windowMs = Math.max(toMs - fromMs, 10 * 60 * S);
  // Spread interactions across the WHOLE window (~1 every 18 min), so the
  // timeline isn't clustered at the start of long ranges and lanes overlap
  // enough to show real parallel handling.
  const count = Math.max(5, Math.min(34, Math.round(windowMs / (18 * 60 * S))));
  const spacing = windowMs / count;

  const interactions = [];
  for (let i = 0; i < count; i++) {
    const channel = CHANNELS[Math.floor(rand() * CHANNELS.length)];
    // Base position on the spacing grid + jitter, so lanes overlap for concurrency.
    const offeredAt = fromMs + Math.round((i + 0.8 * rand()) * spacing);
    const acceptDelay = (3 + Math.round(rand() * 8)) * S;
    const handleSec = (channel === 'voice')
      ? 150 + Math.round(rand() * 360)    // voice: 2.5-8.5 min, usually single-focus
      : 300 + Math.round(rand() * 1200);  // digital: 5-25 min, interruptible
    const acceptedAt = offeredAt + acceptDelay;
    const naturalEnd = acceptedAt + handleSec * S;
    // The LAST interaction is forced to be currently in progress (open) so live
    // mode always has a bar growing toward "now". Others are open only if their
    // natural end runs past the window edge.
    const isLast = i === count - 1;
    const open = isLast || naturalEnd > toMs;
    const endedAt = open ? toMs : naturalEnd;
    if (open && offeredAt >= toMs) continue; // skip degenerate future-only entries
    interactions.push({
      id: `${agent.id}-int-${i + 1}`,
      channel,
      customer: `cust-${1000 + Math.floor(rand() * 8999)}`,
      queue: channel.charAt(0).toUpperCase() + channel.slice(1) + ' Queue',
      offeredAt, acceptedAt, endedAt, open,
      wrapupAt: Math.max(acceptedAt, endedAt - (15 + Math.round(rand() * 45)) * S),
    });
  }

  // Lifecycle events. Open interactions emit no wrapup/ended (still in progress).
  for (const it of interactions) {
    if (it.offeredAt <= toMs) push(it.offeredAt, 'task_offered', it);
    if (it.acceptedAt <= toMs) push(it.acceptedAt, 'task_accepted', it);
    if (!it.open && it.wrapupAt <= toMs && it.wrapupAt < it.endedAt) push(it.wrapupAt, 'wrapup', it);
    if (!it.open && it.endedAt <= toMs) push(it.endedAt, 'task_ended', it);
  }

  // Focus stream: walk time, keep the agent focused on one active interaction,
  // switching among concurrently-active ones to create interruptions.
  const active = [...interactions].sort((a, b) => a.acceptedAt - b.acceptedAt);
  let focusId = null;
  let focusStart = null;
  const emitFocusLost = (tsMs, it) => { if (it) push(tsMs, 'focus_lost', it); };
  const emitFocusGained = (tsMs, it) => { push(tsMs, 'focus_gained', it); focusId = it.id; focusStart = tsMs; };

  // Step through in 30s ticks, choosing a focus target from currently-live interactions.
  for (let t = fromMs; t <= toMs; t += 30 * S) {
    const live = active.filter((it) => t >= it.acceptedAt && t < it.endedAt);
    if (live.length === 0) {
      if (focusId) { emitFocusLost(t, active.find((it) => it.id === focusId)); focusId = null; }
      continue;
    }
    const current = live.find((it) => it.id === focusId);
    // Switch focus when: current no longer live, or a random interruption fires,
    // or we've been focused a while and another interaction is waiting.
    const dwell = focusStart != null ? t - focusStart : Infinity;
    const wantSwitch = !current || (live.length > 1 && (rand() < 0.18 || dwell > 150 * S));
    if (wantSwitch) {
      const candidates = live.filter((it) => it.id !== focusId);
      const next = candidates.length ? candidates[Math.floor(rand() * candidates.length)] : live[0];
      if (next && next.id !== focusId) {
        if (focusId) emitFocusLost(t, active.find((it) => it.id === focusId));
        emitFocusGained(t, next);
      }
    }
  }
  // Close a dangling focus at window end — unless the focused interaction is
  // still open, in which case we leave it dangling so its focus segment keeps
  // growing to "now" in live mode.
  if (focusId) {
    const it = active.find((x) => x.id === focusId);
    if (it && !it.open) emitFocusLost(Math.min(it.endedAt, toMs), it);
  }

  events.sort((a, b) => Date.parse(a.event_ts) - Date.parse(b.event_ts));
  return events;
}

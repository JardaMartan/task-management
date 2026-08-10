// Pure selector helpers for the Agent Experience widget.

/** Deep-equality on the parts of the config that Save persists. */
export function configEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_e) {
    return false;
  }
}

/** True when the working config differs from the last-saved snapshot. */
export function isDirty(state) {
  return !configEqual(state.config, state.savedConfig);
}

/** Team ids currently assigned to an item (template/signature). */
export function assignedTeams(assignments, itemId) {
  return assignments[itemId] || [];
}

/** Count of teams an item is assigned to. */
export function assignmentCount(assignments, itemId) {
  return (assignments[itemId] || []).length;
}

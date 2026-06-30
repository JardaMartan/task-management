// Pure selector helpers for the reskilling grid. Kept out of components so the
// matrix, quick actions, and review dialog all compute values identically.

import { SKILL_TYPES } from './mock/mockData';

/** Effective value for an agent's skill = staged override if present, else base. */
export function effectiveValue(agent, skillId, draft) {
  const override = draft?.[agent.id]?.[skillId];
  if (override !== undefined) return override;
  return agent.skills?.[skillId];
}

/** Is there a staged override for this agent+skill that differs from the base? */
export function isChanged(agent, skillId, draft) {
  return draft?.[agent.id]?.[skillId] !== undefined;
}

/** Default "on" value for a skill when staged via templates/percentage. */
export function defaultOnValue(skill) {
  if (skill.type === SKILL_TYPES.BOOLEAN) return true;
  if (skill.type === SKILL_TYPES.ENUM) return skill.values?.[skill.values.length - 1] ?? '';
  if (skill.type === SKILL_TYPES.TEXT) return '';
  return skill.maxLevel || 10;
}

/** Agents belonging to any of the selected teams. */
export function agentsForTeams(agents, selectedTeamIds) {
  if (!selectedTeamIds || selectedTeamIds.length === 0) return [];
  const set = new Set(selectedTeamIds);
  return agents.filter((a) => set.has(a.teamId));
}

/** Apply the agent search + only-changed filters. */
export function filterAgents(agents, { search, onlyChanged, draft }) {
  let out = agents;
  if (search) {
    const q = search.toLowerCase();
    out = out.filter((a) => a.name.toLowerCase().includes(q));
  }
  if (onlyChanged) {
    out = out.filter((a) => draft?.[a.id] && Object.keys(draft[a.id]).length > 0);
  }
  return out;
}

/**
 * Flatten the staged draft into a list of change rows for the review dialog and
 * pending-count summaries.
 * @returns {Array<{agentId, agentName, skillId, skillName, type, from, to}>}
 */
export function stagedChangeRows(draft, agents, skills) {
  const agentById = new Map(agents.map((a) => [a.id, a]));
  const skillById = new Map(skills.map((s) => [s.id, s]));
  const rows = [];
  Object.entries(draft || {}).forEach(([agentId, skillMap]) => {
    const agent = agentById.get(agentId);
    if (!agent) return;
    Object.entries(skillMap).forEach(([skillId, to]) => {
      const skill = skillById.get(skillId);
      if (!skill) return;
      rows.push({
        agentId,
        agentName: agent.name,
        skillId,
        skillName: skill.name,
        type: skill.type,
        from: agent.skills?.[skillId],
        to,
      });
    });
  });
  return rows;
}

/** Count of staged changes and the number of distinct agents affected. */
export function stagedSummary(draft) {
  let changes = 0;
  const agents = Object.keys(draft || {}).filter((agentId) => {
    const n = Object.keys(draft[agentId] || {}).length;
    changes += n;
    return n > 0;
  });
  return { changes, agents: agents.length };
}

/** Skills that are relevant to the scoped agents = at least one covers it
 * (effective value active), so the matrix can hide catalog skills no one uses. */
export function relevantSkills(scopedAgents, skills, draft) {
  if (!scopedAgents || scopedAgents.length === 0) return skills;
  const active = new Set();
  scopedAgents.forEach((agent) => {
    skills.forEach((skill) => {
      const v = effectiveValue(agent, skill.id, draft);
      const on = skill.type === SKILL_TYPES.BOOLEAN
        ? v === true
        : skill.type === SKILL_TYPES.PROFICIENCY
          ? Number(v) >= 1
          : Boolean(v);
      if (on) active.add(skill.id);
    });
  });
  return skills.filter((s) => active.has(s.id));
}

/** Combined pending count across staged skill edits + profile reassignments. */
export function combinedSummary(draft, profileDraft) {
  const skill = stagedSummary(draft);
  const profileAgents = Object.keys(profileDraft || {});
  const affected = new Set([...Object.keys(draft || {}).filter((id) => Object.keys(draft[id] || {}).length > 0), ...profileAgents]);
  return {
    changes: skill.changes + profileAgents.length,
    agents: affected.size,
  };
}

/** Pending count for staged profile reassignments only. */
export function profileSummary(profileDraft) {
  const agents = Object.keys(profileDraft || {});
  return { changes: agents.length, agents: agents.length };
}

/** Flatten staged profile reassignments into review rows. */
export function stagedProfileRows(profileDraft, agents, skillProfiles) {
  const agentById = new Map(agents.map((a) => [a.id, a]));
  const profById = new Map(skillProfiles.map((p) => [p.id, p]));
  const rows = [];
  Object.entries(profileDraft || {}).forEach(([agentId, toId]) => {
    const agent = agentById.get(agentId);
    if (!agent) return;
    rows.push({
      agentId,
      agentName: agent.name,
      fromName: profById.get(agent.skillProfileId)?.name || agent.skillProfileId || null,
      toName: profById.get(toId)?.name || toId,
    });
  });
  return rows;
}

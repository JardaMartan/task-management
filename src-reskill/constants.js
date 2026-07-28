// Sentinel values used to stage "remove/unassign" operations in the drafts,
// distinct from a normal value change.
//   REMOVE_SKILL  — grid: remove a dynamic skill from an agent entirely
//                   (delete the user.dynamicSkills[] entry), not just set a value.
//   NO_PROFILE    — profiles: unassign the agent's skill profile (skillProfileId → null).
export const REMOVE_SKILL = '__reskill_remove_skill__';
export const NO_PROFILE = '__reskill_no_profile__';

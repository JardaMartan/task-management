// Deterministic mock teams for the Agent Activity widget demo path.
// Mirrors the Config API shape: { id, name, memberCount }. Membership is encoded
// on the mock AGENTS roster (teamIds) so the demo team picker filters just like
// the live path.

export const TEAMS = [
  { id: 'team-sales', name: 'Sales EMEA', memberCount: 2 },
  { id: 'team-support', name: 'Support Tier 1', memberCount: 3 },
];

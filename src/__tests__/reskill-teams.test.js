import { agentsForTeams, agentTeamIds } from '../../src-reskill/selectors';
import { normalizeConfig } from '../../src-reskill/api';

describe('multi-team membership', () => {
  const agents = [
    { id: 'a1', teamId: 'tCisco', teamIds: ['tCisco', 'tBackup'] },
    { id: 'a2', teamId: 'tBackup', teamIds: ['tBackup'] },
    { id: 'a3', teamId: 'tOther', teamIds: ['tOther'] },
  ];

  test('agentsForTeams matches an agent on ANY of their teams', () => {
    expect(agentsForTeams(agents, ['tBackup']).map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(agentsForTeams(agents, ['tCisco']).map((a) => a.id)).toEqual(['a1']);
  });

  test('agentTeamIds falls back to the single teamId', () => {
    expect(agentTeamIds({ teamId: 'x' })).toEqual(['x']);
    expect(agentTeamIds({ teamIds: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(agentTeamIds({})).toEqual([]);
  });

  test('normalizeConfig keeps the full teamIds array + primary teamId', () => {
    const cfg = normalizeConfig({
      skillsRaw: [],
      teamsRaw: [{ id: 't1', name: 'T1' }, { id: 't2', name: 'T2' }],
      profilesRaw: [],
      usersRaw: [{
        id: 'u1', firstName: 'A', lastName: 'B', contactCenterEnabled: true, teamIds: ['t2', 't1'],
      }],
    });
    const a = cfg.agents[0];
    expect(a.teamId).toBe('t2');
    expect(a.teamIds).toEqual(['t2', 't1']);
    // Selecting either team surfaces the agent.
    expect(agentsForTeams(cfg.agents, ['t1']).map((x) => x.id)).toEqual(['u1']);
    expect(agentsForTeams(cfg.agents, ['t2']).map((x) => x.id)).toEqual(['u1']);
  });
});

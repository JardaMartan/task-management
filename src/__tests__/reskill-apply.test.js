import reducer, {
  setConfig, stageProfile, stageSkill, setViewMode, commitDraft,
} from '../../src-reskill/store/slices/reskillSlice';
import { applyReskillChanges } from '../../src-reskill/api';
import { REMOVE_SKILL, NO_PROFILE } from '../../src-reskill/constants';

const init = () => reducer(undefined, { type: '@@INIT' });

const configWith = (overrides = {}) => setConfig({
  skills: [],
  teams: [],
  agents: [{ id: 'a1', skillProfileId: 'p1', skills: { sk: 0 } }],
  skillProfiles: [
    { id: 'p1', name: 'Bravo', skills: { sk: 1 } },
    { id: 'p2', name: 'alpha', skills: { sk: 5 } },
    { id: 'p3', name: 'Charlie', skills: { sk: 3 } },
  ],
  ...overrides,
});

describe('skill profiles — sorted by name (Unicode, case-insensitive)', () => {
  test('setConfig stores profiles alphabetically regardless of input order', () => {
    const s = reducer(init(), configWith());
    expect(s.skillProfiles.map((p) => p.name)).toEqual(['alpha', 'Bravo', 'Charlie']);
  });
});

describe('commitDraft — fold staged changes into the local baseline', () => {
  test('profiles mode: updates agent profile + skills and clears the draft', () => {
    let s = reducer(init(), configWith());
    s = reducer(s, setViewMode('profiles'));
    s = reducer(s, stageProfile({ agentId: 'a1', profileId: 'p2', baseProfileId: 'p1' }));
    expect(s.profileDraft.a1).toBe('p2');

    s = reducer(s, commitDraft('profiles'));
    const agent = s.agents.find((a) => a.id === 'a1');
    expect(agent.skillProfileId).toBe('p2');
    expect(agent.skills).toEqual({ sk: 5 }); // adopted from profile p2
    expect(s.profileDraft).toEqual({});
  });

  test('grid mode: merges staged skill values and clears the draft', () => {
    let s = reducer(init(), configWith());
    s = reducer(s, stageSkill({ agentId: 'a1', skillId: 'sk', value: 9, baseValue: 0 }));
    s = reducer(s, commitDraft('grid'));
    expect(s.agents.find((a) => a.id === 'a1').skills.sk).toBe(9);
    expect(s.draft).toEqual({});
  });

  test('grid mode: REMOVE_SKILL removes the skill from the agent baseline', () => {
    let s = reducer(init(), configWith({ agents: [{ id: 'a1', skillProfileId: 'p1', skills: { sk: 4, keep: true } }] }));
    s = reducer(s, stageSkill({ agentId: 'a1', skillId: 'sk', value: REMOVE_SKILL, baseValue: 4 }));
    expect(s.draft.a1.sk).toBe(REMOVE_SKILL);
    s = reducer(s, commitDraft('grid'));
    expect(s.agents.find((a) => a.id === 'a1').skills).toEqual({ keep: true });
    expect(s.draft).toEqual({});
  });

  test('profiles mode: NO_PROFILE unassigns the skill profile', () => {
    let s = reducer(init(), configWith());
    s = reducer(s, setViewMode('profiles'));
    s = reducer(s, stageProfile({ agentId: 'a1', profileId: NO_PROFILE, baseProfileId: 'p1' }));
    expect(s.profileDraft.a1).toBe(NO_PROFILE);
    s = reducer(s, commitDraft('profiles'));
    const agent = s.agents.find((a) => a.id === 'a1');
    expect(agent.skillProfileId).toBeNull();
    expect(agent.skills).toEqual({});
  });
});

describe('applyReskillChanges — backend persistence', () => {
  afterEach(() => { delete global.fetch; });

  test('demo mode simulates without any network call', async () => {
    global.fetch = jest.fn();
    const res = await applyReskillChanges(
      { isDemo: true, accessToken: 't', orgId: 'o' },
      { mode: 'profiles', profileChanges: [{ agentId: 'a1', profileId: 'p2' }] },
    );
    expect(res).toMatchObject({ applied: true, simulated: true, count: 1, failed: 0 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('live grid edits assign dynamic skills via GET→PUT of user.dynamicSkills', async () => {
    const puts = [];
    global.fetch = jest.fn((url, opts) => {
      const u = String(url);
      const method = opts?.method || 'GET';
      if (u.includes('/team?')) return jsonOk([{ id: 't' }]); // region probe
      if (u.includes('/user/') && method === 'GET') {
        // Existing dynamic skill on the agent that must be preserved.
        return jsonOk({
          id: 'a1', firstName: 'X', teamIds: ['t'],
          dynamicSkills: [{ skillId: 'other', skillName: 'Other', booleanValue: true }],
        });
      }
      if (u.includes('/user/') && method === 'PUT') {
        puts.push(JSON.parse(opts.body));
        return jsonOk({});
      }
      return jsonOk({});
    });

    const res = await applyReskillChanges(
      { isDemo: false, accessToken: 't', orgId: 'org-grid', datacenter: 'eu1' },
      {
        mode: 'grid',
        skillChanges: [{ agentId: 'a1', skillId: 'sk', proficiencyValue: 9 }],
        skillChangeCount: 1,
      },
    );
    expect(res).toMatchObject({ applied: true, simulated: false, count: 1, failed: 0 });
    expect(puts).toHaveLength(1);
    // Existing entry preserved + new dynamic skill upserted.
    expect(puts[0].dynamicSkills).toEqual(expect.arrayContaining([
      { skillId: 'other', skillName: 'Other', booleanValue: true },
      { skillId: 'sk', proficiencyValue: 9 },
    ]));
  });

  test('live grid remove deletes the dynamic skill from user.dynamicSkills', async () => {
    const puts = [];
    global.fetch = jest.fn((url, opts) => {
      const u = String(url);
      const method = opts?.method || 'GET';
      if (u.includes('/team?')) return jsonOk([{ id: 't' }]);
      if (u.includes('/user/') && method === 'GET') {
        return jsonOk({ id: 'a1', teamIds: ['t'], dynamicSkills: [{ skillId: 'sk', proficiencyValue: 5 }, { skillId: 'keep', booleanValue: true }] });
      }
      if (u.includes('/user/') && method === 'PUT') { puts.push(JSON.parse(opts.body)); return jsonOk({}); }
      return jsonOk({});
    });
    const res = await applyReskillChanges(
      { isDemo: false, accessToken: 't', orgId: 'org-rm', datacenter: 'eu1' },
      { mode: 'grid', skillChanges: [{ agentId: 'a1', skillId: 'sk', remove: true }], skillChangeCount: 1 },
    );
    expect(res).toMatchObject({ applied: true, failed: 0, count: 1 });
    expect(puts[0].dynamicSkills).toEqual([{ skillId: 'keep', booleanValue: true }]);
  });

  test('live profile unassign PUTs skillProfileId null', async () => {
    const puts = [];
    global.fetch = jest.fn((url, opts) => {
      const u = String(url);
      const method = opts?.method || 'GET';
      if (u.includes('/team?')) return jsonOk([{ id: 't' }]);
      if (u.includes('/user/') && method === 'GET') return jsonOk({ id: 'a1', skillProfileId: 'p1', teamIds: ['t'] });
      if (u.includes('/user/') && method === 'PUT') { puts.push(JSON.parse(opts.body)); return jsonOk({}); }
      return jsonOk({});
    });
    const res = await applyReskillChanges(
      { isDemo: false, accessToken: 't', orgId: 'org-unassign', datacenter: 'eu1' },
      { mode: 'profiles', profileChanges: [{ agentId: 'a1', profileId: null }] },
    );
    expect(res).toMatchObject({ applied: true, failed: 0, count: 1 });
    expect(puts[0].skillProfileId).toBeNull();
  });

  test('live profile reassignment does a safe GET→PUT per user', async () => {
    const puts = [];
    global.fetch = jest.fn((url, opts) => {
      const u = String(url);
      const method = opts?.method || 'GET';
      if (u.includes('/team?')) return jsonOk([{ id: 't' }]); // region probe
      if (u.includes('/user/') && method === 'GET') {
        return jsonOk({ id: 'a1', firstName: 'X', skillProfileId: 'p1', teamIds: ['t'] });
      }
      if (u.includes('/user/') && method === 'PUT') {
        puts.push(JSON.parse(opts.body));
        return jsonOk({});
      }
      return jsonOk({});
    });

    const res = await applyReskillChanges(
      { isDemo: false, accessToken: 't', orgId: 'org-apply', datacenter: 'eu1' },
      { mode: 'profiles', profileChanges: [{ agentId: 'a1', profileId: 'p2' }] },
    );
    expect(res).toMatchObject({ applied: true, simulated: false, count: 1, failed: 0 });
    // Full user body preserved, only skillProfileId changed.
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ id: 'a1', firstName: 'X', skillProfileId: 'p2' });
  });

  test('reports failures without throwing', async () => {
    global.fetch = jest.fn((url) => {
      const u = String(url);
      if (u.includes('/team?')) return jsonOk([{ id: 't' }]);
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });
    const res = await applyReskillChanges(
      { isDemo: false, accessToken: 't', orgId: 'org-apply-fail', datacenter: 'eu1' },
      { mode: 'profiles', profileChanges: [{ agentId: 'a1', profileId: 'p2' }] },
    );
    expect(res).toMatchObject({ applied: false, failed: 1, count: 0 });
  });
});

function jsonOk(payload) {
  return Promise.resolve({ ok: true, status: 200, json: async () => payload });
}

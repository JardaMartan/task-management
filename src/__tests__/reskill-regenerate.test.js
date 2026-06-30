import reducer, { stageBulk, stageProfileBulk, setViewMode, resetCurrentMode } from '../../src-reskill/store/slices/reskillSlice';

const init = () => reducer(undefined, { type: '@@INIT' });

describe('percentage mix generator — regenerate replaces (no accumulation)', () => {
  test('skill generator: re-roll reverts previous selection then applies the new one', () => {
    // gen1 → agents a1, a2 get skill sk=8 (base 0)
    let s = reducer(init(), stageBulk([
      { agentId: 'a1', skillId: 'sk', value: 8, baseValue: 0 },
      { agentId: 'a2', skillId: 'sk', value: 8, baseValue: 0 },
    ]));
    expect(Object.keys(s.draft).sort()).toEqual(['a1', 'a2']);

    // gen2 → revert prev (a1,a2 back to base) + apply new chosen (a2,a3)
    s = reducer(s, stageBulk([
      { agentId: 'a1', skillId: 'sk', value: 0, baseValue: 0 }, // revert
      { agentId: 'a2', skillId: 'sk', value: 0, baseValue: 0 }, // revert
      { agentId: 'a2', skillId: 'sk', value: 8, baseValue: 0 }, // apply (wins, last)
      { agentId: 'a3', skillId: 'sk', value: 8, baseValue: 0 }, // apply
    ]));

    // a1 dropped (not accumulated); only the new subset remains
    expect(Object.keys(s.draft).sort()).toEqual(['a2', 'a3']);
    expect(s.draft.a2.sk).toBe(8);
    expect(s.draft.a3.sk).toBe(8);
    expect(s.draft.a1).toBeUndefined();
  });

  test('profile generator: re-roll clears previous agents then assigns the new ones', () => {
    // gen1 → a1, a2 assigned profile P (base profile base1/base2)
    let s = reducer(init(), stageProfileBulk({
      profileId: 'P',
      entries: [
        { agentId: 'a1', baseProfileId: 'base1' },
        { agentId: 'a2', baseProfileId: 'base2' },
      ],
    }));
    expect(Object.keys(s.profileDraft).sort()).toEqual(['a1', 'a2']);

    // gen2 → clear prev (falsy profileId) then assign new chosen (a2, a3)
    s = reducer(s, stageProfileBulk({
      profileId: '',
      entries: [
        { agentId: 'a1', baseProfileId: 'base1' },
        { agentId: 'a2', baseProfileId: 'base2' },
      ],
    }));
    s = reducer(s, stageProfileBulk({
      profileId: 'P',
      entries: [
        { agentId: 'a2', baseProfileId: 'base2' },
        { agentId: 'a3', baseProfileId: 'base3' },
      ],
    }));

    expect(Object.keys(s.profileDraft).sort()).toEqual(['a2', 'a3']);
    expect(s.profileDraft.a2).toBe('P');
    expect(s.profileDraft.a3).toBe('P');
    expect(s.profileDraft.a1).toBeUndefined();
  });

  test('staging a value equal to base clears the override (revert primitive)', () => {
    let s = reducer(init(), stageBulk([{ agentId: 'a1', skillId: 'sk', value: 5, baseValue: 0 }]));
    expect(s.draft.a1.sk).toBe(5);
    s = reducer(s, stageBulk([{ agentId: 'a1', skillId: 'sk', value: 0, baseValue: 0 }]));
    expect(s.draft.a1).toBeUndefined();
  });
});

describe('view modes are independent (drafts persist; reset is per-mode)', () => {
  test('switching mode keeps both drafts intact', () => {
    let s = reducer(init(), stageBulk([{ agentId: 'a1', skillId: 'sk', value: 5, baseValue: 0 }]));
    s = reducer(s, stageProfileBulk({ profileId: 'P', entries: [{ agentId: 'a2', baseProfileId: 'b' }] }));
    expect(s.draft.a1.sk).toBe(5);
    expect(s.profileDraft.a2).toBe('P');

    // switching grid → profiles must NOT discard either draft
    s = reducer(s, setViewMode('profiles'));
    expect(s.viewMode).toBe('profiles');
    expect(s.draft.a1.sk).toBe(5);
    expect(s.profileDraft.a2).toBe('P');
  });

  test('resetCurrentMode only clears the active mode draft', () => {
    let s = reducer(init(), stageBulk([{ agentId: 'a1', skillId: 'sk', value: 5, baseValue: 0 }]));
    s = reducer(s, stageProfileBulk({ profileId: 'P', entries: [{ agentId: 'a2', baseProfileId: 'b' }] }));

    // in grid mode → reset clears skill draft, leaves profile draft
    s = reducer(s, setViewMode('grid'));
    s = reducer(s, resetCurrentMode());
    expect(s.draft).toEqual({});
    expect(s.profileDraft.a2).toBe('P');

    // in profiles mode → reset clears profile draft
    s = reducer(s, setViewMode('profiles'));
    s = reducer(s, resetCurrentMode());
    expect(s.profileDraft).toEqual({});
  });
});

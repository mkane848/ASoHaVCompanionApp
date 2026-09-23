import { describe, expect, it } from 'vitest';
import { seedLibrary, type EffectTrigger, type EnemyProfile, type ToughnessTier } from '@asohav/shared';
import { validateLibrary } from './adminLogic.js';

describe('validateLibrary — explicit glossary tags (0.24.0)', () => {
  it('flags an unresolved [Tag] in a textarea field', () => {
    const lib = seedLibrary();
    lib.motifs = [...lib.motifs, { Id: 'mo-test', Name: 'Test Motif', Description: 'Triggers on a [Frobnicate].', SkillTagExamples: [], FlawTagExamples: [] }];
    const issues = validateLibrary(lib);
    const hit = issues.find((i) => i.objectId === 'mo-test');
    expect(hit?.message).toContain('unresolved glossary tag [Frobnicate]');
  });

  it('does not flag a tag that resolves by Name', () => {
    const lib = seedLibrary();
    const termName = lib.glossary[0].Name;
    lib.motifs = [...lib.motifs, { Id: 'mo-test', Name: 'Test Motif', Description: `Triggers on a [${termName}].`, SkillTagExamples: [], FlawTagExamples: [] }];
    const issues = validateLibrary(lib);
    expect(issues.find((i) => i.objectId === 'mo-test')).toBeUndefined();
  });

  it('does not flag a tag that resolves by Id via the two-bracket form', () => {
    const lib = seedLibrary();
    const term = lib.glossary[0];
    lib.motifs = [...lib.motifs, { Id: 'mo-test', Name: 'Test Motif', Description: `Triggers on [something][${term.Id}].`, SkillTagExamples: [], FlawTagExamples: [] }];
    const issues = validateLibrary(lib);
    expect(issues.find((i) => i.objectId === 'mo-test')).toBeUndefined();
  });

  it('does not flag ordinary bracket-free prose', () => {
    const lib = seedLibrary();
    lib.motifs = [...lib.motifs, { Id: 'mo-test', Name: 'Test Motif', Description: 'No brackets here at all.', SkillTagExamples: [], FlawTagExamples: [] }];
    const issues = validateLibrary(lib);
    expect(issues.find((i) => i.objectId === 'mo-test')).toBeUndefined();
  });

  it('still catches a dangling ref alongside a clean glossary tag', () => {
    const lib = seedLibrary();
    const termName = lib.glossary[0].Name;
    lib.conditions = [
      ...lib.conditions,
      { Id: 'c-test', Name: 'Test Condition', VirtueId: 'v-does-not-exist', ClearAction: `Clear when you [${termName}].` },
    ];
    const issues = validateLibrary(lib);
    const messages = issues.filter((i) => i.objectId === 'c-test').map((i) => i.message);
    expect(messages.some((m) => m.includes('missing virtues'))).toBe(true);
    expect(messages.some((m) => m.includes('unresolved glossary tag'))).toBe(false);
  });
});

describe('validateLibrary — Move.Results schema (0.30.0)', () => {
  const baseMove = { Id: 'm-test', Name: 'Test Move', Kind: 'Basic' as const, VirtueId: null, Description: 'Test.' };
  const emptyResult = { Description: '', Options: [] as string[], ChooseCount: 0 };

  it('flags a Tier with no Description', () => {
    const lib = seedLibrary();
    lib.moves = [...lib.moves, { ...baseMove, Results: { Tier3: { Description: 'Fine.', Options: [], ChooseCount: 0 }, Tier2: emptyResult, Tier1: emptyResult } }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'm-test' && i.message.includes('Tier2 is missing a Description'))).toBe(true);
  });

  it('flags a ChooseCount higher than the number of Options', () => {
    const lib = seedLibrary();
    lib.moves = [...lib.moves, { ...baseMove, Results: { Tier3: { Description: 'Choose two.', Options: ['Only one option'], ChooseCount: 2 }, Tier2: { Description: '—', Options: [], ChooseCount: 0 }, Tier1: { Description: '—', Options: [], ChooseCount: 0 } } }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'm-test' && i.message.includes('asks to choose 2 but only lists 1'))).toBe(true);
  });

  it('does not flag a well-formed Results block', () => {
    const lib = seedLibrary();
    lib.moves = [...lib.moves, { ...baseMove, Results: { Tier3: { Description: 'Fine.', Options: [], ChooseCount: 0 }, Tier2: { Description: 'Choose one.', Options: ['A', 'B'], ChooseCount: 1 }, Tier1: { Description: 'Fine.', Options: [], ChooseCount: 0 } } }];
    const issues = validateLibrary(lib);
    expect(issues.filter((i) => i.objectId === 'm-test')).toHaveLength(0);
  });

  it('flags an invalid HoldGrant entry', () => {
    const lib = seedLibrary();
    lib.moves = [...lib.moves, { ...baseMove, Results: { Tier3: { Description: 'Fine.', Options: [], ChooseCount: 0 }, Tier2: emptyResult, Tier1: emptyResult }, HoldGrant: { Tier3: 3, Bogus: 1 } as any }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'm-test' && i.message.includes('invalid entry "Bogus"'))).toBe(true);
  });
});

describe('validateLibrary — statusLimits schema (0.35.0)', () => {
  it('does not flag the seeded Villains/NPCs/Enemies — their StatusLimits must already be well-formed', () => {
    const lib = seedLibrary();
    const issues = validateLibrary(lib).filter((i) => ['villains', 'npcs', 'enemies'].includes(i.collection));
    expect(issues).toHaveLength(0);
  });

  it('flags a StatusLimits entry with no Status name', () => {
    const lib = seedLibrary();
    lib.villains = [...lib.villains, { ...lib.villains[0], Id: 'vil-test', StatusLimits: [{ StatusName: '', Limit: 4 }] }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'vil-test' && i.message.includes('no Status name'))).toBe(true);
  });

  it('flags a StatusLimits entry with a Limit of 0 or less', () => {
    const lib = seedLibrary();
    lib.npcs = [...lib.npcs, { ...lib.npcs[0], Id: 'npc-test', StatusLimits: [{ StatusName: 'Hurt', Limit: 0 }] }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'npc-test' && i.message.includes('needs a Limit greater than 0'))).toBe(true);
  });

  it('does not flag a well-formed StatusLimits array', () => {
    const lib = seedLibrary();
    lib.enemies = [...lib.enemies, { Id: 'en-test', Name: 'Test', Description: '', IsBoss: false, Toughness: 'None', StatusLimits: [{ StatusName: 'Hurt', Limit: 4 }] }];
    const issues = validateLibrary(lib);
    expect(issues.filter((i) => i.objectId === 'en-test')).toHaveLength(0);
  });
});

describe('validateLibrary — allowCustom write-in enums (0.37.0)', () => {
  it('flags a non-canonical value on an allowCustom field as informational', () => {
    const lib = seedLibrary();
    lib.npcs = [...lib.npcs, { ...lib.npcs[0], Id: 'npc-test', Type: 'Freelancer' }];
    const issues = validateLibrary(lib);
    const hit = issues.find((i) => i.objectId === 'npc-test');
    expect(hit?.message).toContain('custom, non-canonical value ("Freelancer")');
  });

  it('does not flag a canonical value on an allowCustom field', () => {
    const lib = seedLibrary();
    lib.npcs = [...lib.npcs, { ...lib.npcs[0], Id: 'npc-test', Type: 'Ally' }];
    const issues = validateLibrary(lib);
    expect(issues.find((i) => i.objectId === 'npc-test')).toBeUndefined();
  });

  it('flags a non-canonical Location.LocationType too', () => {
    const lib = seedLibrary();
    lib.locations = [...lib.locations, { ...lib.locations[0], Id: 'loc-test', LocationType: 'Sanctuary' }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'loc-test' && i.message.includes('custom, non-canonical value ("Sanctuary")'))).toBe(true);
  });

  it('does not flag a non-canonical Toughness — that field is not allowCustom', () => {
    const lib = seedLibrary();
    lib.villains = [...lib.villains, { ...lib.villains[0], Id: 'vil-test', Toughness: 'Bogus' as unknown as ToughnessTier }];
    const issues = validateLibrary(lib);
    expect(issues.find((i) => i.objectId === 'vil-test')).toBeUndefined();
  });
});

describe('validateLibrary — Improvement Tree DAG (0.31.0)', () => {
  it('does not flag the seeded Improvement Trees — they must already be a valid DAG', () => {
    const lib = seedLibrary();
    const issues = validateLibrary(lib).filter((i) => i.collection === 'improvements');
    expect(issues).toHaveLength(0);
  });

  it('flags a prerequisite that points at an Improvement on a different tree', () => {
    const lib = seedLibrary();
    const [treeA, treeB] = lib.improvementTrees;
    lib.improvements = [
      ...lib.improvements,
      { Id: 'im-test-start', TreeId: treeA.Id, Name: 'Test Start', Effect: '', IsStarting: true, PrerequisiteIds: [] },
      { Id: 'im-test-cross', TreeId: treeB.Id, Name: 'Test Cross', Effect: '', IsStarting: false, PrerequisiteIds: ['im-test-start'] },
    ];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'im-test-cross' && i.message.includes('different tree'))).toBe(true);
  });

  it('flags a prerequisite cycle', () => {
    const lib = seedLibrary();
    const tree = lib.improvementTrees[0];
    lib.improvements = [
      ...lib.improvements,
      { Id: 'im-test-a', TreeId: tree.Id, Name: 'A', Effect: '', IsStarting: false, PrerequisiteIds: ['im-test-b'] },
      { Id: 'im-test-b', TreeId: tree.Id, Name: 'B', Effect: '', IsStarting: false, PrerequisiteIds: ['im-test-a'] },
    ];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'im-test-a' && i.message.includes('cycle'))).toBe(true);
    expect(issues.some((i) => i.objectId === 'im-test-b' && i.message.includes('cycle'))).toBe(true);
  });

  it('flags a non-starting Improvement with no path back to a Starting Improvement', () => {
    const lib = seedLibrary();
    const tree = lib.improvementTrees[0];
    lib.improvements = [...lib.improvements, { Id: 'im-test-orphan', TreeId: tree.Id, Name: 'Orphan', Effect: '', IsStarting: false, PrerequisiteIds: [] }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'im-test-orphan' && i.message.includes('Not reachable'))).toBe(true);
  });
});

describe('validateLibrary - enemyStatBlock schema (slice 7)', () => {
  it('does not flag a well-formed enemyStatBlock', () => {
    const lib = seedLibrary();
    const block = {
      Profile: 'Standard' as const,
      Threat: 1,
      Size: '1x1' as const,
      Speed: 6,
      Range: 1,
      Guard: 0,
      Virtues: [{ VirtueId: 'v-might', Rating: 1 }],
      StrainBoxes: 3,
      StatusSlots: 1,
      ConditionSlots: 2,
      Unshakable: false,
      LastStandBoxes: 0,
      GambitCharges: 0,
      Attacks: [
        {
          Name: 'Slash',
          Target: 'one hero',
          Range: 1,
          Strain: 2,
          ResistVirtueIds: ['v-might'],
          ConditionVirtueId: null,
          AdditionalEffect: '',
          EffectTrigger: 'OnStrain' as const,
          MisfortuneCost: 0,
          Notes: '',
        },
      ],
      Abilities: 'Passive: something',
    };
    lib.enemies = [...lib.enemies, { Id: 'en-test-block', Name: 'Test Block', Description: '', IsBoss: false, Toughness: 'None', StatusLimits: [], Stats: block }];
    const issues = validateLibrary(lib);
    expect(issues.filter((i) => i.objectId === 'en-test-block')).toHaveLength(0);
  });

  it('flags an invalid Profile', () => {
    const lib = seedLibrary();
    const block = {
      Profile: 'Invalid' as unknown as EnemyProfile,
      Threat: 1,
      Size: '1x1' as const,
      Speed: 6,
      Range: 1,
      Guard: 0,
      Virtues: [],
      StrainBoxes: 3,
      StatusSlots: 1,
      ConditionSlots: 2,
      Unshakable: false,
      LastStandBoxes: 0,
      GambitCharges: 0,
      Attacks: [],
      Abilities: '',
    };
    lib.enemies = [...lib.enemies, { Id: 'en-test-bad-profile', Name: 'Bad Profile', Description: '', IsBoss: false, Toughness: 'None', StatusLimits: [], Stats: block }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'en-test-bad-profile' && i.message.includes('Profile must be one of'))).toBe(true);
  });

  it('flags StrainBoxes < 1', () => {
    const lib = seedLibrary();
    const block = {
      Profile: 'Standard' as const,
      Threat: 1,
      Size: '1x1' as const,
      Speed: 6,
      Range: 1,
      Guard: 0,
      Virtues: [],
      StrainBoxes: 0,
      StatusSlots: 1,
      ConditionSlots: 2,
      Unshakable: false,
      LastStandBoxes: 0,
      GambitCharges: 0,
      Attacks: [],
      Abilities: '',
    };
    lib.enemies = [...lib.enemies, { Id: 'en-test-low-strain', Name: 'Low Strain', Description: '', IsBoss: false, Toughness: 'None', StatusLimits: [], Stats: block }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'en-test-low-strain' && i.message.includes('StrainBoxes must be at least 1'))).toBe(true);
  });

  it('flags LastStandBoxes on non-Legendary', () => {
    const lib = seedLibrary();
    const block = {
      Profile: 'Elite' as const,
      Threat: 2,
      Size: '1x1' as const,
      Speed: 6,
      Range: 1,
      Guard: 0,
      Virtues: [],
      StrainBoxes: 5,
      StatusSlots: 2,
      ConditionSlots: 3,
      Unshakable: false,
      LastStandBoxes: 1,
      GambitCharges: 0,
      Attacks: [],
      Abilities: '',
    };
    lib.enemies = [...lib.enemies, { Id: 'en-test-bad-laststand', Name: 'Bad LastStand', Description: '', IsBoss: false, Toughness: 'None', StatusLimits: [], Stats: block }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'en-test-bad-laststand' && i.message.includes('only Legendary can have LastStandBoxes'))).toBe(true);
  });

  it('flags unknown VirtueId', () => {
    const lib = seedLibrary();
    const block = {
      Profile: 'Standard' as const,
      Threat: 1,
      Size: '1x1' as const,
      Speed: 6,
      Range: 1,
      Guard: 0,
      Virtues: [{ VirtueId: 'v-unknown', Rating: 1 }],
      StrainBoxes: 3,
      StatusSlots: 1,
      ConditionSlots: 2,
      Unshakable: false,
      LastStandBoxes: 0,
      GambitCharges: 0,
      Attacks: [],
      Abilities: '',
    };
    lib.enemies = [...lib.enemies, { Id: 'en-test-bad-virtue', Name: 'Bad Virtue', Description: '', IsBoss: false, Toughness: 'None', StatusLimits: [], Stats: block }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'en-test-bad-virtue' && i.message.includes('unknown VirtueId'))).toBe(true);
  });

  it('flags invalid Virtue Rating', () => {
    const lib = seedLibrary();
    const block = {
      Profile: 'Standard' as const,
      Threat: 1,
      Size: '1x1' as const,
      Speed: 6,
      Range: 1,
      Guard: 0,
      Virtues: [{ VirtueId: 'v-might', Rating: 3 }],
      StrainBoxes: 3,
      StatusSlots: 1,
      ConditionSlots: 2,
      Unshakable: false,
      LastStandBoxes: 0,
      GambitCharges: 0,
      Attacks: [],
      Abilities: '',
    };
    lib.enemies = [...lib.enemies, { Id: 'en-test-bad-rating', Name: 'Bad Rating', Description: '', IsBoss: false, Toughness: 'None', StatusLimits: [], Stats: block }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'en-test-bad-rating' && i.message.includes('rating must be an integer from'))).toBe(true);
  });

  it('flags Attack with no Name', () => {
    const lib = seedLibrary();
    const block = {
      Profile: 'Standard' as const,
      Threat: 1,
      Size: '1x1' as const,
      Speed: 6,
      Range: 1,
      Guard: 0,
      Virtues: [],
      StrainBoxes: 3,
      StatusSlots: 1,
      ConditionSlots: 2,
      Unshakable: false,
      LastStandBoxes: 0,
      GambitCharges: 0,
      Attacks: [
        {
          Name: '',
          Target: 'one hero',
          Range: 1,
          Strain: 2,
          ResistVirtueIds: [],
          ConditionVirtueId: null,
          AdditionalEffect: '',
          EffectTrigger: 'OnStrain' as const,
          MisfortuneCost: 0,
          Notes: '',
        },
      ],
      Abilities: '',
    };
    lib.enemies = [...lib.enemies, { Id: 'en-test-empty-attack', Name: 'Empty Attack', Description: '', IsBoss: false, Toughness: 'None', StatusLimits: [], Stats: block }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'en-test-empty-attack' && i.message.includes('Attack has no Name'))).toBe(true);
  });

  it('flags Attack with negative Strain', () => {
    const lib = seedLibrary();
    const block = {
      Profile: 'Standard' as const,
      Threat: 1,
      Size: '1x1' as const,
      Speed: 6,
      Range: 1,
      Guard: 0,
      Virtues: [],
      StrainBoxes: 3,
      StatusSlots: 1,
      ConditionSlots: 2,
      Unshakable: false,
      LastStandBoxes: 0,
      GambitCharges: 0,
      Attacks: [
        {
          Name: 'Bad Strain',
          Target: 'one hero',
          Range: 1,
          Strain: -1,
          ResistVirtueIds: [],
          ConditionVirtueId: null,
          AdditionalEffect: '',
          EffectTrigger: 'OnStrain' as const,
          MisfortuneCost: 0,
          Notes: '',
        },
      ],
      Abilities: '',
    };
    lib.enemies = [...lib.enemies, { Id: 'en-test-bad-strain', Name: 'Bad Strain', Description: '', IsBoss: false, Toughness: 'None', StatusLimits: [], Stats: block }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'en-test-bad-strain' && i.message.includes('Strain must be'))).toBe(true);
  });

  it('flags Attack with invalid EffectTrigger', () => {
    const lib = seedLibrary();
    const block = {
      Profile: 'Standard' as const,
      Threat: 1,
      Size: '1x1' as const,
      Speed: 6,
      Range: 1,
      Guard: 0,
      Virtues: [],
      StrainBoxes: 3,
      StatusSlots: 1,
      ConditionSlots: 2,
      Unshakable: false,
      LastStandBoxes: 0,
      GambitCharges: 0,
      Attacks: [
        {
          Name: 'Bad Trigger',
          Target: 'one hero',
          Range: 1,
          Strain: 2,
          ResistVirtueIds: [],
          ConditionVirtueId: null,
          AdditionalEffect: '',
          EffectTrigger: 'Invalid' as unknown as EffectTrigger,
          MisfortuneCost: 0,
          Notes: '',
        },
      ],
      Abilities: '',
    };
    lib.enemies = [...lib.enemies, { Id: 'en-test-bad-trigger', Name: 'Bad Trigger', Description: '', IsBoss: false, Toughness: 'None', StatusLimits: [], Stats: block }];
    const issues = validateLibrary(lib);
    expect(issues.some((i) => i.objectId === 'en-test-bad-trigger' && i.message.includes('EffectTrigger must be one of'))).toBe(true);
  });
});

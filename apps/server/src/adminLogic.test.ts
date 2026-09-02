import { describe, expect, it } from 'vitest';
import { seedLibrary } from '@asohav/shared';
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
      { Id: 'c-test', Name: 'Test Condition', VirtueId: 'v-does-not-exist', RollPenalty: -2, ClearAction: `Clear when you [${termName}].` },
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

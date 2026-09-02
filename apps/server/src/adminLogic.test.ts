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

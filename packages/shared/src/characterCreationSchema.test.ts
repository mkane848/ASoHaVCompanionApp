import { describe, expect, it } from 'vitest';
import { characterCreationSchema } from './characterCreationSchema.js';
import { seedLibrary } from './seedLibrary.js';

const library = seedLibrary();
const virtueIds = library.virtues.map((v) => v.Id);
const theme = library.themes[0]!;

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Ember',
    playerName: 'Ryan',
    themeId: theme.Id,
    virtues: virtueIds.map((virtueId, i) => ({ virtueId, score: [2, 1, 1, 0, -1][i] })),
    looks: ['A quiet, watchful stillness.'],
    questIds: [],
    skillIds: [],
    abilityIds: [],
    ...overrides,
  };
}

describe('characterCreationSchema', () => {
  it('accepts a well-formed payload', () => {
    const result = characterCreationSchema(library).safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('trims and requires a non-empty name', () => {
    const result = characterCreationSchema(library).safeParse(validPayload({ name: '   ' }));
    expect(result.success).toBe(false);
  });

  it('rejects an unknown Theme', () => {
    const result = characterCreationSchema(library).safeParse(validPayload({ themeId: 'nope' }));
    expect(result.success).toBe(false);
  });

  it('rejects a non-standard Virtue array', () => {
    const badVirtues = virtueIds.map((virtueId, i) => ({ virtueId, score: i === 0 ? 3 : 0 }));
    const result = characterCreationSchema(library).safeParse(validPayload({ virtues: badVirtues }));
    expect(result.success).toBe(false);
  });

  it('rejects a duplicate or unknown Virtue id', () => {
    const badVirtues = virtueIds.map((virtueId, i) => ({ virtueId: i === 0 ? virtueIds[1] : virtueId, score: [2, 1, 1, 0, -1][i] }));
    const result = characterCreationSchema(library).safeParse(validPayload({ virtues: badVirtues }));
    expect(result.success).toBe(false);
  });

  it('rejects an empty Looks list after trimming whitespace-only entries', () => {
    const result = characterCreationSchema(library).safeParse(validPayload({ looks: ['   ', ''] }));
    expect(result.success).toBe(false);
  });

  it('drops blank Looks entries but keeps real ones', () => {
    const result = characterCreationSchema(library).safeParse(validPayload({ looks: ['  A scar. ', '  '] }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.looks).toEqual(['A scar.']);
  });

  it('rejects an optional Quest not offered by the chosen Theme', () => {
    const otherTheme = library.themes[1]!;
    const result = characterCreationSchema(library).safeParse(validPayload({ questIds: [otherTheme.StartingQuestId] }));
    expect(result.success).toBe(false);
  });

  it('accepts an optional Quest that the chosen Theme does offer', () => {
    const optional = theme.QuestIds.find((id) => id !== theme.StartingQuestId);
    const result = characterCreationSchema(library).safeParse(validPayload({ questIds: optional ? [optional] : [] }));
    expect(result.success).toBe(true);
  });

  it('rejects more Skills than SkillsAtCreation allows', () => {
    const tooMany = library.skills.slice(0, library.settings.SkillsAtCreation + 1).map((s) => s.Id);
    const result = characterCreationSchema(library).safeParse(validPayload({ skillIds: tooMany }));
    expect(result.success).toBe(false);
  });

  it('dedupes Skills before checking the cap, so a repeated id does not count twice', () => {
    const oneSkill = library.skills[0]!.Id;
    const repeated = Array(library.settings.SkillsAtCreation + 5).fill(oneSkill);
    const result = characterCreationSchema(library).safeParse(validPayload({ skillIds: repeated }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.skillIds).toEqual([oneSkill]);
  });

  it('rejects an Ability that is not Acquisition: Starting', () => {
    const nonStarting = library.abilities.find((a) => a.Acquisition !== 'Starting');
    if (!nonStarting) return; // nothing to assert if the seed library has none
    const result = characterCreationSchema(library).safeParse(validPayload({ abilityIds: [nonStarting.Id] }));
    expect(result.success).toBe(false);
  });
});

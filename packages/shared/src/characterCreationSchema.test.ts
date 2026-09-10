import { describe, expect, it } from 'vitest';
import { characterCreationSchema } from './characterCreationSchema.js';
import { seedLibrary } from './seedLibrary.js';

const library = seedLibrary();
const virtueIds = library.virtues.map((v) => v.Id);
const motif = library.motifs[0]!;

function validMotif(overrides: Record<string, unknown> = {}) {
  return { motifId: null, name: 'Sworn', skillTag: 'Tracker', flawTag: 'Stripped of Honor', quest: 'Capture the Chosen One', ...overrides };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Ember',
    pronouns: 'she/her',
    playerName: 'Ryan',
    virtues: virtueIds.map((virtueId, i) => ({ virtueId, score: [2, 1, 1, 0, -1][i] })),
    looks: ['A quiet, watchful stillness.'],
    motifs: [validMotif(), validMotif(), validMotif()],
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

  it('trims and requires non-empty Pronouns', () => {
    const result = characterCreationSchema(library).safeParse(validPayload({ pronouns: '   ' }));
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

  it('rejects fewer than three Motifs', () => {
    const result = characterCreationSchema(library).safeParse(validPayload({ motifs: [validMotif(), validMotif()] }));
    expect(result.success).toBe(false);
  });

  it('rejects more than three Motifs', () => {
    const result = characterCreationSchema(library).safeParse(validPayload({ motifs: [validMotif(), validMotif(), validMotif(), validMotif()] }));
    expect(result.success).toBe(false);
  });

  it('rejects a Motif whose motifId is not in the library', () => {
    const result = characterCreationSchema(library).safeParse(validPayload({ motifs: [validMotif({ motifId: 'nope' }), validMotif(), validMotif()] }));
    expect(result.success).toBe(false);
  });

  it('accepts a library Motif id and a null (custom) Motif id', () => {
    const result = characterCreationSchema(library).safeParse(validPayload({ motifs: [validMotif({ motifId: motif.Id }), validMotif(), validMotif()] }));
    expect(result.success).toBe(true);
  });

  it('rejects a Motif with a blank name, Skill Tag, Flaw Tag, or Quest', () => {
    for (const field of ['name', 'skillTag', 'flawTag', 'quest']) {
      const result = characterCreationSchema(library).safeParse(validPayload({ motifs: [validMotif({ [field]: '   ' }), validMotif(), validMotif()] }));
      expect(result.success).toBe(false);
    }
  });
});

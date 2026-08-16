import { describe, expect, it } from 'vitest';
import { isAppearanceId, APPEARANCES, DEFAULT_APPEARANCE } from './appearances.js';

describe('isAppearanceId', () => {
  it('accepts every id actually listed in APPEARANCES', () => {
    for (const a of APPEARANCES) expect(isAppearanceId(a.id)).toBe(true);
  });

  it('rejects an unknown string', () => {
    expect(isAppearanceId('midnight')).toBe(false);
    expect(isAppearanceId('')).toBe(false);
  });

  it('is case-sensitive — "Parchment" is not the same as "parchment"', () => {
    expect(isAppearanceId('Parchment')).toBe(false);
  });
});

describe('DEFAULT_APPEARANCE', () => {
  it('is itself a valid AppearanceId', () => {
    expect(isAppearanceId(DEFAULT_APPEARANCE)).toBe(true);
  });
});

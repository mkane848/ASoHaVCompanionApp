import { describe, expect, it } from 'vitest';
import {
  grantHold,
  holdEffectsForMove,
  holdGrantingMoves,
  holdPools,
  normalizeHoldByMove,
  normalizeSheet,
  spendHold,
  unassignedHold,
} from './logic.js';
import { seedLibrary } from './seedLibrary.js';
import { seedSheets } from './seedPlay.js';
import type { CharacterSheet, Move } from './types.js';

// V0.7 L506-510: "Each point of Hold can be spent, one-for-one, for a specific effect listed on the
// Move that gave you the Hold."

function sheetWith(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  const base = seedSheets()[0];
  return { ...structuredClone(base), Hold: 0, HoldByMove: {}, ...overrides };
}

describe('holdEffectsForMove', () => {
  const library = seedLibrary();
  const byId = (id: string) => library.moves.find((m) => m.Id === id) as Move;

  it('reads Discern the Truth\'s listed questions from its 10+ result', () => {
    const effects = holdEffectsForMove(byId('m-truth'));
    expect(effects).toHaveLength(6);
    expect(effects[0]).toBe('Are they telling the truth about ______?');
  });

  it('reads Assess the Situation\'s questions, not the 7-9 complications', () => {
    const effects = holdEffectsForMove(byId('m-assess'));
    expect(effects).toHaveLength(6);
    expect(effects).toContain('What here is concealed by magical or mundane means?');
    expect(effects.join(' ')).not.toMatch(/Mark a Condition|Take two Strain|unwanted attention/);
  });

  it('gives a Move that grants no Hold no effects, even if it lists options', () => {
    const move: Move = { ...byId('m-assess'), HoldGrant: undefined };
    expect(holdEffectsForMove(move)).toEqual([]);
  });

  it('finds exactly the Hold-granting Moves in the seed', () => {
    expect(holdGrantingMoves(library).map((m) => m.Id).sort()).toEqual(['m-assess', 'm-truth']);
  });
});

describe('grantHold / spendHold', () => {
  it('remembers which Move granted the Hold and keeps Hold as the total', () => {
    const sheet = sheetWith();
    grantHold(sheet, 'm-assess', 3);
    grantHold(sheet, 'm-truth', 1);
    grantHold(sheet, 'm-assess', 1);
    expect(sheet.Hold).toBe(5);
    expect(sheet.HoldByMove).toEqual({ 'm-assess': 4, 'm-truth': 1 });
    expect(unassignedHold(sheet)).toBe(0);
  });

  it('ignores a zero or negative grant', () => {
    const sheet = sheetWith();
    grantHold(sheet, 'm-assess', 0);
    grantHold(sheet, 'm-assess', -2);
    expect(sheet.Hold).toBe(0);
    expect(sheet.HoldByMove).toEqual({});
  });

  it('spends from the granting Move\'s own bucket and drops an emptied bucket', () => {
    const sheet = sheetWith();
    grantHold(sheet, 'm-assess', 1);
    grantHold(sheet, 'm-truth', 2);
    expect(spendHold(sheet, 'm-truth')).toBe(true);
    expect(sheet.Hold).toBe(2);
    expect(sheet.HoldByMove).toEqual({ 'm-assess': 1, 'm-truth': 1 });
    expect(spendHold(sheet, 'm-assess')).toBe(true);
    expect(sheet.HoldByMove).toEqual({ 'm-truth': 1 });
  });

  it('will not let one Move\'s Hold pay for another Move\'s effect', () => {
    const sheet = sheetWith();
    grantHold(sheet, 'm-assess', 3);
    expect(spendHold(sheet, 'm-truth')).toBe(false);
    expect(sheet.Hold).toBe(3);
    expect(sheet.HoldByMove).toEqual({ 'm-assess': 3 });
  });

  it('refuses to spend with no Hold', () => {
    const sheet = sheetWith();
    expect(spendHold(sheet, 'm-assess')).toBe(false);
    expect(sheet.Hold).toBe(0);
  });

  it('lets older, unassigned Hold be spent on any Move and assigns nothing back', () => {
    // A sheet saved before per-Move tracking: Hold 2, no HoldByMove at all.
    const sheet = sheetWith({ Hold: 2 });
    delete sheet.HoldByMove;
    expect(unassignedHold(sheet)).toBe(2);
    expect(spendHold(sheet, 'm-truth')).toBe(true);
    expect(sheet.Hold).toBe(1);
    expect(unassignedHold(sheet)).toBe(1);
    expect(spendHold(sheet, 'm-assess')).toBe(true);
    expect(sheet.Hold).toBe(0);
    expect(spendHold(sheet, 'm-assess')).toBe(false);
  });

  it('prefers the Move\'s own bucket over the unassigned pool, so a tracked grant is not stranded', () => {
    const sheet = sheetWith({ Hold: 3, HoldByMove: { 'm-truth': 1 } });
    expect(unassignedHold(sheet)).toBe(2);
    spendHold(sheet, 'm-truth');
    expect(sheet.HoldByMove).toEqual({});
    expect(unassignedHold(sheet)).toBe(2);
  });

  it('does not let unassigned Hold run out of the way of a tracked bucket', () => {
    // 1 Hold total, wholly attributed to Assess: Discern the Truth has nothing to spend.
    const sheet = sheetWith({ Hold: 1, HoldByMove: { 'm-assess': 1 } });
    expect(spendHold(sheet, 'm-truth')).toBe(false);
    expect(sheet.Hold).toBe(1);
  });
});

describe('normalizeHoldByMove / normalizeSheet', () => {
  it('defaults a sheet saved without HoldByMove to {} and leaves Hold alone', () => {
    const sheet = sheetWith({ Hold: 2 });
    delete sheet.HoldByMove;
    const normalized = normalizeSheet(sheet);
    expect(normalized.HoldByMove).toEqual({});
    expect(normalized.Hold).toBe(2);
  });

  it('keeps a valid stored object by reference', () => {
    const stored = { 'm-assess': 2 };
    expect(normalizeHoldByMove(stored, 3)).toBe(stored);
  });

  it('clamps buckets that exceed Hold, so a spend can never take Hold below zero', () => {
    expect(normalizeHoldByMove({ 'm-assess': 3, 'm-truth': 2 }, 4)).toEqual({ 'm-assess': 3, 'm-truth': 1 });
    expect(normalizeHoldByMove({ 'm-assess': 3 }, 0)).toEqual({});
  });

  it('drops zero, negative, fractional-to-zero and non-numeric entries', () => {
    const dirty = { a: 0, b: -1, c: 'x', d: 2.7, e: Number.NaN } as unknown as Record<string, number>;
    expect(normalizeHoldByMove(dirty, 5)).toEqual({ d: 2 });
  });

  it('survives garbage in place of the object', () => {
    expect(normalizeHoldByMove(null as never, 2)).toEqual({});
    expect(normalizeHoldByMove([1, 2] as never, 2)).toEqual({});
    expect(normalizeHoldByMove('x' as never, 2)).toEqual({});
  });
});

describe('holdPools / loose Hold', () => {
  const library = seedLibrary();
  const known = new Set(holdGrantingMoves(library).map((m) => m.Id));

  it('lists a pool per Hold-granting Move that has Hold, and the remainder as loose', () => {
    const sheet = sheetWith({ Hold: 5, HoldByMove: { 'm-assess': 2, 'm-truth': 1 } });
    const { pools, loose } = holdPools(sheet, library);
    expect(Object.fromEntries(pools.map((p) => [p.move.Id, p.amount]))).toEqual({ 'm-assess': 2, 'm-truth': 1 });
    expect(loose).toBe(2);
  });

  it('treats Hold recorded against a Move the library no longer has as loose, and lets it be spent', () => {
    const sheet = sheetWith({ Hold: 1, HoldByMove: { 'm-deleted': 1 } });
    expect(holdPools(sheet, library)).toEqual({ pools: [], loose: 1 });
    // Without the known-Move set the code cannot tell the bucket is orphaned.
    expect(spendHold(sheet, 'm-truth')).toBe(false);
    expect(spendHold(sheet, 'm-truth', known)).toBe(true);
    expect(sheet.Hold).toBe(0);
    expect(sheet.HoldByMove).toEqual({});
  });
});

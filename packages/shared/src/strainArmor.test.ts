import { describe, expect, it } from 'vitest';
import {
  armorFit,
  armorLoadCost,
  canAbsorbStrain,
  emptyMarks,
  freeStatusSlots,
  isSubdued,
  itemLoadCost,
  markRank,
  remainingStrainCapacity,
  statusesAbsorb,
  statusPicksFit,
  takeStrainHit,
} from './engine.js';
import { carriedLoad, normalizeSheet } from './logic.js';
import { seedLibrary } from './seedLibrary.js';
import type { CharacterSheet, CharacterStatus, Item, StatusSeverity } from './types.js';

/** V0.7 slice 7 — Temporary Strain, multi-Status absorption, the three Armor types, and the pure
 *  "how much can this Hero still absorb" helper slice 8 builds on. */

const CAPS: Record<StatusSeverity, number> = { Minor: 2, Major: 1, Severe: 1 };
const st = (Severity: StatusSeverity, n = 1): CharacterStatus => ({ Id: `st-${Severity}-${n}`, Severity, Name: 'x', Description: '' });
const row = (...boxes: number[]) => boxes.reduce((m, b) => markRank(m, b), emptyMarks());
const full = () => [true, true, true, true, true];

describe('takeStrainHit — Temporary Strain', () => {
  it('spends one Temporary box first and marks nothing else', () => {
    const r = takeStrainHit(emptyMarks(), 2, 4);
    expect(r.TempStrain).toBe(1);
    expect(r.UsedTemp).toBe(true);
    expect(r.Strain).toEqual(emptyMarks());
    expect(r.Exhausted).toBe(false);
  });

  it('takes only one box per hit however large the hit is', () => {
    expect(takeStrainHit(emptyMarks(), 3, 5).TempStrain).toBe(2);
  });

  it('absorbs a hit that would otherwise find no box (an open Temporary box is somewhere to go)', () => {
    const r = takeStrainHit(full(), 1, 3);
    expect(r.Exhausted).toBe(false);
    expect(r.TempStrain).toBe(0);
  });

  it('marks the regular track once Temporary Strain is gone', () => {
    const r = takeStrainHit(row(2), 0, 2);
    expect(r.Strain).toEqual([false, true, true, false, false]);
    expect(r.UsedTemp).toBe(false);
  });

  it('reports Exhausted and changes nothing when no box can take it', () => {
    const r = takeStrainHit(full(), 0, 2);
    expect(r.Exhausted).toBe(true);
    expect(r.Strain).toEqual(full());
  });

  it('leaves everything alone for a hit already reduced to 0', () => {
    const r = takeStrainHit(row(1), 2, 0);
    expect(r).toMatchObject({ TempStrain: 2, UsedTemp: false, Exhausted: false });
  });

  it('isSubdued is false while a Temporary box is open', () => {
    const statuses = [st('Minor', 1), st('Minor', 2), st('Major'), st('Severe')];
    expect(isSubdued(full(), statuses, CAPS)).toBe(true);
    expect(isSubdued(full(), statuses, CAPS, 1)).toBe(false);
  });
});

describe('multi-Status absorption', () => {
  it('adds each Status taken at once: Minor 2 + Major 4 + Severe 6', () => {
    expect(statusesAbsorb([])).toBe(0);
    expect(statusesAbsorb(['Minor', 'Minor'])).toBe(4);
    expect(statusesAbsorb(['Minor', 'Major', 'Severe'])).toBe(12);
  });

  it('counts free slots per severity and checks a set of picks against them', () => {
    const free = freeStatusSlots([st('Minor', 1), st('Major')], CAPS);
    expect(free).toEqual({ Minor: 1, Major: 0, Severe: 1 });
    expect(statusPicksFit(['Minor', 'Severe'], free)).toBe(true);
    expect(statusPicksFit(['Minor', 'Minor'], free)).toBe(false);
    expect(statusPicksFit(['Major'], free)).toBe(false);
    expect(statusPicksFit([], free)).toBe(true);
  });
});

describe('remainingStrainCapacity / canAbsorbStrain — what a Hero can still absorb', () => {
  it('an empty track with its top box free takes a hit of any size', () => {
    const c = remainingStrainCapacity({ Strain: emptyMarks(), Statuses: [] }, CAPS);
    expect(c).toMatchObject({ TempBoxes: 0, FreeBoxes: 5, HighestFreeBox: 5, MaxSingleHit: Infinity });
  });

  it('a Temporary box takes a hit of any size even on a full track', () => {
    const c = remainingStrainCapacity({ Strain: full(), TempStrain: 1, Statuses: [] }, CAPS);
    expect(c.FreeBoxes).toBe(0);
    expect(c.MaxSingleHit).toBe(Infinity);
    expect(canAbsorbStrain({ Strain: full(), TempStrain: 1, Statuses: [] }, 5, CAPS)).toBe(true);
  });

  it('with the top box marked, the ceiling is the highest open box plus open Status slots', () => {
    // boxes 4 and 5 marked: highest open is 3; open slots Minor x2 + Major + Severe absorb 2+2+4+6.
    const sheet = { Strain: row(4, 5), Statuses: [] as CharacterStatus[] };
    const c = remainingStrainCapacity(sheet, CAPS);
    expect(c.HighestFreeBox).toBe(3);
    expect(c.StatusAbsorb).toBe(14);
    expect(c.MaxSingleHit).toBe(17);
    expect(canAbsorbStrain(sheet, 17, CAPS)).toBe(true);
    expect(canAbsorbStrain(sheet, 18, CAPS)).toBe(false);
  });

  it('only open slots count: filled Statuses absorb nothing more', () => {
    const sheet = { Strain: full(), Statuses: [st('Minor', 1), st('Minor', 2), st('Major'), st('Severe')] };
    const c = remainingStrainCapacity(sheet, CAPS);
    expect(c).toMatchObject({ FreeBoxes: 0, HighestFreeBox: 0, StatusAbsorb: 0, MaxSingleHit: 0 });
    expect(canAbsorbStrain(sheet, 1, CAPS)).toBe(false);
    expect(canAbsorbStrain(sheet, 0, CAPS)).toBe(true);
  });

  it('agrees with takeStrainHit: a hit it says is absorbable does not exhaust once the Statuses are taken', () => {
    const sheet = { Strain: row(3, 4, 5), Statuses: [] as CharacterStatus[] }; // highest open: 2
    const c = remainingStrainCapacity(sheet, { Minor: 1, Major: 0, Severe: 0 });
    expect(c.MaxSingleHit).toBe(4);
    // a hit of 4: take the Minor (2), mark the remaining 2.
    expect(takeStrainHit(sheet.Strain, 0, 4 - 2).Exhausted).toBe(false);
    // a hit of 5: Minor leaves 3, which lands nowhere.
    expect(takeStrainHit(sheet.Strain, 0, 5 - 2).Exhausted).toBe(true);
    expect(canAbsorbStrain(sheet, 5, { Minor: 1, Major: 0, Severe: 0 })).toBe(false);
  });

  it('treats a missing TempStrain as 0', () => {
    expect(remainingStrainCapacity({ Strain: row(5), Statuses: [] }, CAPS).TempBoxes).toBe(0);
  });
});

describe('armorFit — the three Armor types against the GM tag', () => {
  it('Armor (Physical) stops any source, tagged or not', () => {
    expect(armorFit('Physical', undefined, undefined)).toBe('applies');
    expect(armorFit('Physical', { OnBody: false, Effect: 'fire' }, undefined)).toBe('applies');
  });

  it('Heavy Armor needs the hit on the body', () => {
    expect(armorFit('Heavy', { OnBody: true, Effect: '' }, undefined)).toBe('applies');
    expect(armorFit('Heavy', { OnBody: false, Effect: 'poison' }, undefined)).toBe('blocked');
  });

  it('Heavy and Special are unsure when the GM left the hit untagged', () => {
    expect(armorFit('Heavy', undefined, undefined)).toBe('unsure');
    expect(armorFit('Special', undefined, ['fire'])).toBe('unsure');
  });

  it('Special Armor applies only to a listed effect, matched loosely and case-insensitively', () => {
    expect(armorFit('Special', { OnBody: false, Effect: 'Fire' }, ['fire', 'cold'])).toBe('applies');
    expect(armorFit('Special', { OnBody: true, Effect: 'fire damage' }, ['Fire'])).toBe('applies');
    expect(armorFit('Special', { OnBody: true, Effect: 'poison' }, ['fire'])).toBe('blocked');
  });

  it('Special Armor is blocked when the GM named no effect, and unsure when it lists none', () => {
    expect(armorFit('Special', { OnBody: true, Effect: '  ' }, ['fire'])).toBe('blocked');
    expect(armorFit('Special', { OnBody: false, Effect: 'fire' }, [])).toBe('unsure');
    expect(armorFit('Special', { OnBody: false, Effect: 'fire' }, undefined)).toBe('unsure');
  });
});

describe('Armor Load', () => {
  const armorTypes = seedLibrary().armorTypes;
  const item = (o: Partial<Item>): Item => ({ Id: 'i-x', Name: 'x', Description: '', LoadCost: 2, ...o });

  it('Armor and Heavy cost 1 Load; Special keeps the item’s own cost', () => {
    expect(armorLoadCost('Physical', 2)).toBe(1);
    expect(armorLoadCost('Heavy', 2)).toBe(1);
    expect(armorLoadCost('Special', 2)).toBe(2);
    expect(armorLoadCost('Special', 0)).toBe(0);
  });

  it('an item granting Heavy Armor costs 1 even if its stored cost is 2 (a library not yet reset)', () => {
    expect(itemLoadCost(item({ GrantsArmorTypeId: 'a-heavy' }), armorTypes)).toBe(1);
    expect(itemLoadCost(item({ GrantsArmorTypeId: 'a-special' }), armorTypes)).toBe(2);
    expect(itemLoadCost(item({}), armorTypes)).toBe(2);
    expect(itemLoadCost(item({ GrantsArmorTypeId: 'a-gone' }), armorTypes)).toBe(2);
  });

  it('carriedLoad applies it only when armor types are passed, and only to carried items', () => {
    const items = [item({ Id: 'i-mail', GrantsArmorTypeId: 'a-heavy' }), item({ Id: 'i-banner' })];
    const sheet = {
      Items: [
        { ItemId: 'i-mail', Carried: true, ChargesUsed: 0 },
        { ItemId: 'i-banner', Carried: true, ChargesUsed: 0 },
      ],
      WildcardDeclarations: [],
    } as unknown as CharacterSheet;
    expect(carriedLoad(sheet, items)).toBe(4);
    expect(carriedLoad(sheet, items, armorTypes)).toBe(3);
  });

  it('the seeded Coat of mail costs 1 Load', () => {
    expect(seedLibrary().items.find((i) => i.Id === 'i-mail')?.LoadCost).toBe(1);
  });
});

describe('normalizeSheet — V0.7 slice 7 defaults', () => {
  const base = { Armor: [] } as unknown as CharacterSheet;

  it('defaults TempStrain to 0 on a sheet saved without it', () => {
    expect(normalizeSheet(base).TempStrain).toBe(0);
  });

  it('keeps a stored whole count, and floors junk to 0', () => {
    expect(normalizeSheet({ ...base, TempStrain: 3 }).TempStrain).toBe(3);
    expect(normalizeSheet({ ...base, TempStrain: -2 }).TempStrain).toBe(0);
    expect(normalizeSheet({ ...base, TempStrain: 'x' as unknown as number }).TempStrain).toBe(0);
  });
});

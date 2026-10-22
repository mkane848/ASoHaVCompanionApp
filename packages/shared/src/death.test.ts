import { describe, expect, it } from 'vitest';
import {
  canAbsorbStrain,
  emptyMarks,
  markRank,
  remainingStrainCapacity,
  secondStrainOpen,
  takeStrainHit,
} from './engine.js';
import {
  addScar,
  applyDyingChoice,
  applyStrainToSheet,
  clearDyingState,
  DeathRuleError,
  isHeroOut,
  removeOneStrain,
  removeScar,
} from './death.js';
import { normalizeSheet } from './logic.js';
import type { CharacterSheet, StatusSeverity } from './types.js';

/** V0.7 slice 8b — Take a Scar, Risk Death, Blaze of Glory, the second Strain mark, the fourth Scar
 *  (Ruleset-V0.7.md L615-656; owner rulings of 2026-10-22). */

const CAPS: Record<StatusSeverity, number> = { Minor: 0, Major: 0, Severe: 0 }; // slots all full: nothing to mitigate
const full = (n = 5) => Array.from({ length: n }, () => true);

function sheet(over: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    Strain: full(), StrainSecond: emptyMarks(5), TempStrain: 0, Statuses: [], StrainBoxBonus: 0,
    Dying: true, DyingChoice: null, LifeState: 'Alive', Ending: null, Scars: [],
    ...over,
  } as unknown as CharacterSheet;
}

describe('the second Strain mark', () => {
  it('is open only while Dying with a recorded choice', () => {
    expect(secondStrainOpen({ Dying: true, DyingChoice: 'Scar' })).toBe(true);
    expect(secondStrainOpen({ Dying: true, DyingChoice: 'RiskDeath' })).toBe(true);
    expect(secondStrainOpen({ Dying: true, DyingChoice: null })).toBe(false);
    expect(secondStrainOpen({ Dying: false, DyingChoice: 'Scar' })).toBe(false);
    expect(secondStrainOpen({ Dying: true, DyingChoice: 'Scar', LifeState: 'Dead' })).toBe(false);
    expect(secondStrainOpen({})).toBe(false);
  });

  it('takeStrainHit marks the second row when the first has no higher box, then exhausts', () => {
    const first = takeStrainHit(full(), 0, 3, 5, emptyMarks(5));
    expect(first.UsedSecond).toBe(true);
    expect(first.Exhausted).toBe(false);
    expect(first.StrainSecond).toEqual([false, false, true, false, false]);
    // A second hit of 3 lands on the next box to the right in the second row.
    expect(takeStrainHit(full(), 0, 3, 5, first.StrainSecond).StrainSecond).toEqual([false, false, true, true, false]);
    // No higher second-row box: nothing can take it.
    expect(takeStrainHit(full(), 0, 5, 5, [false, false, false, false, true]).Exhausted).toBe(true);
  });

  it('without the second row passed the same hit is Exhausted (Dying, slice 8a behaviour)', () => {
    expect(takeStrainHit(full(), 0, 3, 5).Exhausted).toBe(true);
  });

  it('counts box count from the track length passed, including bonus boxes', () => {
    const six = full(6);
    expect(takeStrainHit(six, 0, 6, 6, emptyMarks(6)).UsedSecond).toBe(true);
    expect(takeStrainHit(six, 0, 6, 6, [...full(5), false]).UsedSecond).toBe(true);
    expect(takeStrainHit(six, 0, 6, 6, full(6)).Exhausted).toBe(true);
  });

  it('remainingStrainCapacity and canAbsorbStrain count the second row only when it is open', () => {
    const closed = sheet({ DyingChoice: null });
    expect(remainingStrainCapacity(closed, CAPS).SecondOpen).toBe(false);
    expect(canAbsorbStrain(closed, 2, CAPS)).toBe(false);

    const open = sheet({ DyingChoice: 'Scar' });
    const cap = remainingStrainCapacity(open, CAPS);
    expect(cap.SecondOpen).toBe(true);
    expect(cap.FreeBoxesSecond).toBe(5);
    expect(cap.MaxSingleHit).toBe(Infinity); // the top second-row box is free
    expect(canAbsorbStrain(open, 5, CAPS)).toBe(true);

    // Second row marked at 4 and 5: the highest open second-row box is 3.
    const nearly = sheet({ DyingChoice: 'Scar', StrainSecond: [false, false, false, true, true] });
    expect(remainingStrainCapacity(nearly, CAPS).MaxSingleHit).toBe(3);
    expect(canAbsorbStrain(nearly, 3, CAPS)).toBe(true);
    expect(canAbsorbStrain(nearly, 4, CAPS)).toBe(false);
  });

  it('an open Status slot still mitigates when the second row is the limit', () => {
    const nearly = sheet({ DyingChoice: 'Scar', StrainSecond: [false, false, false, true, true] });
    expect(canAbsorbStrain(nearly, 5, { Minor: 1, Major: 0, Severe: 0 })).toBe(true); // 3 + 2 absorb
  });
});

describe('applyStrainToSheet (the death threshold)', () => {
  it('a hit nothing can take makes a Hero Dying; with the second row open it kills them', () => {
    const s = sheet({ Dying: false });
    expect(applyStrainToSheet(s, 3, 5).Outcome).toBe('Dying');
    expect(s.Dying).toBe(true);
    expect(s.LifeState).toBe('Alive');

    s.DyingChoice = 'Scar';
    expect(applyStrainToSheet(s, 3, 5).Outcome).toBe('Absorbed'); // second mark
    expect(s.StrainSecond[2]).toBe(true);
    s.StrainSecond = full();
    const result = applyStrainToSheet(s, 3, 5, '2026-10-22T00:00:00Z');
    expect(result.Outcome).toBe('Died');
    expect(s.LifeState).toBe('Dead');
    expect(s.Ending).toMatchObject({ Kind: 'StrainDeath', At: '2026-10-22T00:00:00Z' });
  });

  it('a Dying Hero with no choice recorded is not killed by another hit', () => {
    const s = sheet();
    expect(applyStrainToSheet(s, 3, 5).Outcome).toBe('Dying');
    expect(s.LifeState).toBe('Alive');
  });
});

describe('Dying choices', () => {
  it('Take a Scar keeps the Hero Dying and unlocks the second marks', () => {
    const s = sheet();
    expect(applyDyingChoice(s, { Choice: 'Scar', ScarText: ' Lost two fingers ' })).toBe('ScarTaken');
    expect(s.Dying).toBe(true);
    expect(s.DyingChoice).toBe('Scar');
    expect(s.Scars.map((x) => x.Text)).toEqual(['Lost two fingers']);
    expect(secondStrainOpen(s)).toBe(true);
  });

  it('Risk Death 10+ removes the highest Strain box and clears Dying', () => {
    const s = sheet({ Strain: [true, true, false, true, false] });
    expect(applyDyingChoice(s, { Choice: 'RiskDeath', Tier: 'Tier3' })).toBe('Survived');
    expect(s.Strain).toEqual([true, true, false, false, false]);
    expect(s.Dying).toBe(false);
    expect(s.DyingChoice).toBeNull();
    expect(s.LifeState).toBe('Alive');
  });

  it('Risk Death 10+ on an empty track still clears Dying', () => {
    const s = sheet({ Strain: emptyMarks(5) });
    expect(applyDyingChoice(s, { Choice: 'RiskDeath', Tier: 'Tier3' })).toBe('Survived');
    expect(s.Dying).toBe(false);
  });

  it('removeOneStrain takes a second-row mark before a first-row one', () => {
    const s = sheet({ StrainSecond: [false, true, false, false, false] });
    removeOneStrain(s);
    expect(s.StrainSecond).toEqual(emptyMarks(5));
    expect(s.Strain).toEqual(full());
    removeOneStrain(s);
    expect(s.Strain).toEqual([true, true, true, true, false]);
  });

  it('Risk Death 7-9 accepted records the Scar, stays Dying and unlocks second marks', () => {
    const s = sheet();
    expect(applyDyingChoice(s, { Choice: 'RiskDeath', Tier: 'Tier2', ScarText: 'A burned face', Accept: true })).toBe('ScarTaken');
    expect(s.Dying).toBe(true);
    expect(s.DyingChoice).toBe('RiskDeath');
    expect(s.Scars).toHaveLength(1);
  });

  it('Risk Death 7-9 needs the GM-chosen Scar text when accepted', () => {
    expect(() => applyDyingChoice(sheet(), { Choice: 'RiskDeath', Tier: 'Tier2', Accept: true })).toThrow(DeathRuleError);
  });

  it('Risk Death 7-9 refused kills the Hero', () => {
    const s = sheet();
    expect(applyDyingChoice(s, { Choice: 'RiskDeath', Tier: 'Tier2', Accept: false, Text: 'No.' })).toBe('Died');
    expect(s.LifeState).toBe('Dead');
    expect(s.Ending).toMatchObject({ Kind: 'ScarRefused', Text: 'No.' });
    expect(s.Scars).toHaveLength(0);
  });

  it('Risk Death 6- kills the Hero and records last words', () => {
    const s = sheet();
    expect(applyDyingChoice(s, { Choice: 'RiskDeath', Tier: 'Tier1', Text: 'Light the beacon.' })).toBe('Died');
    expect(s.LifeState).toBe('Dead');
    expect(s.Ending).toMatchObject({ Kind: 'RiskDeathFailed', Text: 'Light the beacon.' });
  });

  it('Blaze of Glory records the achievement and the Hero dies', () => {
    const s = sheet();
    expect(applyDyingChoice(s, { Choice: 'BlazeOfGlory', Text: 'Brings down the tower' })).toBe('Died');
    expect(s.Ending).toMatchObject({ Kind: 'BlazeOfGlory', Text: 'Brings down the tower' });
    expect(() => applyDyingChoice(sheet(), { Choice: 'BlazeOfGlory', Text: '' })).toThrow(DeathRuleError);
  });

  it('refuses when not Dying, already chosen, or out of play', () => {
    expect(() => applyDyingChoice(sheet({ Dying: false }), { Choice: 'Scar', ScarText: 'x' })).toThrow(/Dying/);
    expect(() => applyDyingChoice(sheet({ DyingChoice: 'Scar' }), { Choice: 'RiskDeath', Tier: 'Tier3' })).toThrow(/already/);
    expect(() => applyDyingChoice(sheet({ LifeState: 'Retired' }), { Choice: 'Scar', ScarText: 'x' })).toThrow(/no longer in play/);
  });

  it('refuses over-long text', () => {
    expect(() => applyDyingChoice(sheet(), { Choice: 'Scar', ScarText: 'x'.repeat(1001) })).toThrow(DeathRuleError);
  });
});

describe('the fourth Scar', () => {
  const three = () => [1, 2, 3].map((n) => ({ Id: `s${n}`, Text: `Scar ${n}`, At: 't' }));

  it('is recorded as the final Scar and the Hero is Retired, not Dead', () => {
    const s = sheet({ Scars: three() });
    expect(applyDyingChoice(s, { Choice: 'Scar', ScarText: 'The last', Note: 'Walks away from the road.' })).toBe('Retired');
    expect(s.Scars).toHaveLength(4);
    expect(s.LifeState).toBe('Retired');
    expect(s.Ending).toMatchObject({ Kind: 'FourthScar', Text: 'Walks away from the road.' });
    expect(isHeroOut(s)).toBe(true);
  });

  it('also retires from a Risk Death 7-9 Scar', () => {
    const s = sheet({ Scars: three() });
    expect(applyDyingChoice(s, { Choice: 'RiskDeath', Tier: 'Tier2', ScarText: 'The last', Accept: true })).toBe('Retired');
    expect(s.LifeState).toBe('Retired');
  });

  it('addScar below four does not retire', () => {
    const s = sheet();
    expect(addScar(s, 'One').Retired).toBe(false);
    expect(s.LifeState).toBe('Alive');
  });
});

describe('Remove Scar and clearing Dying', () => {
  it('removeScar removes one by id and reports whether it did', () => {
    const s = sheet({ Scars: [{ Id: 'a', Text: 'A', At: 't' }, { Id: 'b', Text: 'B', At: 't' }] });
    expect(removeScar(s, 'a')).toBe(true);
    expect(s.Scars.map((x) => x.Id)).toEqual(['b']);
    expect(removeScar(s, 'zzz')).toBe(false);
  });

  it('clearDyingState drops the choice and every second mark', () => {
    const s = sheet({ DyingChoice: 'Scar', StrainSecond: full() });
    clearDyingState(s);
    expect(s.Dying).toBe(false);
    expect(s.DyingChoice).toBeNull();
    expect(s.StrainSecond).toEqual(emptyMarks(5));
  });
});

describe('legacy sheets (read-time defaults)', () => {
  const legacy = { Strain: [false, true, false, false, false], Dying: true, Scars: [{ Id: 's', Text: 'old', At: 't' }] } as unknown as CharacterSheet;

  it('normalizeSheet backfills every slice 8b field', () => {
    const n = normalizeSheet(legacy);
    expect(n.DyingChoice).toBeNull();
    expect(n.StrainSecond).toEqual(emptyMarks(5));
    expect(n.LifeState).toBe('Alive');
    expect(n.Ending).toBeNull();
    expect(n.Scars).toHaveLength(1);
    expect(markRank(n.Strain, 2)).toBeTruthy();
  });

  it('pads the second row to the track length including bonus boxes', () => {
    const n = normalizeSheet({ ...legacy, StrainBoxBonus: 2, Strain: emptyMarks(5) } as CharacterSheet);
    expect(n.Strain).toHaveLength(7);
    expect(n.StrainSecond).toHaveLength(7);
  });

  it('keeps a stored row as it is (so the heal-on-read check sees no change)', () => {
    const row = {
      Strain: emptyMarks(5), StrainSecond: emptyMarks(5), DyingChoice: 'Scar', LifeState: 'Dead',
      Ending: { Kind: 'BlazeOfGlory', Text: 't', At: 'a' }, Dying: true, Scars: [],
    } as unknown as CharacterSheet;
    const n = normalizeSheet(row);
    expect(n.StrainSecond).toBe(row.StrainSecond);
    expect(n.Ending).toBe(row.Ending);
    expect(n.LifeState).toBe('Dead');
    expect(n.DyingChoice).toBe('Scar');
  });

  it('ignores a garbage LifeState or DyingChoice', () => {
    const n = normalizeSheet({ ...legacy, LifeState: 'Zombie', DyingChoice: 'BlazeOfGlory' } as unknown as CharacterSheet);
    expect(n.LifeState).toBe('Alive');
    expect(n.DyingChoice).toBeNull();
  });
});

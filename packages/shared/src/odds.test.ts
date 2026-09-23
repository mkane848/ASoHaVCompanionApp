import { describe, expect, it } from 'vitest';
import { rollOdds } from './odds.js';

// Exact counts, enumerated independently of the implementation (every die combination, sorted,
// the kept dice summed, the modifier added, then bucketed at 6-/7–9/10+ and 12+).
describe('rollOdds', () => {
  it('2d6: P(10+) = 6/36, P(6-) = 15/36, P(12+) = 1/36', () => {
    expect(rollOdds(0, 'Normal')).toEqual({ Outcomes: 36, Tier1: 15, Tier2: 15, Tier3: 6, TwelvePlus: 1 });
  });

  it('2d6 across the modifier range', () => {
    expect(rollOdds(-3, 'Normal')).toEqual({ Outcomes: 36, Tier1: 30, Tier2: 6, Tier3: 0, TwelvePlus: 0 });
    expect(rollOdds(3, 'Normal')).toEqual({ Outcomes: 36, Tier1: 3, Tier2: 12, Tier3: 21, TwelvePlus: 10 });
  });

  it('Advantage: 3d6 keeping the best two', () => {
    expect(rollOdds(0, 'Advantage')).toEqual({ Outcomes: 216, Tier1: 42, Tier2: 97, Tier3: 77, TwelvePlus: 16 });
    expect(rollOdds(-3, 'Advantage')).toEqual({ Outcomes: 216, Tier1: 139, Tier2: 77, Tier3: 0, TwelvePlus: 0 });
    expect(rollOdds(3, 'Advantage')).toEqual({ Outcomes: 216, Tier1: 4, Tier2: 38, Tier3: 174, TwelvePlus: 113 });
  });

  it('Disadvantage: 3d6 keeping the worst two', () => {
    expect(rollOdds(0, 'Disadvantage')).toEqual({ Outcomes: 216, Tier1: 147, Tier2: 58, Tier3: 11, TwelvePlus: 1 });
    expect(rollOdds(-3, 'Disadvantage')).toEqual({ Outcomes: 216, Tier1: 205, Tier2: 11, Tier3: 0, TwelvePlus: 0 });
    expect(rollOdds(3, 'Disadvantage')).toEqual({ Outcomes: 216, Tier1: 43, Tier2: 104, Tier3: 69, TwelvePlus: 23 });
  });

  it('Double Disadvantage: 4d6 keeping the worst two', () => {
    expect(rollOdds(0, 'DoubleDisadvantage')).toEqual({ Outcomes: 1296, Tier1: 1071, Tier2: 205, Tier3: 20, TwelvePlus: 1 });
    expect(rollOdds(-3, 'DoubleDisadvantage')).toEqual({ Outcomes: 1296, Tier1: 1276, Tier2: 20, Tier3: 0, TwelvePlus: 0 });
    expect(rollOdds(3, 'DoubleDisadvantage')).toEqual({ Outcomes: 1296, Tier1: 415, Tier2: 656, Tier3: 225, TwelvePlus: 52 });
  });

  it('a Severe Status rolls 1d6', () => {
    expect(rollOdds(0, 'OneDie')).toEqual({ Outcomes: 6, Tier1: 6, Tier2: 0, Tier3: 0, TwelvePlus: 0 });
    expect(rollOdds(3, 'OneDie')).toEqual({ Outcomes: 6, Tier1: 3, Tier2: 3, Tier3: 0, TwelvePlus: 0 });
  });

  it('every shape and modifier accounts for every outcome', () => {
    for (const shape of ['Normal', 'Advantage', 'Disadvantage', 'DoubleDisadvantage', 'OneDie'] as const) {
      for (let m = -3; m <= 3; m += 1) {
        const o = rollOdds(m, shape);
        expect(o.Tier1 + o.Tier2 + o.Tier3).toBe(o.Outcomes);
        expect(o.TwelvePlus).toBeLessThanOrEqual(o.Tier3);
      }
    }
  });
});

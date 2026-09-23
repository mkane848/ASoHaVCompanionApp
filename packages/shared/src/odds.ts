import type { AdvantageState } from './engine.js';

/** The shape of the dice a Hero Roll uses: 2d6 (`Normal`), 3d6 keeping the best two
 *  (`Advantage`) or the worst two (`Disadvantage`), 4d6 keeping the worst two
 *  (`DoubleDisadvantage`), or a Severe Status's "roll 1d6 instead of 2d6" (`OneDie`). */
export type RollShape = AdvantageState | 'OneDie';

/** How many of a roll's equally likely dice outcomes land on each tier, once `modifier` is added:
 *  `Tier1` 6-, `Tier2` 7–9, `Tier3` 10+, and `TwelvePlus` (12+, a subset of `Tier3` — a Gambit's
 *  "rolled 12+" threshold). `Outcomes` is the total enumerated: 6, 36, 216 or 1296. Counts rather
 *  than floats, so a probability is exact — `Tier3 / Outcomes`. */
export interface RollOdds {
  Outcomes: number;
  Tier1: number;
  Tier2: number;
  Tier3: number;
  TwelvePlus: number;
}

/** The dice-odds readout (revised V0.6 slice 9, admin-only behind Debug mode): every outcome of
 *  the shape's dice is enumerated and counted. Deterministic arithmetic — it rolls nothing, which
 *  is why it doesn't touch CLAUDE.md's "never add randomness to the rules engine" (`decisions.md`
 *  item 53). */
/** How many d6 each shape rolls, and which of them it keeps. */
const SHAPE_DICE: Record<RollShape, { dice: number; keep: 'all' | 'best' | 'worst' }> = {
  OneDie: { dice: 1, keep: 'all' },
  Normal: { dice: 2, keep: 'all' },
  Advantage: { dice: 3, keep: 'best' },
  Disadvantage: { dice: 3, keep: 'worst' },
  DoubleDisadvantage: { dice: 4, keep: 'worst' },
};

const FACES = [1, 2, 3, 4, 5, 6];

export function rollOdds(modifier: number, shape: RollShape): RollOdds {
  const { dice, keep } = SHAPE_DICE[shape];
  let rolls: number[][] = [[]];
  for (let i = 0; i < dice; i += 1) rolls = rolls.flatMap((roll) => FACES.map((face) => [...roll, face]));

  const odds: RollOdds = { Outcomes: 0, Tier1: 0, Tier2: 0, Tier3: 0, TwelvePlus: 0 };
  for (const roll of rolls) {
    const sorted = [...roll].sort((a, b) => a - b);
    const kept = keep === 'best' ? sorted.slice(-2) : keep === 'worst' ? sorted.slice(0, 2) : sorted;
    const total = kept.reduce((sum, d) => sum + d, 0) + modifier;
    odds.Outcomes += 1;
    if (total >= 10) odds.Tier3 += 1;
    else if (total >= 7) odds.Tier2 += 1;
    else odds.Tier1 += 1;
    if (total >= 12) odds.TwelvePlus += 1;
  }
  return odds;
}

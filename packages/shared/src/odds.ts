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
export function rollOdds(modifier: number, shape: RollShape): RollOdds {
  void modifier;
  void shape;
  throw new Error('not implemented: WP-9A');
}

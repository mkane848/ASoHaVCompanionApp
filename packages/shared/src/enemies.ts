import type { EnemyProfile, EnemyStatBlock } from './types.js';

// Enemy stat blocks and encounter building (revised V0.6, slice 7 — Ruleset-V0.6.md, "Enemies in
// Combat"). Kept out of `combat.ts`, which is the Hero-facing turn and offer machinery.

/** One row of the Threat Levels table, plus the Standard Enemy Rules every profile starts from.
 *  `StrainBoxes` is the value a new block starts at where the table gives a range (Standard 1–3,
 *  Elite 4–5): the top of the range, since the ruleset's own advice is to lower an Enemy's Strain as
 *  the Heroes grow rather than raise it (`StrainRange` keeps the table's range for display). A
 *  Minion's single box is "any Move that inflicts at least 1 Strain Subdues it". A Legendary's
 *  boxes are per phase. */
export interface EnemyProfileDefaults {
  Threat: number;
  StrainBoxes: number;
  StrainRange: [number, number];
  StatusSlots: number;
  ConditionSlots: number;
  /** The table's "Typical Attack" Strain range — authoring guidance only. */
  TypicalAttack: [number, number];
  LastStandBoxes: number;
  /** What the profile does on its turn, from its own section of the ruleset. */
  Turn: string;
}

export const ENEMY_PROFILE_DEFAULTS: Record<EnemyProfile, EnemyProfileDefaults> = {
  Minion: {
    Threat: 0.5,
    StrainBoxes: 1,
    StrainRange: [1, 1],
    StatusSlots: 0,
    ConditionSlots: 1,
    TypicalAttack: [1, 2],
    LastStandBoxes: 0,
    Turn: 'Moves and attacks as a group, one unit. Several Minions attacking one Hero combine their Strain into one attack (at most 5).',
  },
  Standard: {
    Threat: 1,
    StrainBoxes: 3,
    StrainRange: [1, 3],
    StatusSlots: 1,
    ConditionSlots: 2,
    TypicalAttack: [2, 3],
    LastStandBoxes: 0,
    Turn: 'One turn per round: move and take one action.',
  },
  Elite: {
    Threat: 2,
    StrainBoxes: 5,
    StrainRange: [4, 5],
    StatusSlots: 2,
    ConditionSlots: 3,
    TypicalAttack: [2, 4],
    LastStandBoxes: 0,
    Turn: 'One turn per round: move and take two actions.',
  },
  Legendary: {
    Threat: 4,
    StrainBoxes: 5,
    StrainRange: [5, 5],
    StatusSlots: 3,
    ConditionSlots: 5,
    TypicalAttack: [2, 5],
    LastStandBoxes: 3,
    Turn: 'A turn after every Hero’s turn. Opening, then Bloodied, then Last Stand (N).',
  },
};

/** "Unless a stat block says otherwise, an Enemy has: Speed 6. Range 1. Guard 0." */
export const STANDARD_ENEMY_SPEED = 6;
export const STANDARD_ENEMY_RANGE = 1;
export const STANDARD_ENEMY_GUARD = 0;

/** A new stat block for `profile`, from its defaults and the Standard Enemy Rules. The Size is
 *  1x1, "an average human", for every profile. */
export function defaultStatBlock(profile: EnemyProfile): EnemyStatBlock {
  const d = ENEMY_PROFILE_DEFAULTS[profile];
  return {
    Profile: profile,
    Threat: d.Threat,
    Size: '1x1',
    Speed: STANDARD_ENEMY_SPEED,
    Range: STANDARD_ENEMY_RANGE,
    Guard: STANDARD_ENEMY_GUARD,
    Virtues: [],
    StrainBoxes: d.StrainBoxes,
    StatusSlots: d.StatusSlots,
    ConditionSlots: d.ConditionSlots,
    Unshakable: false,
    LastStandBoxes: d.LastStandBoxes,
    GambitCharges: 0,
    Attacks: [],
    Abilities: '',
  };
}

export type EncounterDifficultyBand = 'Easy' | 'Medium' | 'Hard' | 'Deadly' | 'Very Deadly';

export interface EncounterDifficulty {
  TotalThreat: number;
  /** Null with no Heroes to divide by. */
  ThreatPerHero: number | null;
  Band: EncounterDifficultyBand | null;
}

/** "Add the Threat of every Enemy and divide that total by the number of Heroes": Easy .5, Medium
 *  .75, Hard 1, Deadly 1.25, Very Deadly 1.5 or more. Each value is read as the band's lower bound,
 *  and anything under Medium is Easy, the table's lowest band. The ruleset's own worked examples
 *  hold: a Threat 4 Legendary against four Heroes is Hard, two Minions more make it Deadly, and one
 *  Minion per Hero makes it Very Deadly. It is "only the starting estimate", so the app only shows
 *  it. */
export function encounterDifficulty(threats: readonly number[], heroCount: number): EncounterDifficulty {
  const total = threats.reduce((sum, t) => sum + t, 0);
  if (heroCount <= 0) return { TotalThreat: total, ThreatPerHero: null, Band: null };
  const perHero = total / heroCount;
  const band: EncounterDifficultyBand =
    perHero >= 1.5 ? 'Very Deadly' : perHero >= 1.25 ? 'Deadly' : perHero >= 1 ? 'Hard' : perHero >= 0.75 ? 'Medium' : 'Easy';
  return { TotalThreat: total, ThreatPerHero: perHero, Band: band };
}

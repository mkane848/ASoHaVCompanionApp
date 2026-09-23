import type { CombatParticipant, CombatRange, EnemyProfile, EnemyStatBlock, EnemyVirtue } from './types.js';
import { emptyMarks, markStrain, strainExhausted } from './engine.js';
import { newId } from './ids.js';

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

// ---------- In the fight (revised V0.6, slice 7 — WP 7A implements the bodies) ----------

/** How many Strain boxes an enemy's track has: its stat block's `StrainBoxes` — per phase, for a
 *  Legendary ("Each phase uses a five-box Strain Track unless its stat block says otherwise"). */
export function enemyStrainBoxes(stats: EnemyStatBlock): number {
  return Math.max(1, stats.StrainBoxes);
}

/** A new enemy participant carrying a copy of `Stats`: an empty Strain row, no Status notes or
 *  Conditions, not Crumbled or Defeated, `Range` defaulting to 'Close', AP 3, `GambitCharges` from
 *  the block. A Legendary starts in its Opening phase; a Minion group starts at `MinionCount`
 *  (default 1). */
export function newEnemyParticipant(input: {
  RefId: string;
  Name: string;
  Stats: EnemyStatBlock;
  MinionCount?: number;
  Range?: CombatRange;
}): CombatParticipant {
  const p: CombatParticipant = {
    Id: newId('cp'),
    Kind: 'Enemy',
    RefId: input.RefId,
    Name: input.Name,
    Range: input.Range ?? 'Close',
    ActionPointsRemaining: 3, // DEFAULT_ACTION_POINTS
    HasActedThisRound: false,
    Stats: { ...input.Stats },
    Strain: emptyMarks(enemyStrainBoxes(input.Stats)),
    StatusNotes: [],
    ConditionsMarked: [],
    Crumbled: false,
    Defeated: false,
    GambitCharges: input.Stats.GambitCharges,
  };
  if (input.Stats.Profile === 'Legendary') {
    p.Phase = 'Opening';
    p.PhaseLostSinceActivation = false;
  }
  if (input.Stats.Profile === 'Minion') {
    p.MinionCount = input.MinionCount ?? 1;
  }
  return p;
}

/** Slice 7's clean break, read side (`normalizeEncounter`): an enemy that joined a fight before the
 *  revised stat block existed carries `Toughness`/`StatusLimits`/`Statuses`/`IsBoss` and no
 *  `Stats`. The repo owner chose not to convert the old stats, so it gets the profile defaults — a
 *  Legendary if it was a Boss, otherwise Standard, keeping its Gambit charges — an empty Strain row,
 *  and loses the old fields and the Strain marked on them. Also backfills the slice 7 fields on an
 *  enemy that already has a stat block. A Hero's row is returned unchanged. */
export function normalizeEnemyParticipant(p: CombatParticipant): CombatParticipant {
  if (p.Kind !== 'Enemy') return p;
  const copy = { ...p } as CombatParticipant & Record<string, unknown>;
  const wasBoss = copy.IsBoss === true;
  for (const k of ['Toughness', 'StatusLimits', 'Statuses', 'IsBoss']) delete copy[k];
  const stats = copy.Stats ?? { ...defaultStatBlock(wasBoss ? 'Legendary' : 'Standard'), GambitCharges: copy.GambitCharges ?? 0 };
  const out: CombatParticipant = {
    ...copy,
    Stats: stats,
    Strain: copy.Strain ?? emptyMarks(enemyStrainBoxes(stats)),
    StatusNotes: copy.StatusNotes ?? [],
    ConditionsMarked: copy.ConditionsMarked ?? [],
    Crumbled: copy.Crumbled ?? false,
  };
  if (stats.Profile === 'Legendary') {
    out.Phase = copy.Phase ?? 'Opening';
    out.PhaseLostSinceActivation = copy.PhaseLostSinceActivation ?? false;
  }
  if (stats.Profile === 'Minion') out.MinionCount = copy.MinionCount ?? 1;
  return out;
}

/** Step 2 of "Inflicting Strain on an Enemy": "Subtract the Enemy's Guard, to a minimum of 1
 *  Strain" — and Pierce ignores Guard. A hit that deals no Strain stays at 0. */
export function guardedStrain(amount: number, guard: number, pierce: boolean): number {
  if (amount <= 0) return 0;
  if (pierce) return amount;
  return Math.max(1, amount - guard);
}

export function hasFreeStatusSlot(p: CombatParticipant): boolean {
  if (!p.Stats) return false;
  const used = (p.StatusNotes ?? []).length;
  return used < p.Stats.StatusSlots;
}

/** Step 3: "the GM may fill one available Enemy Status slot to negate the entire attack's
 *  Strain", describing the lasting wound (`note`). Unchanged if no slot is free. */
export function negateWithStatus(p: CombatParticipant, note: string): CombatParticipant {
  if (!hasFreeStatusSlot(p)) return p;
  return { ...p, StatusNotes: [...(p.StatusNotes ?? []), note] };
}

export type EnemyHitOutcome = 'None' | 'Marked' | 'MinionSubdued' | 'Subdued' | 'PhaseEnded' | 'Discarded';

export interface EnemyHitResult {
  Participant: CombatParticipant;
  Outcome: EnemyHitOutcome;
}

/** Steps 4–5, and the profile rules that change them. `amount` is already past Guard. Pure.
 *  - 0 or less, or an enemy already Defeated: `None`, unchanged.
 *  - A Minion group: any hit Subdues one Minion (`MinionCount` − 1, no box marked) —
 *    `MinionSubdued`, or `Subdued` (Defeated) when the last one goes.
 *  - Otherwise mark the box equal to the Strain, or the next open box to its right (`markStrain`):
 *    `Marked`.
 *  - No legal box, not Legendary: `Subdued` (Defeated).
 *  - No legal box, Legendary — the remaining Strain is discarded in every case:
 *    - already lost a phase since its last activation: `Discarded`, unchanged;
 *    - Opening → Bloodied: clear every Strain box and every Condition (and Crumbled);
 *      `PhaseLostSinceActivation`; `PhaseEnded`;
 *    - Bloodied → Last Stand: clear every Condition (and Crumbled), then clear the
 *      `Stats.LastStandBoxes` highest-numbered marked boxes; `PhaseLostSinceActivation`;
 *      `PhaseEnded`;
 *    - Last Stand: `Subdued` (Defeated).
 *  Status notes never change here ("Statuses do not clear"). */
export function inflictEnemyStrain(p: CombatParticipant, amount: number): EnemyHitResult {
  // Step 0: 0 or less, or already Defeated
  if (amount <= 0 || p.Defeated) {
    return { Participant: p, Outcome: 'None' };
  }

  // Minion group: any hit Subdues one Minion
  if (p.Stats?.Profile === 'Minion') {
    const count = p.MinionCount ?? 1;
    if (count <= 1) {
      // Last minion goes down
      return { Participant: { ...p, Defeated: true, MinionCount: 0 }, Outcome: 'Subdued' };
    } else {
      // Subdue one minion
      return { Participant: { ...p, MinionCount: count - 1 }, Outcome: 'MinionSubdued' };
    }
  }

  // Try to mark the box
  const boxes = enemyStrainBoxes(p.Stats!);
  const currentStrain = p.Strain ?? emptyMarks(boxes);

  // Check if we can mark this Strain amount
  if (!strainExhausted(currentStrain, amount, boxes)) {
    // Mark the box
    const newStrain = markStrain(currentStrain, amount, boxes);
    return { Participant: { ...p, Strain: newStrain }, Outcome: 'Marked' };
  }

  // No legal box. Check profile type
  if (p.Stats?.Profile !== 'Legendary') {
    // Non-Legendary: Subdued
    return { Participant: { ...p, Defeated: true }, Outcome: 'Subdued' };
  }

  // Legendary: check phase loss history
  if (p.PhaseLostSinceActivation) {
    // Already lost a phase since last activation: discard remaining Strain
    return { Participant: p, Outcome: 'Discarded' };
  }

  // Handle phase transitions
  const phase = p.Phase ?? 'Opening';
  if (phase === 'Opening') {
    // Opening → Bloodied: clear all boxes and conditions
    return {
      Participant: {
        ...p,
        Phase: 'Bloodied',
        Strain: emptyMarks(boxes),
        ConditionsMarked: [],
        Crumbled: false,
        PhaseLostSinceActivation: true,
      },
      Outcome: 'PhaseEnded',
    };
  } else if (phase === 'Bloodied') {
    // Bloodied → Last Stand: clear conditions, clear N highest-numbered marked boxes
    const lastStandBoxes = p.Stats.LastStandBoxes;
    const newStrainLS = [...(p.Strain ?? emptyMarks(boxes))];
    let cleared = 0;
    // Iterate from highest index backwards, clearing only marked boxes
    for (let i = newStrainLS.length - 1; i >= 0 && cleared < lastStandBoxes; i -= 1) {
      if (newStrainLS[i]) {
        newStrainLS[i] = false;
        cleared += 1;
      }
    }
    return {
      Participant: {
        ...p,
        Phase: 'LastStand',
        Strain: newStrainLS,
        ConditionsMarked: [],
        Crumbled: false,
        PhaseLostSinceActivation: true,
      },
      Outcome: 'PhaseEnded',
    };
  } else {
    // Last Stand: Subdued (Defeated)
    return { Participant: { ...p, Defeated: true }, Outcome: 'Subdued' };
  }
}

/** "Before Strain is marked" for Repel: an enemy's Strain Rank is its highest marked box (0 with
 *  none). */
export function enemyStrainRank(p: CombatParticipant): number {
  if (!p.Strain) return 0;
  for (let i = p.Strain.length - 1; i >= 0; i -= 1) {
    if (p.Strain[i]) return i + 1;
  }
  return 0;
}

/** Marks the Condition on `virtueId`. Unshakable: no change, not Crumbled ("It cannot mark
 *  Conditions"). A Defeated enemy, or one already marked there: no change. A Minion Crumbles on any
 *  mark. Otherwise it Crumbles once it has marked `Stats.ConditionSlots` Conditions ("its final
 *  available Condition"). */
export function markEnemyCondition(p: CombatParticipant, virtueId: string): { Participant: CombatParticipant; Crumbled: boolean } {
  // Unshakable or Defeated: no change
  if (p.Stats?.Unshakable || p.Defeated) {
    return { Participant: p, Crumbled: false };
  }

  const marked = p.ConditionsMarked ?? [];
  // Already marked: no change
  if (marked.includes(virtueId)) {
    return { Participant: p, Crumbled: false };
  }

  // Mark the condition
  const newMarked = [...marked, virtueId];
  let crumbled = false;

  // Check for Crumble
  if (p.Stats?.Profile === 'Minion') {
    // Minion Crumbles on any mark
    crumbled = true;
  } else {
    // Otherwise Crumbles on final available Condition
    if (newMarked.length >= p.Stats!.ConditionSlots) {
      crumbled = true;
    }
  }

  return {
    Participant: { ...p, ConditionsMarked: newMarked, Crumbled: crumbled },
    Crumbled: crumbled,
  };
}

/** "An Enemy may spend one action to Clear a Condition immediately." Clearing one also lifts a
 *  Crumble, since it no longer has marked its final Condition. */
export function clearEnemyCondition(p: CombatParticipant, virtueId: string): CombatParticipant {
  const marked = p.ConditionsMarked ?? [];
  if (!marked.includes(virtueId)) return p;
  // Lift Crumble since it no longer has marked its final Condition
  return { ...p, ConditionsMarked: marked.filter((v) => v !== virtueId), Crumbled: false };
}

/** Its Virtues after Conditions: "If an Enemy marks a Condition associated with a Virtue, a Strong
 *  Virtue becomes Neutral and a Neutral Virtue becomes Weak. A Weak Virtue does not become weaker."
 *  Any Strong rating (+ or ++) becomes 0; a Neutral one — listed at 0, or not listed at all —
 *  becomes −1; a Weak one stays. Unmarked Virtues are unchanged. Listed order first, then any
 *  unlisted Virtue the Condition made Weak. */
export function effectiveEnemyVirtues(stats: EnemyStatBlock, conditionsMarked: readonly string[]): EnemyVirtue[] {
  const conditionSet = new Set(conditionsMarked);
  const result: EnemyVirtue[] = [];
  const unlistedWeak: EnemyVirtue[] = [];

  // Process listed virtues in order
  for (const virtue of stats.Virtues) {
    const isMarked = conditionSet.has(virtue.VirtueId);
    if (isMarked) {
      const rating = virtue.Rating;
      if (rating > 0) {
        // Strong → Neutral
        result.push({ VirtueId: virtue.VirtueId, Rating: 0 });
      } else if (rating === 0) {
        // Neutral → Weak
        result.push({ VirtueId: virtue.VirtueId, Rating: -1 });
      } else {
        // Weak stays weak
        result.push(virtue);
      }
    } else {
      // Unmarked: unchanged
      result.push(virtue);
    }
  }

  // Add unlisted virtues that are marked (become Weak)
  for (const virtueId of conditionsMarked) {
    if (!stats.Virtues.some((v) => v.VirtueId === virtueId)) {
      unlistedWeak.push({ VirtueId: virtueId, Rating: -1 });
    }
  }

  return [...result, ...unlistedWeak];
}

export interface EnemyVirtueHint {
  VirtueId: string;
  Rating: number;
  /** "When a Hero directly opposes one of the Enemy's Strong Virtues, each + creates one Bane." */
  Banes: number;
  /** "When a Hero exploits a Weak Virtue, each − creates one Boon." */
  Boons: number;
}

/** The Boon/Bane hints its effective Virtues give an attacker — one entry per non-Neutral Virtue. */
export function enemyVirtueRollHints(p: CombatParticipant): EnemyVirtueHint[] {
  if (!p.Stats) return [];

  const effective = effectiveEnemyVirtues(p.Stats, p.ConditionsMarked ?? []);

  return effective
    .filter((v) => v.Rating !== 0)
    .map((v) => ({
      VirtueId: v.VirtueId,
      Rating: v.Rating,
      Banes: Math.max(0, v.Rating),
      Boons: Math.max(0, -v.Rating),
    }));
}

/** "When several Minions attack the same Hero, combine their Strain and resolve it as one attack
 *  … Grouped Minion attack cannot exceed 5 Strain." */
export function groupMinionAttack(strainPerMinion: number, minions: number): number {
  return Math.min(5, Math.max(0, strainPerMinion * minions));
}

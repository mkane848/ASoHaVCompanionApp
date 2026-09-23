/**
 * Combat: pure logic over Encounter/CombatParticipant shapes. Track-and-display, not
 * enforcement — see CLAUDE.md's Combat architecture note: nothing here blocks an illegal
 * action, it just computes the numbers once the table tells it what happened. Reuses the
 * Strain engine (`engine.ts`) for the box-row primitives Combat also needs; this module is only
 * what Combat adds on top — Range and Action Points. The revised V0.6 enemy rules (Guard, the
 * Strain row, Status slots, Legendary phases) live in `enemies.ts`.
 */
import { newId } from './logic.js';
import type { CombatParticipant, CombatRange, StatusSeverity } from './types.js';
import { COMBAT_RANGE_ORDER } from './types.js';
import type { AdvantageState, RollTier } from './engine.js';

/** "Every Hero begins Combat with 3 Action Points." */
export const DEFAULT_ACTION_POINTS = 3;
/** Prepare's "Your maximum AP becomes 4 during your next turn." */
export const PREPARED_ACTION_POINTS = 4;

/** A unit's maximum AP this turn — 3, or 4 on the turn after Prepare. */
export function maxActionPoints(p: CombatParticipant): number {
  return p.ActionPointsMax ?? DEFAULT_ACTION_POINTS;
}

/** Moves a Range by `deltaBands` steps toward Melee (negative) or Out of Range (positive),
 *  clamped at both ends.
 *
 *  V0.5's own space counts (Ruleset-V0.5.md "Combat Basics"): Melee = Range 1, Engage at Range =
 *  Range 10, Maneuver up to 6 spaces, Shift up to 2, a default enemy moves 6 squares. The repo
 *  owner re-affirmed keeping the 5-band ladder over building real grid geometry (`README.md` item
 *  15) — mapping those numbers onto it: treating Engage at Range's 10 spaces as roughly the far
 *  edge of the ladder's 4 Melee-to-OutOfRange steps gives ~2.5 spaces per band, so Maneuver's 6
 *  spaces rounds to 2 bands and Shift's 2 spaces rounds to 1 (a floor, not a literal 0.8 — a
 *  deliberate move should always cross at least one band). This is *why* the numbers below are
 *  what they are, not an independently-invented simplification:
 *  - The UI's single generic "Reposition" control moves 1 band per use (Shift's rounded value) —
 *    collapsed from a separate Maneuver/Shift pair because there's no way to tell from state alone
 *    which one a reposition represents (see `README.md` item 17's Opportunity-Attack note for the
 *    same collapse reasoning) — spending multiple AP on repeated Reposition taps reaches
 *    Maneuver's 2-band range.
 *  - `Press` (a Gambit) shifts 2 bands, matching Maneuver's rounded value, since the doc gives
 *    Press its own explicit "shift up to 2 spaces" free action figure.
 *  - `repelPushBandsForStatuses()` below and `enemyStrainRank()` (`enemies.ts`) reuse this same
 *    ~1-space-per-band scale for Repel's push. */
export function shiftRange(current: CombatRange, deltaBands: number): CombatRange {
  const i = COMBAT_RANGE_ORDER.indexOf(current);
  const next = Math.max(0, Math.min(COMBAT_RANGE_ORDER.length - 1, i + deltaBands));
  return COMBAT_RANGE_ORDER[next];
}

/** How many bands apart two Ranges are — used for Interpose's "within 2 Range bands" reach
 *  check, since Range isn't pairwise-tracked (see the file header). */
export function rangeBandDistance(a: CombatRange, b: CombatRange): number {
  return Math.abs(COMBAT_RANGE_ORDER.indexOf(a) - COMBAT_RANGE_ORDER.indexOf(b));
}

export type EngageKind = 'Melee' | 'Ranged';

/** The revised Engage Combat Moves: "Engage in Melee … 10+: Inflict 6 Strain. 7-9: Inflict 4
 *  Strain. 6-: Inflict 2 Strain." and "Engage at Range … 10+: Inflict 5 Strain. 7-9: Inflict 3
 *  Strain. 6-: Inflict 1 Strain." (Both 6- lines add "The GM gains 1 Misfortune" — the caller's
 *  job.) Replaced the pre-revision 5/4/3 and 4/3/2. */
export function engageStrain(kind: EngageKind, tier: RollTier): number {
  const melee: Record<RollTier, number> = { Tier3: 6, Tier2: 4, Tier1: 2 };
  const ranged: Record<RollTier, number> = { Tier3: 5, Tier2: 3, Tier1: 1 };
  return (kind === 'Melee' ? melee : ranged)[tier];
}

/** A Hero's row in an Encounter. An enemy's is `newEnemyParticipant()` (`enemies.ts`), built from
 *  its stat block — the pre-revision enemy branch here (Toughness, Status Limits, IsBoss) was
 *  retired in slice 7's clean break. */
export function newParticipant(input: { Kind: 'PC'; RefId: string; Name: string; Range?: CombatRange }): CombatParticipant {
  return {
    Id: newId('cp'),
    Kind: input.Kind,
    RefId: input.RefId,
    Name: input.Name,
    Range: input.Range ?? 'Close',
    ActionPointsRemaining: DEFAULT_ACTION_POINTS,
    HasActedThisRound: false,
  };
}

/** New round: clears everyone's "acted" flag so `nextActor()` can alternate through the roster
 *  again. Surprise lasts only during the first round. AP is deliberately *not* reset here
 *  (slice 5) — recharging is per-unit, at the end of that unit's own turn (`endTurn()`), not a
 *  round-wide event, so a unit that didn't act last round simply keeps whatever AP `endTurn()`
 *  last left it with. The side that began Combat acts first every round (`Encounter.FirstSide`);
 *  the caller hands `ActingSide` back to it. */
export function startNewRound(participants: CombatParticipant[]): CombatParticipant[] {
  return participants.map((p) => ({ ...p, HasActedThisRound: false, Surprised: false }));
}

/** Ends the current actor's turn — and their partner's, if "two Heroes moved together" this turn
 *  (`pairedId`) — recharging just their own AP and marking them acted. Refills to the prepared
 *  maximum when Prepare is set, clears Repeated Attacks count and Halt. This is V0.5's "AP
 *  recharge at the end of that Hero's own turn," replacing the old all-at-once round reset
 *  `startNewRound` used to also do. */
export function endTurn(participants: CombatParticipant[], actingId: string, pairedId: string | null): CombatParticipant[] {
  const ids = new Set([actingId, ...(pairedId ? [pairedId] : [])]);
  return participants.map((p) => {
    if (!ids.has(p.Id)) return p;
    const refill = p.PrepareNextTurn ? PREPARED_ACTION_POINTS : DEFAULT_ACTION_POINTS;
    return {
      ...p,
      ActionPointsRemaining: refill,
      ActionPointsMax: refill,
      PrepareNextTurn: false,
      StrainMovesSinceRefresh: 0,
      Halted: false,
      HasActedThisRound: true,
    };
  });
}

/** The beginning of a unit's turn (the GM picking it, or its Team-Up partner, as the actor):
 *  clears `Fortified` — "until the beginning of your next turn", and also
 *  `PhaseLostSinceActivation` — a Legendary enemy "can lose no more than one phase between its
 *  activations", and this is its activation. Only the named units change. */
export function beginTurn(participants: CombatParticipant[], ids: readonly string[]): CombatParticipant[] {
  const idSet = new Set(ids);
  return participants.map((p) => (idSet.has(p.Id) ? { ...p, Fortified: false, PhaseLostSinceActivation: false } : p));
}

/** Repeated Attacks (Ruleset-V0.6.md, "Repeated Attacks"): worsen the roll one step for each
 *  earlier Strain-inflicting, AP-spending Move since the unit's AP last refreshed. `base` is the
 *  roll's shape from Boons and Banes; `priorCount` is how many such Moves came before this one
 *  (0 for the first). The table: Advantage → Advantage, Normal, Disadvantage; Normal → Normal,
 *  Disadvantage, Double Disadvantage; Disadvantage → Disadvantage, Double Disadvantage, Double
 *  Disadvantage — the third column covering "third or later". Double Disadvantage stays. */
export function repeatedAttackShape(base: AdvantageState, priorCount: number): AdvantageState {
  const ladder: AdvantageState[] = ['Advantage', 'Normal', 'Disadvantage', 'DoubleDisadvantage'];
  const baseIndex = ladder.indexOf(base);
  const count = Math.max(0, priorCount);
  const nextIndex = Math.min(baseIndex + Math.min(count, 2), ladder.length - 1);
  return ladder[nextIndex];
}

/** Brace (Reaction): "Reduce the distance of forced movement by up to your Mettle, minimum 1." The
 *  reduction is Mettle but never less than 1, and the push never goes below 0. Replaced the old
 *  "Resist" reaction, which had no floor. */
export function braceForcedMovement(pushBands: number, mettleScore: number): number {
  return Math.max(0, pushBands - Math.max(1, mettleScore));
}

/** Suggests which side logically acts next under V0.5's alternating-with-leftovers rule: the
 *  other side if it still has an eligible (not yet acted, not defeated) unit, the same side again
 *  if only it does (the "leftover units act consecutively" case), or `null` once neither side has
 *  anyone left — the round is over. A suggestion only, not an enforced order: which *specific*
 *  unit on that side goes is left to whoever's playing it, same as the doc's own wording ("Heroes
 *  should choose the order each round that best fits their current strategy") — the GM can always
 *  set `ActingParticipantId` to a different participant than this function would pick. */
export function nextActor(participants: CombatParticipant[], actingSide: 'Party' | 'Enemies' | null): 'Party' | 'Enemies' | null {
  if (actingSide === null) return null;
  const sideHasEligible = (side: 'Party' | 'Enemies') =>
    // A Surprised unit "cannot take a turn … during the first round" (revised V0.6, slice 6), and
    // `startNewRound` clears the flag, so it only ever skips someone in round 1.
    participants.some((p) => (p.Kind === 'PC') === (side === 'Party') && !p.HasActedThisRound && !p.Defeated && !p.Surprised);
  const otherSide = actingSide === 'Party' ? 'Enemies' : 'Party';
  if (sideHasEligible(otherSide)) return otherSide;
  if (sideHasEligible(actingSide)) return actingSide;
  return null;
}

/** Combat Loop step 2, "Adjust Rapport" (revised V0.6, slice 4): "If the Heroes initiated Combat
 *  and all share the Combat Goal, mark 1 Rapport. If the Heroes did not initiate Combat, or if they
 *  begin ill-prepared or off-balance, remove 1 Rapport instead." So +1 only when they initiated,
 *  share the Goal and are not ill-prepared; −1 when they did not initiate or are ill-prepared
 *  (the "instead" wins over the +1); otherwise 0 — Heroes who started it without all sharing the
 *  Goal. Replaces V0.5's +2 for initiated-and-shared. */
export function combatStartRapportDelta(input: { initiatedByHeroes: boolean; sharedGoal: boolean; illPreparedOrOffBalance: boolean }): number {
  if (!input.initiatedByHeroes || input.illPreparedOrOffBalance) {
    return -1;
  }
  if (input.sharedGoal) {
    return 1;
  }
  return 0;
}

// ---------- Gambits ----------

export type GambitKey = 'Bolster' | 'Pierce' | 'Press' | 'Repel' | 'Halt' | 'Seize' | 'Impede' | 'Calculate' | 'Fortify' | 'Other';

export interface GambitDef {
  Key: GambitKey;
  Name: string;
  Description: string;
}

/** The revised list (Ruleset-V0.6.md, "Gambits"), in the ruleset's order: Pierce is new and
 *  Fortify replaces the Brace Gambit (Brace is now a Reaction — see `braceForcedMovement`). Only a
 *  Hero can take a Gambit (the cost is marking a Condition, which only Heroes have). What each one
 *  does to the Encounter is `EncounterView.tsx`'s `applyGambits`, except Bolster and Pierce, which
 *  change the Engage's own amount in `CombatMoveModal.tsx`. */
export const GAMBITS: GambitDef[] = [
  { Key: 'Bolster', Name: 'Bolster', Description: 'Inflict 1 additional Strain.' },
  { Key: 'Pierce', Name: 'Pierce', Description: 'Ignore the Enemy’s Guard for this Move.' },
  { Key: 'Press', Name: 'Press', Description: 'Shift up to 2 spaces, even if an effect currently prevents you from moving.' },
  { Key: 'Repel', Name: 'Repel', Description: 'Force the Enemy away from you a number of spaces equal to its Strain Rank.' },
  { Key: 'Halt', Name: 'Halt', Description: 'The Enemy cannot move voluntarily during its next turn. Forced movement can still move it.' },
  { Key: 'Seize', Name: 'Seize', Description: 'Take something from an enemy.' },
  { Key: 'Impede', Name: 'Impede', Description: 'Give the Enemy an appropriate Bane, such as Grappled, Distracted, or Provoked. The Bane lasts while its fictional cause remains.' },
  { Key: 'Calculate', Name: 'Calculate', Description: 'Take +1 Forward, or give +1 Forward to an ally who can use the opening you reveal.' },
  { Key: 'Fortify', Name: 'Fortify', Description: 'Reduce each instance of Strain inflicted on you by 1 until the beginning of your next turn.' },
  { Key: 'Other', Name: 'Other', Description: 'With the GM’s agreement, create an effect with a similar level of impact.' },
];

/** One Gambit taken on a roll, with the Virtue whose Condition pays for it (null if it's the
 *  free 12+ pick), for Impede specifically the name of the Bane it gives the target, and for Repel
 *  specifically the target's own Mettle score if it Braces (see `braceForcedMovement`) — entered
 *  by whoever resolves the roll, same trust model as everything else this app self-reports rather
 *  than enforces. */
export interface ChosenGambit {
  Key: GambitKey;
  ConditionVirtueId: string | null;
  ExtraStatusName?: string;
  ResistMettle?: number;
}

/** Gambit Condition cost: on a 10+, each Gambit costs 1 Condition, except the first one if the
 *  roll was exactly 12+ (free); on a 7-9, exactly one Gambit is allowed, costing 2 Conditions; a
 *  miss allows none. `indexAmongChosen` is this Gambit's position (0-based) among the ones
 *  picked this roll, so only one can ever be the free 12+ one. */
export function gambitConditionCost(tier: RollTier, indexAmongChosen: number, rolledTwelvePlus: boolean): number {
  if (tier === 'Tier1') return 0;
  if (tier === 'Tier2') return 2;
  return indexAmongChosen === 0 && rolledTwelvePlus ? 0 : 1;
}

// ---------- Reactions & forced movement (slice 5) ----------

const REPEL_SEVERITY_BANDS: Record<StatusSeverity, number> = { Minor: 1, Major: 2, Severe: 3 };

/** Repel against a PC target (V0.6 slice 1 / `WorkPlan-V0.6.md` Section B1's own mapping): push
 *  bands equal to the *severity* of the target's highest Status — Minor 1 / Major 2 / Severe 3 —
 *  rather than a ranked Status's own Rank number, since a Hero's Statuses no longer have one.
 *  Returns 0 if the target holds no Status at all. */
export function repelPushBandsForStatuses(statuses: { Severity: StatusSeverity }[] | undefined): number {
  if (!statuses || statuses.length === 0) return 0;
  return Math.max(...statuses.map((s) => REPEL_SEVERITY_BANDS[s.Severity]));
}


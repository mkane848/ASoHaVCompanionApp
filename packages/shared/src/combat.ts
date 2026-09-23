/**
 * Combat: pure logic over Encounter/CombatParticipant shapes. Track-and-display, not
 * enforcement — see CLAUDE.md's Combat architecture note: nothing here blocks an illegal
 * action, it just computes the numbers once the table tells it what happened. Reuses the
 * Strain engine (`engine.ts`) for the box-row primitives Combat also needs; this module is only
 * what Combat adds on top — Range, Action Points, Toughness, and per-track Enemy Strain Limits.
 */
import { newId } from './logic.js';
import type { CombatParticipant, CombatParticipantKind, CombatRange, EnemyStatusLimit, EnemyStrainMark, StatusSeverity, ToughnessTier } from './types.js';
import { COMBAT_RANGE_ORDER } from './types.js';
import type { AdvantageState, RollTier } from './engine.js';
import { emptyMarks, markRank, statusRank } from './engine.js';

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
 *  - `repelPushBandsForEnemy()`/`repelPushBandsForStatuses()` below reuse this same
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
 *  job.) Replaces `engageBaseRank`'s 5/4/3 and 4/3/2. */
export function engageStrain(kind: EngageKind, tier: RollTier): number {
  throw new Error('not implemented: WP-6A');
}

/** @deprecated Pre-revision values; use `engageStrain`. Deleted at slice 6's integration once its
 *  callers move.
 *  The Strain (was: Status Rank, pre-V0.6) an Engage Combat Move deals before Toughness, fixed
 *  per tier (V2.2's own numbers — these Combat Moves specify their own amount rather than falling
 *  back to the "Rank = your roll modifier" default rule from Important Mechanics). */
export function engageBaseRank(kind: EngageKind, tier: RollTier): number {
  const melee: Record<RollTier, number> = { Tier3: 5, Tier2: 4, Tier1: 3 };
  const ranged: Record<RollTier, number> = { Tier3: 4, Tier2: 3, Tier1: 2 };
  return (kind === 'Melee' ? melee : ranged)[tier];
}

const TIER_DOWN: Record<RollTier, RollTier> = { Tier3: 'Tier2', Tier2: 'Tier1', Tier1: 'Tier1' };

/** Toughness blunts incoming Strain: Medium is a flat -2 (floored at 1 — a hit that lands at all
 *  still does *something*); Heavy re-derives the amount as though the roll had been one tier
 *  lower, per the doc ("treat the inflicted Status Rank as if rolled one tier lower" — the roll's
 *  own tier is otherwise unaffected, e.g. for Gambit eligibility). */
export function applyToughness(baseRank: number, tier: RollTier, kind: EngageKind, toughness: ToughnessTier): number {
  if (baseRank <= 0) return baseRank;
  if (toughness === 'Heavy') return engageBaseRank(kind, TIER_DOWN[tier]);
  if (toughness === 'Medium') return Math.max(1, baseRank - 2);
  return baseRank;
}

/** Marks `amount` onto a named Enemy Strain track, creating the track if it doesn't already
 *  exist — the Enemy-side equivalent of a Hero's `markStrain` (`engine.ts`), keyed by name since
 *  an Enemy can hold several independent tracks (see `EnemyStatusLimit`). Same sparse box-row
 *  rule throughout this app: marking 2 then 2 again lands boxes 2 and 3 (value 3), not 4. */
export function markEnemyStrain(tracks: EnemyStrainMark[], name: string, amount: number, boxes = 5): EnemyStrainMark[] {
  if (amount <= 0) return tracks;
  const existing = tracks.find((t) => t.Name.toLowerCase() === name.toLowerCase());
  const nextMarks = markRank(existing?.Marks ?? emptyMarks(boxes), Math.min(amount, boxes), boxes);
  return existing
    ? tracks.map((t) => (t.Id === existing.Id ? { ...t, Marks: nextMarks } : t))
    : [...tracks, { Id: newId('esm'), Name: name, Marks: nextMarks }];
}

/** An Enemy is defeated once any one of its per-track Strain Limits is reached — not a single
 *  shared pool. Case-insensitive match on track name, same as the Strain engine's own stacking. */
export function isEnemyDefeated(statuses: { Name: string; Marks: boolean[] }[] | undefined, limits: EnemyStatusLimit[] | undefined): boolean {
  if (!statuses || !limits || limits.length === 0) return false;
  return limits.some((l) => {
    const s = statuses.find((x) => x.Name.toLowerCase() === l.StatusName.toLowerCase());
    return !!s && statusRank(s) >= l.Limit;
  });
}

/** V0.5/V0.6 (unchanged by the Strain migration — see `WorkPlan-V0.6.md` Section B1): "Enemies
 *  become Unstable when one of their Strain tracks reaches half of its maximum" — half of that
 *  track's own Limit, rounded up, not half the box row. Like a Hero's Unstable (`isUnstable` in
 *  `engine.ts`) this is derived, has no mechanical effect on its own, and exists for other
 *  abilities and moves to key off. */
export function isEnemyUnstable(statuses: { Name: string; Marks: boolean[] }[] | undefined, limits: EnemyStatusLimit[] | undefined): boolean {
  if (!statuses || !limits || limits.length === 0) return false;
  return limits.some((l) => {
    const s = statuses.find((x) => x.Name.toLowerCase() === l.StatusName.toLowerCase());
    return !!s && statusRank(s) >= Math.ceil(l.Limit / 2);
  });
}

export function newParticipant(input: {
  Kind: CombatParticipantKind;
  RefId: string;
  Name: string;
  Range?: CombatRange;
  Toughness?: ToughnessTier;
  StatusLimits?: EnemyStatusLimit[];
  IsBoss?: boolean;
  GambitCharges?: number;
}): CombatParticipant {
  const base: CombatParticipant = {
    Id: newId('cp'),
    Kind: input.Kind,
    RefId: input.RefId,
    Name: input.Name,
    Range: input.Range ?? 'Close',
    ActionPointsRemaining: DEFAULT_ACTION_POINTS,
    HasActedThisRound: false,
  };
  if (input.Kind === 'Enemy') {
    base.Toughness = input.Toughness ?? 'None';
    base.StatusLimits = input.StatusLimits ?? [];
    base.Statuses = [];
    base.Defeated = false;
    if (input.IsBoss) {
      base.IsBoss = true;
      base.GambitCharges = input.GambitCharges ?? 0;
    }
  }
  return base;
}

/** New round: clears everyone's "acted" flag so `nextActor()` can alternate through the roster
 *  again. AP is deliberately *not* reset here (slice 5) — recharging is per-unit, at the end of
 *  that unit's own turn (`endTurn()`), not a round-wide event, so a unit that didn't act last
 *  round simply keeps whatever AP `endTurn()` last left it with. Who goes first is still up to
 *  the GM (`ActingSide` on the Encounter). */
export function startNewRound(participants: CombatParticipant[]): CombatParticipant[] {
  // WP-6A: also clear Surprised — "during the first round" ends with it.
  return participants.map((p) => ({ ...p, HasActedThisRound: false }));
}

/** Ends the current actor's turn — and their partner's, if "two Heroes moved together" this turn
 *  (`pairedId`) — recharging just their own AP and marking them acted. This is V0.5's "AP
 *  recharge at the end of that Hero's own turn," replacing the old all-at-once round reset
 *  `startNewRound` used to also do. */
export function endTurn(participants: CombatParticipant[], actingId: string, pairedId: string | null): CombatParticipant[] {
  // WP-6A (revised V0.6, slice 6): refill to PREPARED_ACTION_POINTS when PrepareNextTurn is set
  // (then clear it), and set ActionPointsMax to whatever was refilled to; zero
  // StrainMovesSinceRefresh; clear Halted. Only the acting unit(s) change.
  const ids = new Set([actingId, ...(pairedId ? [pairedId] : [])]);
  return participants.map((p) => (ids.has(p.Id) ? { ...p, ActionPointsRemaining: DEFAULT_ACTION_POINTS, HasActedThisRound: true } : p));
}

/** The beginning of a unit's turn (the GM picking it, or its Team-Up partner, as the actor):
 *  clears `Fortified` — "until the beginning of your next turn". Only the named units change. */
export function beginTurn(participants: CombatParticipant[], ids: readonly string[]): CombatParticipant[] {
  throw new Error('not implemented: WP-6A');
}

/** Repeated Attacks (Ruleset-V0.6.md, "Repeated Attacks"): worsen the roll one step for each
 *  earlier Strain-inflicting, AP-spending Move since the unit's AP last refreshed. `base` is the
 *  roll's shape from Boons and Banes; `priorCount` is how many such Moves came before this one
 *  (0 for the first). The table: Advantage → Advantage, Normal, Disadvantage; Normal → Normal,
 *  Disadvantage, Double Disadvantage; Disadvantage → Disadvantage, Double Disadvantage, Double
 *  Disadvantage — the third column covering "third or later". Double Disadvantage stays. */
export function repeatedAttackShape(base: AdvantageState, priorCount: number): AdvantageState {
  throw new Error('not implemented: WP-6A');
}

/** Brace (Reaction): "Reduce the distance of forced movement by up to your Mettle, minimum 1." The
 *  reduction is Mettle but never less than 1, and the push never goes below 0. Replaces
 *  `resistForcedMovementBands`, the old "Resist" reaction, which had no floor. */
export function braceForcedMovement(pushBands: number, mettleScore: number): number {
  throw new Error('not implemented: WP-6A');
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
    participants.some((p) => (p.Kind === 'PC') === (side === 'Party') && !p.HasActedThisRound && !p.Defeated);
  const otherSide = actingSide === 'Party' ? 'Enemies' : 'Party';
  if (sideHasEligible(otherSide)) return otherSide;
  if (sideHasEligible(actingSide)) return actingSide;
  return null;
}

/** @deprecated The revision drops the initiative roll: "whichever side is best positioned in the
 *  fiction acts first", a GM pick. Deleted at slice 6's integration once the header stops using it.
 *  2d6, reported (not rolled) same as everywhere else: 7+ the party acts first, 6- the enemies
 *  do. Only used "if neither side is surprised" (Combat Loop step 5) — see
 *  `firstToActFromSurprise()` for the step-4 case this yields to. */
export function firstToActFromInitiative(total: number): 'Party' | 'Enemies' {
  return total >= 7 ? 'Party' : 'Enemies';
}

/** V0.6 Combat Loop step 4 (slice 3): "If all creatures on one side are surprised, the other side
 *  acts first" — no roll at all, unlike step 5's initiative. `surprisedSide` is the GM's own
 *  determination of which side (if any) was wholly caught off guard; the *other* side goes first.
 *  The doc's further "at the GM's discretion" clause (a full round's head start, fewer actions, or
 *  Disadvantage for the surprised side) is deliberately not modeled here — it's explicitly
 *  open-ended GM narrative discretion ("or impose a similar effect that fits the fiction"), the
 *  same class of clause this app leaves to the table rather than inventing a formula for (Seize/
 *  Other Gambits, Boss abilities). */
export function firstToActFromSurprise(surprisedSide: 'Party' | 'Enemies'): 'Party' | 'Enemies' {
  return surprisedSide === 'Party' ? 'Enemies' : 'Party';
}

/** V0.5 Combat Loop step 1's Rapport modifier — two mutually exclusive branches, not three
 *  independent bonuses: "If the Heroes initiate Combat, add 1 Rapport... If all Heroes share the
 *  same goal for the fight, add another Rapport... If the Heroes did not initiate Combat and are
 *  ill-prepared or off-balance, remove 1 Rapport instead." Heroes who neither initiated nor are
 *  unprepared (a fair, non-ambush fight the enemy started) get no change at all. */
export function combatStartRapportDelta(input: { initiatedByHeroes: boolean; sharedGoal: boolean; illPreparedOrOffBalance: boolean }): number {
  if (input.initiatedByHeroes) return input.sharedGoal ? 2 : 1;
  if (input.illPreparedOrOffBalance) return -1;
  return 0;
}

// ---------- Gambits ----------

/** `Brace` is the pre-revision Gambit Fortify replaces; it stays in the union only until slice 6's
 *  integration removes the last branch that names it. */
export type GambitKey = 'Bolster' | 'Pierce' | 'Press' | 'Repel' | 'Halt' | 'Seize' | 'Impede' | 'Calculate' | 'Fortify' | 'Other' | 'Brace';

export interface GambitDef {
  Key: GambitKey;
  Name: string;
  Description: string;
}

/** Most Gambits reduce to "apply a small Status," which the existing Status engine already
 *  handles — see CombatMoveModal.tsx for how each one is wired up. Only a PC actor can take a
 *  Gambit (the cost is marking a Condition, which only PCs have); an Enemy's Engage roll never
 *  offers them. */
/** Descriptions rewritten per `WorkPlan-V0.6.md` Section B1's mapping table (V0.6 slice 1) — the
 *  mechanics they describe (Bolster/Press/Halt/Impede/Calculate/Brace) are unchanged, only the
 *  unit each deals in (Strain/Banes, not ranked Statuses). Repel's own push math moved to
 *  `repelPushBandsForEnemy`/`repelPushBandsForStatuses` above. */
/** The revised list (Ruleset-V0.6.md, "Gambits"), in the ruleset's order: Pierce is new and
 *  Fortify replaces the Brace Gambit (Brace is now a Reaction — see `braceForcedMovement`). */
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
 *  free 12+ pick), for Halt/Impede specifically the name of the extra Status it gives the
 *  target, and for Repel specifically the target's own Mettle score if they chose to Resist the
 *  push (see `resistForcedMovementBands` below) — entered by whoever resolves the roll, same
 *  trust model as everything else this app self-reports rather than enforces. */
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

/** Repel against an Enemy target: push bands equal to the highest value across its Strain
 *  tracks — reusing `shiftRange()`'s own ~1-space-per-band scale, that's bands = value, 1:1.
 *  Automated as of slice 5, reversing the `0.15.0` decision to leave Repel freeform-logged
 *  (`README.md` item 16). Returns 0 if the target has no Strain marked on any track. No longer
 *  filtered by Polarity (V0.6 slice 1) — an Enemy's own Strain tracks carry no polarity at all,
 *  every one it holds is by construction something inflicted on it. */
export function repelPushBandsForEnemy(tracks: { Marks: boolean[] }[] | undefined): number {
  if (!tracks || tracks.length === 0) return 0;
  return Math.max(...tracks.map((t) => statusRank(t)));
}

const REPEL_SEVERITY_BANDS: Record<StatusSeverity, number> = { Minor: 1, Major: 2, Severe: 3 };

/** Repel against a PC target (V0.6 slice 1 / `WorkPlan-V0.6.md` Section B1's own mapping): push
 *  bands equal to the *severity* of the target's highest Status — Minor 1 / Major 2 / Severe 3 —
 *  rather than a ranked Status's own Rank number, since a Hero's Statuses no longer have one.
 *  Returns 0 if the target holds no Status at all. */
export function repelPushBandsForStatuses(statuses: { Severity: StatusSeverity }[] | undefined): number {
  if (!statuses || statuses.length === 0) return 0;
  return Math.max(...statuses.map((s) => REPEL_SEVERITY_BANDS[s.Severity]));
}

/** @deprecated Replaced by `braceForcedMovement` (Brace, with its minimum of 1); deleted at slice
 *  6's integration once its callers move.
 *  The Resist reaction: "reduce the distance of forced movement by up to your Mettle." Applies to
 *  any forced-movement push (Repel, Interpose's "push into an adjacent space") before it commits.
 *  Floored at 0 both ways — a negative Mettle never *increases* the push, and Resist never turns a
 *  push into a pull. PC-only in practice, since only PCs have Virtue scores to Resist with. */
export function resistForcedMovementBands(pushBands: number, mettleScore: number): number {
  return Math.max(0, pushBands - Math.max(0, mettleScore));
}

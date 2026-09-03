/**
 * Combat: pure logic over Encounter/CombatParticipant shapes. Track-and-display, not
 * enforcement — see CLAUDE.md's Combat architecture note: nothing here blocks an illegal
 * action, it just computes the numbers once the table tells it what happened. Reuses the
 * Status engine (`engine.ts`) for everything Status-shaped; this module is only what Combat
 * adds on top — Range, Action Points, Toughness, and per-Status Enemy Limits.
 */
import { newId } from './logic.js';
import type { CharacterSheet, CombatParticipant, CombatParticipantKind, CombatRange, EnemyStatusLimit, ToughnessTier } from './types.js';
import { COMBAT_RANGE_ORDER } from './types.js';
import type { RollTier } from './engine.js';
import { giveStatus, statusRank } from './engine.js';

const DEFAULT_ACTION_POINTS = 3;

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
 *  - `repelPushBands()` below reuses this same ~1-space-per-band scale for Repel's push. */
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

/** The Status Rank an Engage Combat Move gives before Toughness, fixed per tier (V2.2's own
 *  numbers — these Combat Moves specify their own Ranks rather than falling back to the
 *  "Rank = your roll modifier" default rule from Important Mechanics). */
export function engageBaseRank(kind: EngageKind, tier: RollTier): number {
  const melee: Record<RollTier, number> = { Tier3: 5, Tier2: 4, Tier1: 3 };
  const ranged: Record<RollTier, number> = { Tier3: 4, Tier2: 3, Tier1: 2 };
  return (kind === 'Melee' ? melee : ranged)[tier];
}

const TIER_DOWN: Record<RollTier, RollTier> = { Tier3: 'Tier2', Tier2: 'Tier1', Tier1: 'Tier1' };

/** Toughness blunts an incoming Status Rank: Medium is a flat -2 (floored at 1 — a hit that
 *  lands at all still does *something*); Heavy re-derives the Rank as though the roll had been
 *  one tier lower, per the doc ("treat the inflicted Status Rank as if rolled one tier lower" —
 *  the roll's own tier is otherwise unaffected, e.g. for Gambit eligibility). */
export function applyToughness(baseRank: number, tier: RollTier, kind: EngageKind, toughness: ToughnessTier): number {
  if (baseRank <= 0) return baseRank;
  if (toughness === 'Heavy') return engageBaseRank(kind, TIER_DOWN[tier]);
  if (toughness === 'Medium') return Math.max(1, baseRank - 2);
  return baseRank;
}

/** Crumble's Combat effect. V0.5: "If you are in Combat when you Crumble, you gain Vulnerable 4.
 *  You can only take actions that result in you fleeing or staying put."
 *
 *  Called by whoever handled a Crumble (see `markCondition` in `logic.ts`, which decides *that* a
 *  Crumble happened) when it happened inside a live Encounter. Grants a flat Rank-4 negative
 *  "Vulnerable" Status like any other Status — no bespoke mechanic, same `giveStatus` reuse as
 *  Calculate/Brace.
 *
 *  Simpler than its `0.17.0` predecessor `applyDishonoredVulnerable`, which took a
 *  before-state flag because it had to detect a false-to-true transition on derived state.
 *  Crumble is a discrete event, so there is no transition to guard against and no way to
 *  double-apply by marking another Condition while already at five.
 *
 *  The movement restriction is a table rule, not enforced here — Combat is track-and-display. */
export function applyCrumbleVulnerable(sheet: CharacterSheet, maxRank: number): void {
  sheet.Statuses = giveStatus(sheet.Statuses, { Name: 'Vulnerable', Polarity: 'Negative', Rank: 4 }, maxRank).Statuses;
}

/** An Enemy is defeated once any one of its per-Status Limits is reached — not a single shared
 *  pool. Case-insensitive match on Status name, same as the Status engine's own stacking. */
export function isEnemyDefeated(statuses: { Name: string; Marks: boolean[] }[] | undefined, limits: EnemyStatusLimit[] | undefined): boolean {
  if (!statuses || !limits || limits.length === 0) return false;
  return limits.some((l) => {
    const s = statuses.find((x) => x.Name.toLowerCase() === l.StatusName.toLowerCase());
    return !!s && statusRank(s) >= l.Limit;
  });
}

/** V0.5: "Enemies become Unstable when one of their Negative Statuses reaches half of its
 *  maximum" — half of that Status's own Limit, rounded up, not half the box row. Like a Hero's
 *  Unstable (`isUnstable` in `engine.ts`) this is derived, has no mechanical effect on its own,
 *  and exists for other abilities and moves to key off. */
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
  return participants.map((p) => ({ ...p, HasActedThisRound: false }));
}

/** Ends the current actor's turn — and their partner's, if "two Heroes moved together" this turn
 *  (`pairedId`) — recharging just their own AP and marking them acted. This is V0.5's "AP
 *  recharge at the end of that Hero's own turn," replacing the old all-at-once round reset
 *  `startNewRound` used to also do. */
export function endTurn(participants: CombatParticipant[], actingId: string, pairedId: string | null): CombatParticipant[] {
  const ids = new Set([actingId, ...(pairedId ? [pairedId] : [])]);
  return participants.map((p) => (ids.has(p.Id) ? { ...p, ActionPointsRemaining: DEFAULT_ACTION_POINTS, HasActedThisRound: true } : p));
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

/** 2d6, reported (not rolled) same as everywhere else: 7+ the party acts first, 6- the enemies
 *  do. Surprise overrides this entirely and isn't modeled here — the GM just sets ActingSide
 *  directly when one side is wholly surprised. */
export function firstToActFromInitiative(total: number): 'Party' | 'Enemies' {
  return total >= 7 ? 'Party' : 'Enemies';
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

export type GambitKey = 'Bolster' | 'Press' | 'Repel' | 'Halt' | 'Seize' | 'Impede' | 'Calculate' | 'Brace' | 'Other';

export interface GambitDef {
  Key: GambitKey;
  Name: string;
  Description: string;
}

/** Most Gambits reduce to "apply a small Status," which the existing Status engine already
 *  handles — see CombatMoveModal.tsx for how each one is wired up. Only a PC actor can take a
 *  Gambit (the cost is marking a Condition, which only PCs have); an Enemy's Engage roll never
 *  offers them. */
export const GAMBITS: GambitDef[] = [
  { Key: 'Bolster', Name: 'Bolster', Description: 'The Status you just gave lands one Rank harder.' },
  { Key: 'Press', Name: 'Press', Description: 'Shift 2 Range bands toward your target, free.' },
  { Key: 'Repel', Name: 'Repel', Description: "Push your target back a Range band per their highest Negative Status Rank." },
  { Key: 'Halt', Name: 'Halt', Description: "Give your target Halted 2 — they can't move next turn." },
  { Key: 'Seize', Name: 'Seize', Description: 'Take something from your target — an item, ground, initiative.' },
  { Key: 'Impede', Name: 'Impede', Description: 'Give your target a Rank 2 hindering Status of your choice.' },
  { Key: 'Calculate', Name: 'Calculate', Description: 'Take +1 forward.' },
  { Key: 'Brace', Name: 'Brace', Description: '−1 to all incoming Status Ranks until your next turn.' },
  { Key: 'Other', Name: 'Other', Description: 'Something else of equivalent impact — ask the GM.' },
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

/** Repel's push distance: "push your target back a number of spaces equal to the Rank of its
 *  highest Negative Status" — reusing `shiftRange()`'s own ~1-space-per-band scale, that's bands
 *  = Rank, 1:1. Automated as of slice 5, reversing the `0.15.0` decision to leave Repel
 *  freeform-logged (`README.md` item 16): that decision's own stated reason ("a Rank number isn't
 *  the same unit as a Range band") no longer holds once a real conversion exists. Returns 0 if the
 *  target has no Negative Status. */
export function repelPushBands(targetStatuses: { Marks: boolean[]; Polarity: string }[] | undefined): number {
  if (!targetStatuses) return 0;
  const negative = targetStatuses.filter((s) => s.Polarity === 'Negative');
  if (negative.length === 0) return 0;
  return Math.max(...negative.map((s) => statusRank(s)));
}

/** The Resist reaction: "reduce the distance of forced movement by up to your Mettle." Applies to
 *  any forced-movement push (Repel, Interpose's "push into an adjacent space") before it commits.
 *  Floored at 0 both ways — a negative Mettle never *increases* the push, and Resist never turns a
 *  push into a pull. PC-only in practice, since only PCs have Virtue scores to Resist with. */
export function resistForcedMovementBands(pushBands: number, mettleScore: number): number {
  return Math.max(0, pushBands - Math.max(0, mettleScore));
}

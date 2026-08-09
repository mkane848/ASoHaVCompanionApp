/**
 * Combat: pure logic over Encounter/CombatParticipant shapes. Track-and-display, not
 * enforcement — see CLAUDE.md's Combat architecture note: nothing here blocks an illegal
 * action, it just computes the numbers once the table tells it what happened. Reuses the
 * Status engine (`engine.ts`) for everything Status-shaped; this module is only what Combat
 * adds on top — Range, Action Points, Toughness, and per-Status Enemy Limits.
 */
import { newId } from './logic.js';
import type { CombatParticipant, CombatParticipantKind, CombatRange, EnemyStatusLimit, ToughnessTier } from './types.js';
import { COMBAT_RANGE_ORDER } from './types.js';
import type { RollTier } from './engine.js';

const DEFAULT_ACTION_POINTS = 3;

/** Moves a Range by `deltaBands` steps toward Melee (negative) or Out of Range (positive),
 *  clamped at both ends — Maneuver/Shift's "move N spaces" doesn't translate cleanly from the
 *  doc's squares to range bands, so this is a deliberate simplification: Maneuver moves up to 2
 *  bands, Shift moves 1. Flagged as an interpretation, not a literal doc rule — see HANDOFF.md. */
export function shiftRange(current: CombatRange, deltaBands: number): CombatRange {
  const i = COMBAT_RANGE_ORDER.indexOf(current);
  const next = Math.max(0, Math.min(COMBAT_RANGE_ORDER.length - 1, i + deltaBands));
  return COMBAT_RANGE_ORDER[next];
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

/** An Enemy is defeated once any one of its per-Status Limits is reached — not a single shared
 *  pool. Case-insensitive match on Status name, same as the Status engine's own stacking. */
export function isEnemyDefeated(statuses: { Name: string; Rank: number }[] | undefined, limits: EnemyStatusLimit[] | undefined): boolean {
  if (!statuses || !limits || limits.length === 0) return false;
  return limits.some((l) => {
    const s = statuses.find((x) => x.Name.toLowerCase() === l.StatusName.toLowerCase());
    return !!s && s.Rank >= l.Limit;
  });
}

export function newParticipant(input: {
  Kind: CombatParticipantKind;
  RefId: string;
  Name: string;
  Range?: CombatRange;
  Toughness?: ToughnessTier;
  StatusLimits?: EnemyStatusLimit[];
}): CombatParticipant {
  const base: CombatParticipant = {
    Id: newId('cp'),
    Kind: input.Kind,
    RefId: input.RefId,
    Name: input.Name,
    Range: input.Range ?? 'Close',
    ActionPointsRemaining: DEFAULT_ACTION_POINTS,
    HasActedThisRound: false,
    Unstable: false,
  };
  if (input.Kind === 'Enemy') {
    base.Toughness = input.Toughness ?? 'None';
    base.StatusLimits = input.StatusLimits ?? [];
    base.Statuses = [];
    base.Defeated = false;
  }
  return base;
}

/** New round: every participant's AP refills and their "acted" flag clears. Who goes first is
 *  still up to the GM (ActingSide on the Encounter) — this only resets the per-unit state. */
export function startNewRound(participants: CombatParticipant[]): CombatParticipant[] {
  return participants.map((p) => ({ ...p, ActionPointsRemaining: DEFAULT_ACTION_POINTS, HasActedThisRound: false }));
}

/** 2d6, reported (not rolled) same as everywhere else: 7+ the party acts first, 6- the enemies
 *  do. Surprise overrides this entirely and isn't modeled here — the GM just sets ActingSide
 *  directly when one side is wholly surprised. */
export function firstToActFromInitiative(total: number): 'Party' | 'Enemies' {
  return total >= 7 ? 'Party' : 'Enemies';
}

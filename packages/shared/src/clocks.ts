/**
 * Clocks (V0.5 slice 6, restructured V0.6 slice 6, `0.47.0`): pure logic over the `Clock` shape.
 * Track-and-display, same philosophy as `combat.ts` — nothing here blocks an illegal action, it
 * only computes the numbers once the table says what happened. See `types.ts`'s `Clock`/
 * `ClockKind` doc comments for the four-Kind shape this module implements (`'Opposition'` gets the
 * doc's actual Success/Failure/Headway mechanic; `'Threat'`/`'Project'`/`'TugOfWar'` share a
 * single GM-ticked track).
 */
import { newId, nowIso } from './logic.js';
import type { Clock, ClockKind } from './types.js';
import type { RollTier } from './engine.js';

const DEFAULT_SEGMENTS = 4;

export function newClock(input: { CampaignId: string; Title: string; Kind: ClockKind; Segments?: number }): Clock {
  return {
    Id: newId('clk'),
    CampaignId: input.CampaignId,
    Title: input.Title,
    Kind: input.Kind,
    Segments: input.Segments ?? DEFAULT_SEGMENTS,
    SuccessMarks: 0,
    FailureMarks: input.Kind === 'Opposition' ? 0 : undefined,
    Goal: '',
    SkillTags: [],
    Developments: [],
    PromotedToBoard: false,
    Status: 'Open',
    History: [],
    CreatedAt: nowIso(),
    UpdatedAt: nowIso(),
  };
}

/** Opposition Clock only (renamed from `'Basic'` in V0.6). A Hero risks 1-3 Headway before
 *  rolling, then takes an action appropriate in the fiction to that risk. On a 10+ the Success
 *  track gains the Headway risked; on a 7-9 *both* tracks gain it (the antagonist gains ground
 *  too); on a 6- only the Failure track gains it. Both tracks are clamped at `Segments` — a roll
 *  can't overshoot a track that's already full toward the other one filling instead. */
export function applyClockRoll(clock: Clock, risk: 1 | 2 | 3, tier: RollTier): { SuccessMarks: number; FailureMarks: number } {
  const successGain = tier === 'Tier3' || tier === 'Tier2' ? risk : 0;
  const failureGain = tier === 'Tier2' || tier === 'Tier1' ? risk : 0;
  return {
    SuccessMarks: Math.min(clock.Segments, clock.SuccessMarks + successGain),
    FailureMarks: Math.min(clock.Segments, (clock.FailureMarks ?? 0) + failureGain),
  };
}

/** Threat/Project/TugOfWar only — a plain GM-ticked single track (`SuccessMarks` doubles as "the"
 *  track for all three Kinds, per `Clock`'s own doc comment). Threat and Project only ever tick up
 *  in the UI; TugOfWar allows a negative `delta` too. Clamped to `[0, Segments]` either way — a
 *  negative tick never goes below empty, same as a positive one never overshoots full. */
export function tickClock(clock: Clock, delta: number): number {
  return Math.max(0, Math.min(clock.Segments, clock.SuccessMarks + delta));
}

/** Opposition Clock only. `null` while still in play; `'Both'` on the rare roll that fills both
 *  tracks at once (a 7-9 whose risked Headway caps out an already-nearly-full Success *and*
 *  Failure track in the same roll) — the doc gives no precedence between simultaneous
 *  Success/Failure, so this is surfaced rather than silently picked for the caller to resolve
 *  (mirrors this app's general "don't invent a table ruling" stance). */
export function clockOutcome(clock: Clock): 'Success' | 'Failure' | 'Both' | null {
  const succeeded = clock.SuccessMarks >= clock.Segments;
  const failed = (clock.FailureMarks ?? 0) >= clock.Segments;
  if (succeeded && failed) return 'Both';
  if (succeeded) return 'Success';
  if (failed) return 'Failure';
  return null;
}

/** Any Kind — whether the (single, or Opposition's Success) track has reached its cap. Used for
 *  the Threat/Project/TugOfWar "Full" badge, since those three Kinds have no auto-resolution to
 *  key off (`clockOutcome` above is Opposition-only) — the GM decides when a full Threat/Project/
 *  TugOfWar Clock actually resolves and what that means in the fiction. */
export function isClockFull(clock: Clock): boolean {
  return clock.SuccessMarks >= clock.Segments;
}

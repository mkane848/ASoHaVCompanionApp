/**
 * Adventures (V0.5 slice 9): pure logic over the `Adventure` shape. Same "track-and-display, GM
 * authors it, the app just holds the shape" philosophy as `clocks.ts` — nothing here enforces a
 * table ruling, it only builds the structure the doc's own "Adventures" chapter describes.
 */
import { newId, nowIso } from './logic.js';
import type { Adventure, AdventureCountdownStep, AdventureType } from './types.js';
import { ADVENTURE_COUNTDOWN_STEP_NAMES } from './types.js';

/** Ruleset-V0.5.md's six Adventure Types, each with the doc's own "Elements to include" guidance
 *  — surfaced directly in the picker so a GM choosing a Type sees what it's actually asking them
 *  to prep, not just a bare label. */
export const ADVENTURE_TYPES: { key: AdventureType; label: string; summary: string; elements: string }[] = [
  {
    key: 'Offensive',
    label: 'The Offensive',
    summary: 'The Heroes are beset against direct, forceful actions where violence or overwhelming power is the primary solution.',
    elements: 'Monstrous creatures or enemies that are armed, dangerous, and intend harm.',
  },
  {
    key: 'Stand',
    label: 'The Stand',
    summary: 'The Heroes must hold the line. A threat is encroaching on a location or corrupting something good — how will the Heroes defend against it?',
    elements: 'Enemy invasion, corruption of a leader or group.',
  },
  {
    key: 'Race',
    label: 'The Race',
    summary: 'The Heroes race against time to catch a quarry, flee from some unstoppable force, or stop something catastrophic from happening.',
    elements: 'An interesting pursuer or quarry, a very visible countdown to the big bad thing, people or things that make the clock tick faster/slower, obstacles that get in their way.',
  },
  {
    key: 'Mission',
    label: 'The Mission',
    summary: 'The Heroes use stealth, planning, and social maneuvering to bypass what stands in their way.',
    elements: 'Something to break into or break out of, locations to retrieve or plant important items or rescue someone, social webs, guards to trick.',
  },
  {
    key: 'Mystery',
    label: 'The Mystery',
    summary: "The Heroes must navigate the unknown by gathering info and intel before they're able to make their next move.",
    elements: 'Clues and secrets, tight-lipped and loose-lipped NPCs, hidden truths, a big reveal.',
  },
  {
    key: 'Journey',
    label: 'The Journey',
    summary: "The Heroes must survive in a test against the elements — either natural or mortal-made. They'll face down weather, terrain, puzzles, or participate in some structured contest.",
    elements: 'Dangerous locations, a game to play, a rival to face, puzzles and traps, magical obstacles guarding the path.',
  },
];

/** The doc's own prep guidance for Secrets ("Write down 10 Secrets before your Adventure
 *  Begins... Any fewer and you might find yourself short handed... Any more and it's just too
 *  much to track") — surfaced as a hint, not enforced as a minimum/maximum; a GM may hold any
 *  number, same as `Clock.Segments` isn't forced to the doc's own "4 for a basic obstacle"
 *  suggestion either. */
export const SUGGESTED_SECRET_COUNT = 10;

/** A fresh Adventure with all five named Countdown steps pre-seeded (empty `Text`, ready for GM
 *  prep) — the doc's own five-steps-under-prose-that-promises-six shape (`types.ts`'s
 *  `ADVENTURE_COUNTDOWN_STEP_NAMES` doc comment), never a sixth invented to close the gap. */
export function newAdventure(input: { CampaignId: string; Concept?: string; Type?: AdventureType | null; Hook?: string }): Adventure {
  const now = nowIso();
  return {
    Id: newId('adv'),
    CampaignId: input.CampaignId,
    Concept: input.Concept ?? '',
    Type: input.Type ?? null,
    Hook: input.Hook ?? '',
    VillainId: null,
    NpcIds: [],
    LocationIds: [],
    Secrets: [],
    CountdownSteps: ADVENTURE_COUNTDOWN_STEP_NAMES.map((Name) => ({ Name, Text: '' })),
    CountdownMarks: 0,
    Status: 'Active',
    CreatedAt: now,
    UpdatedAt: now,
  };
}

/** Ticks `Adventure.CountdownMarks` by `delta`, clamped to `[0, CountdownSteps.length]` — the same
 *  clamped-delta shape as `clocks.ts`'s `tickClock()` ("a Countdown is a clock variant"), kept as
 *  its own small function rather than reused directly since it operates on `Adventure`, not
 *  `Clock` (see `Adventure.CountdownMarks`'s doc comment in `types.ts` for why this stays a
 *  separate embedded field rather than a real linked `Clock` row). */
export function tickAdventureCountdown(adventure: Adventure, delta: number): number {
  return Math.max(0, Math.min(adventure.CountdownSteps.length, adventure.CountdownMarks + delta));
}

/** The named step currently reached (`CountdownMarks - 1` into `CountdownSteps`), or `null` while
 *  the Countdown hasn't begun (`CountdownMarks === 0`) — the GM's own "where are we" readout. */
export function currentCountdownStep(adventure: Adventure): AdventureCountdownStep | null {
  return adventure.CountdownMarks > 0 ? (adventure.CountdownSteps[adventure.CountdownMarks - 1] ?? null) : null;
}

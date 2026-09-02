/**
 * Rules engine: modifier transparency + mechanical-effect application, no dice simulation.
 *
 * By explicit product decision (see HANDOFF.md), this app does not roll dice for the player —
 * it tells them what to roll (2d6 + Virtue, plus every modifier and where each one comes from)
 * and, once they report back which tier they hit (or a physically-rolled d6 for a formula like
 * "1d6 + Mettle"), applies the resulting mechanical change to the sheet. The randomness always
 * happens at the table, on real dice.
 */
import { newId } from './logic.js';
import type { CharacterSheet, CharacterStatus, Library, StatusPolarity } from './types.js';

// ---------- Roll modifier breakdown ----------

export type RollModifierKind = 'Virtue' | 'Condition' | 'Status';

export interface RollModifierSource {
  Label: string;
  Value: number;
  Kind: RollModifierKind;
}

export interface RollBreakdown {
  VirtueId: string;
  VirtueName: string;
  /** The named stat's own modifier — Virtue base, Condition penalty (if marked), and any
   *  Permanent Ability bonus. This is what `Total` sums. */
  Sources: RollModifierSource[];
  /** The highest helpful/hindering Status, kept separate from `Sources`/`Total` — a Status is a
   *  circumstance affecting this roll, not part of the Virtue's own number, so it's surfaced
   *  alongside rather than folded in (see the doc comment on `computeRollBreakdown`). */
  StatusSources: RollModifierSource[];
  Total: number;
}

/** "What to roll" for a given Virtue: base score, Condition penalty (floored, same rule as
 *  `effectiveVirtueScore`) — together, `Total`. The single highest helpful and highest hindering
 *  Status (only the highest of each counts — see
 *  the Statuses rule) are computed too, but returned separately as `StatusSources` rather than
 *  folded into `Total`: a Status is a circumstance affecting this roll, not part of what "roll
 *  2d6 + Heart" itself means, and showing it as if it were the named stat's own number is
 *  misleading (confirmed directly with the repo owner, not assumed — an earlier version of this
 *  engine did fold Status into `Total`, which read as if a Status swing *was* the Virtue's
 *  modifier). */
export function computeRollBreakdown(sheet: CharacterSheet, virtueId: string, library: Library): RollBreakdown {
  const vv = sheet.Virtues.find((v) => v.VirtueId === virtueId);
  const virtue = library.virtues.find((v) => v.Id === virtueId);
  const cond = library.conditions.find((c) => c.VirtueId === virtueId);
  const sources: RollModifierSource[] = [];

  const base = vv?.Score ?? 0;
  sources.push({ Label: virtue?.Name ?? 'Virtue', Value: base, Kind: 'Virtue' });

  let flooredVirtue = base;
  if (vv?.ConditionMarked && cond) {
    sources.push({ Label: `${cond.Name} (marked)`, Value: cond.RollPenalty, Kind: 'Condition' });
    flooredVirtue = Math.max(base + cond.RollPenalty, library.settings.ConditionFloor);
  }

  const statusSources: RollModifierSource[] = [];
  const helpful = [...sheet.Statuses].filter((s) => s.Polarity === 'Positive').sort((a, b) => statusRank(b) - statusRank(a))[0];
  const hindering = [...sheet.Statuses].filter((s) => s.Polarity === 'Negative').sort((a, b) => statusRank(b) - statusRank(a))[0];
  if (helpful) statusSources.push({ Label: `${helpful.Name} (highest helpful Status)`, Value: statusRank(helpful), Kind: 'Status' });
  if (hindering) statusSources.push({ Label: `${hindering.Name} (highest hindering Status)`, Value: -statusRank(hindering), Kind: 'Status' });

  return {
    VirtueId: virtueId,
    VirtueName: virtue?.Name ?? virtueId,
    Sources: sources,
    StatusSources: statusSources,
    Total: flooredVirtue,
  };
}

// ---------- Resist Rolls ----------

/** Matches `MoveResults`' own tier keys (Tier3 = 10+, Tier2 = 7-9, Tier1 = miss) so a Resist
 *  Roll's outcome is reported the same way a Move's is. */
export type RollTier = 'Tier3' | 'Tier2' | 'Tier1';

/** Resist Roll: roll + relevant Virtue. On a hit, the incoming Status Rank is reduced by the
 *  Virtue score used (10+ reduces one further); on a miss, no reduction — the incoming Rank
 *  lands in full. A negative Virtue score can't make a resist roll *worse* than a miss, so it's
 *  floored at 0 before the tier bonus is added. Some Statuses are GM-flagged non-resistable and
 *  simply never reach this function. */
export function resistRollReduction(virtueScoreUsed: number, tier: RollTier): number {
  if (tier === 'Tier1') return 0;
  const base = Math.max(0, virtueScoreUsed);
  return tier === 'Tier3' ? base + 1 : base;
}

// ---------- Move-granted Hold ----------

/** How much Hold a Move grants for a reported tier — `move.HoldGrant`'s value for that tier, or
 *  0 if the Move doesn't grant Hold at that tier (or at all). A tier that offers a *choice* of
 *  how much Hold to take (Assess the Situation's 7-9: "hold 1, or hold 2 and choose one
 *  complication") is represented by `HoldGrant`'s guaranteed minimum for that tier — the extra
 *  Hold from taking the complication is the player's own call, same as every other optional
 *  consequence this app leaves as reference text rather than tracking. */
export function holdGrantForTier(move: { HoldGrant?: Partial<Record<RollTier, number>> }, tier: RollTier): number {
  return move.HoldGrant?.[tier] ?? 0;
}

// ---------- Status engine ----------

/** Box count on a Status row. Boxes 1-5 are the normal range; box 6 is the Subdued overflow —
 *  a Negative Status reaching it means Subdued, not simply "a bigger Rank 5".
 *  Matches `GameSettings.StatusMaxRank` (6) by default. */
export const DEFAULT_SUBDUED_RANK = 6;

// ---------- Box-row primitives ----------
//
// A Status is a row of marked boxes (ruleset V0.5). These three helpers are the only places that
// know how a row works; every other function here routes through them.

/** The Status's Rank: the **highest marked box**, or 0 if none are marked.
 *  Never count marks — the row is deliberately sparse (`[_, X, _, X, _]` is Rank 4, not 2). */
export function statusRank(status: { Marks: boolean[] }): number {
  const { Marks } = status;
  for (let i = Marks.length - 1; i >= 0; i -= 1) if (Marks[i]) return i + 1;
  return 0;
}

/** An empty row of `boxes` boxes. */
export function emptyMarks(boxes: number = DEFAULT_SUBDUED_RANK): boolean[] {
  return Array.from({ length: boxes }, () => false);
}

/** V0.5's actual marking rule, and the whole reason a Status stopped being an integer:
 *  gaining Rank `n` marks box `n` — **or the next empty box to its right** if box `n` is already
 *  marked. So Distracted 2 then Distracted 4 gives `[_, X, _, X, _]` (Rank 4), and a second
 *  Distracted 2 on `[_, X, _, _, _]` gives `[_, X, X, _, _]` (Rank 3), not Rank 2 again.
 *
 *  Returns the row unchanged when `n` is out of range or every box from `n` rightwards is
 *  already marked (the row is saturated at that Rank and above — the caller decides whether that
 *  means Subdued). Pure. */
export function markRank(marks: boolean[], n: number, boxes: number = DEFAULT_SUBDUED_RANK): boolean[] {
  const row = marks.length === boxes ? [...marks] : [...marks.slice(0, boxes), ...emptyMarks(boxes).slice(marks.length)];
  if (n < 1 || n > boxes) return row;
  for (let i = n - 1; i < boxes; i += 1) {
    if (!row[i]) {
      row[i] = true;
      return row;
    }
  }
  return row;
}

/** Reducing a Status clears `amount` marks **from the highest box down** (V0.5: "clear marks
 *  equal to the reduction, starting from the highest box"). Reduced below 1, the row is empty and
 *  the caller drops the Status entirely. Pure. */
export function reduceRank(marks: boolean[], amount: number): boolean[] {
  if (amount <= 0) return marks;
  const row = [...marks];
  let left = amount;
  for (let i = row.length - 1; i >= 0 && left > 0; i -= 1) {
    if (row[i]) {
      row[i] = false;
      left -= 1;
    }
  }
  return row;
}

export interface StatusApplyResult {
  Statuses: CharacterStatus[];
  /** True when this application marked a Negative Status's Subdued box (box `maxRank`) — the
   *  caller should run the Subdued flow (see `resolveRiskDeath`) rather than just display it. */
  Subdued: boolean;
}

/** Gives (or increases) a Status by name+polarity, following V0.5's box rule via `markRank`:
 *  an existing Status of the same Name and Polarity gets box `incoming.Rank` marked, or the next
 *  empty box to its right; otherwise a new Status is created with that box marked.
 *
 *  Note this is no longer additive — gaining Rank 2 twice yields Rank 3 (boxes 2 and 3), not
 *  Rank 4, because the second mark lands in the next empty box rather than summing. */
export function giveStatus(
  statuses: CharacterStatus[],
  incoming: { Name: string; Polarity: StatusPolarity; Rank: number },
  maxRank: number = DEFAULT_SUBDUED_RANK,
): StatusApplyResult {
  if (incoming.Rank <= 0) return { Statuses: statuses, Subdued: false };
  const existing = statuses.find((s) => s.Name.toLowerCase() === incoming.Name.toLowerCase() && s.Polarity === incoming.Polarity);
  const nextMarks = markRank(existing?.Marks ?? emptyMarks(maxRank), Math.min(incoming.Rank, maxRank), maxRank);
  const subdued = incoming.Polarity === 'Negative' && statusRank({ Marks: nextMarks }) >= maxRank;

  const next = existing
    ? statuses.map((s) => (s.Id === existing.Id ? { ...s, Marks: nextMarks } : s))
    : [...statuses, { Id: newId('st'), Name: incoming.Name, Marks: nextMarks, Polarity: incoming.Polarity, LinkedToIds: [], AffectedByIds: [] }];

  return { Statuses: next, Subdued: subdued };
}

/** Clears Ranks off a single existing Status (healing, a successful Resist Roll's reduction,
 *  etc.) — clearing every mark removes the Status entry entirely. */
export function healStatus(statuses: CharacterStatus[], statusId: string, amount: number): CharacterStatus[] {
  if (amount <= 0) return statuses;
  return statuses
    .map((s) => (s.Id === statusId ? { ...s, Marks: reduceRank(s.Marks, amount) } : s))
    .filter((s) => statusRank(s) > 0);
}

/** Opposite Statuses can't coexist — giving one cancels Rank-for-Rank against a Status the
 *  player/GM identifies as its opposite (e.g. Friendly 2 into an existing Hostile 3 leaves
 *  Hostile 1; the reverse leaves Friendly 1; an exact match clears both). There's no authored
 *  "opposite pairs" registry yet (Statuses are free-text — see `StatusesPanel`), so the caller
 *  supplies which existing Status this one opposes rather than it being inferred from the name.
 *
 *  Takes `maxRank` as of `0.28.0`: a flip that lands at the Subdued box has to be able to report
 *  it, and the row it builds has to be the right length. Previously it silently ignored the cap. */
export function applyOpposingStatus(
  statuses: CharacterStatus[],
  incoming: { Name: string; Polarity: StatusPolarity; Rank: number },
  opposingId: string,
  maxRank: number = DEFAULT_SUBDUED_RANK,
): StatusApplyResult {
  const opposing = statuses.find((s) => s.Id === opposingId);
  if (!opposing) return giveStatus(statuses, incoming, maxRank);
  const net = statusRank(opposing) - incoming.Rank;
  const withoutOpposing = statuses.filter((s) => s.Id !== opposingId);
  if (net > 0) {
    return { Statuses: [...withoutOpposing, { ...opposing, Marks: markRank(emptyMarks(maxRank), net, maxRank) }], Subdued: false };
  }
  if (net < 0) {
    const marks = markRank(emptyMarks(maxRank), Math.min(-net, maxRank), maxRank);
    const subdued = incoming.Polarity === 'Negative' && statusRank({ Marks: marks }) >= maxRank;
    return {
      Statuses: [...withoutOpposing, { Id: newId('st'), Name: incoming.Name, Marks: marks, Polarity: incoming.Polarity, LinkedToIds: [], AffectedByIds: [] }],
      Subdued: subdued,
    };
  }
  return { Statuses: withoutOpposing, Subdued: false };
}

/** A Hero marks **Unstable** at Rank 4 of any Status (V0.5). No mechanical effect on its own —
 *  it exists for other abilities and moves to key off. Derived, never stored: a stored flag would
 *  drift from the Statuses that determine it. */
export const UNSTABLE_AT_RANK = 4;

export function isUnstable(statuses: CharacterStatus[]): boolean {
  return statuses.some((s) => statusRank(s) >= UNSTABLE_AT_RANK);
}

/** Sum of every Negative Status's Rank. Lives here rather than in `logic.ts` so that module
 *  doesn't have to import the Status engine (they would import each other otherwise — `engine.ts`
 *  already takes `newId` from `logic.ts`). Referenced by authored move text ("6 or more
 *  negative Status Ranks") that isn't mechanised yet. */
export function negativeStatusRankTotal(sheet: CharacterSheet): number {
  return sheet.Statuses.filter((s) => s.Polarity === 'Negative').reduce((n, s) => n + statusRank(s), 0);
}

const STATUS_POLARITY_SORT_ORDER: Record<StatusPolarity, number> = { Positive: 0, Neutral: 1, Negative: 2 };

/** Positive → Neutral → Negative, then Rank descending (the most severe/impactful Status per
 *  group leads it), then name A-Z case-insensitively. Pure — returns a new array, doesn't mutate
 *  `statuses`. For read-only Status displays (GM peek, Combat participant cards) where the viewer
 *  benefits from a scannable, stable order. Deliberately NOT used for StatusesPanel's own rows on
 *  the player's own sheet — those are editable and already grouped by polarity with headings;
 *  sorting by Rank there would slide a row out from under the player's finger as they tap pips to
 *  change that very Rank. */
export function sortStatuses(statuses: CharacterStatus[]): CharacterStatus[] {
  return [...statuses].sort((a, b) => {
    const polarityDiff = STATUS_POLARITY_SORT_ORDER[a.Polarity] - STATUS_POLARITY_SORT_ORDER[b.Polarity];
    if (polarityDiff !== 0) return polarityDiff;
    const rankDiff = statusRank(b) - statusRank(a);
    if (rankDiff !== 0) return rankDiff;
    return a.Name.toLowerCase().localeCompare(b.Name.toLowerCase());
  });
}

// ---------- Subdued / Scar / Risk Death / Blaze of Glory ----------

export type SubduedChoice = 'Scar' | 'RiskDeath' | 'BlazeOfGlory';

/** Matches RollTier's 10+/7-9/miss shape for the "roll + Nothing" Risk Death roll. */
export type RiskDeathOutcome = 'Tier3' | 'Tier2' | 'Tier1';

export interface RiskDeathResult {
  Outcome: RiskDeathOutcome;
  /** The Subduing Status's new Rank on a clean live result; null when the character is taken
   *  out of the scene (unconscious or dying) rather than just knocked back down. */
  SubduingRankAfter: number | null;
  RequiresScar: boolean;
  Narrative: string;
}

export function resolveRiskDeath(outcome: RiskDeathOutcome): RiskDeathResult {
  switch (outcome) {
    case 'Tier3':
      return { Outcome: outcome, SubduingRankAfter: 3, RequiresScar: false, Narrative: 'You live. The Subduing Status drops to Rank 3.' };
    case 'Tier2':
      return {
        Outcome: outcome,
        SubduingRankAfter: null,
        RequiresScar: true,
        Narrative: 'You live, but are unconscious or taken out of the scene. The GM assigns a Scar — accept it, or the character perishes.',
      };
    case 'Tier1':
      return { Outcome: outcome, SubduingRankAfter: null, RequiresScar: false, Narrative: 'Dying. Narrate your last words.' };
  }
}

export function makeScar(text: string, at: string): { Id: string; Text: string; At: string } {
  return { Id: newId('scar'), Text: text.trim(), At: at };
}

// ---------- Recoveries ----------

/** Formula given for Healing a Status: 1d6 + Mettle, spending a Recovery. Since this engine
 *  never rolls dice itself, `d6Rolled` is the number the player reports rolling physically. */
export function healingSurgeAmount(d6Rolled: number, mettleScore: number): number {
  return Math.max(0, d6Rolled) + mettleScore;
}

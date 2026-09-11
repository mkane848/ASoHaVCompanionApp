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
import type { CharacterSheet, CharacterStatus, Library, StatusSeverity } from './types.js';

// ---------- Roll modifier breakdown ----------

export type RollModifierKind = 'Virtue' | 'Condition' | 'SkillTag' | 'FlawTag' | 'PushYourself' | 'Status';

export interface RollModifierSource {
  Label: string;
  Value: number;
  Kind: RollModifierKind;
}

/** Minor -1, Major Disadvantage, Severe roll 1d6 instead of 2d6 — see `statusPenalty()`. */
export interface StatusPenalty {
  Severity: StatusSeverity;
  /** Human-readable effect: "-1", "Disadvantage", or "roll 1d6 instead of 2d6". Not a number for
   *  Major/Severe — those change the shape of the roll, not a value to add to a total. */
  Label: string;
}

/** V0.6's own three-way roll shape: more relevant Boons than Banes rolls Advantage (3d6, keep
 *  the best two), more Banes than Boons rolls Disadvantage (3d6, keep the worst two), equal
 *  (including none selected) rolls the usual 2d6. */
export type AdvantageState = 'Advantage' | 'Disadvantage' | 'Normal';

/** Compares counts of Boons/Banes the player has selected as relevant to a specific roll — see
 *  `RollExtras.BoonsSelected`/`BanesSelected`. Ties (including 0/0) are Normal: the doc's rule is
 *  strictly "more of one than the other," not "any Boon beats no Banes." */
export function compareBoonsAndBanes(boonsSelected: number, banesSelected: number): AdvantageState {
  if (boonsSelected > banesSelected) return 'Advantage';
  if (banesSelected > boonsSelected) return 'Disadvantage';
  return 'Normal';
}

/** Per-roll selections a player makes in the roll builder (V0.6 slice 2) — none of this is
 *  persisted; it's ephemeral state scoped to one roll, gathered by the UI and handed to
 *  `computeRollBreakdown` for display. Marking the Condition a `PushYourselfTag` costs, and the
 *  Potential a `FlawTags` entry marks, are real sheet mutations the *caller* performs (same
 *  "engine computes, UI applies via commit()" split as everywhere else in this module) — this
 *  function only computes what the roll adds up to once those choices are made. */
export interface RollExtras {
  /** The one Skill Tag declared before rolling (+1) — free, no cost. */
  SkillTag?: string | null;
  /** A second Skill Tag applied via Push Yourself (+1) — costs marking a Condition, which the
   *  caller does separately; this only adds the roll bonus. */
  PushYourselfTag?: string | null;
  /** Every Flaw Tag the player has declared relevant (-1 each) — each one also marks Potential on
   *  its own Motif, win or miss, which again is the caller's job, not this function's. */
  FlawTags?: string[];
  /** Count of the player's own Boons/Banes marked relevant to this specific roll — feeds
   *  `compareBoonsAndBanes()` for `Advantage`. */
  BoonsSelected?: number;
  BanesSelected?: number;
}

export interface RollBreakdown {
  VirtueId: string;
  VirtueName: string;
  /** Every numeric modifier that sums to `Total`: Virtue base, Condition penalty (if marked),
   *  the declared Skill Tag and Push Yourself tag (if any), each declared Flaw Tag, and a Minor
   *  Status penalty (if the sheet's highest-severity Status is Minor — see `StatusPenalty` below
   *  for why Major/Severe don't appear here). */
  Sources: RollModifierSource[];
  Total: number;
  /** The sheet's highest-severity Status, when it's Major or Severe — Minor folds directly into
   *  `Sources`/`Total` instead (V0.6 slice 2), since "-1" composes with everything else numeric
   *  the way Major's "Disadvantage" and Severe's "roll 1d6 instead of 2d6" cannot: those change
   *  the shape of the roll, not a value to add, and this app doesn't invent a rule for how a
   *  Status-driven Disadvantage combines with a Boon/Bane-driven one — see `Advantage` below and
   *  WorkPlan-V0.6.md Section D. Null whenever the highest Status (if any) is Minor, or there is
   *  none. */
  StatusPenalty: { Status: CharacterStatus; Penalty: StatusPenalty } | null;
  /** From `RollExtras.BoonsSelected`/`BanesSelected` via `compareBoonsAndBanes()` — V0.6's general
   *  Advantage/Disadvantage mechanic (slice 2), replacing the old per-Move `AdvantageTrigger`. */
  Advantage: AdvantageState;
}

const STATUS_SEVERITY_RANK: Record<StatusSeverity, number> = { Severe: 3, Major: 2, Minor: 1 };

/** The single highest-severity Status on a sheet, or null. Ties (two Statuses of the same
 *  severity) resolve to whichever sorts first — the rule only ever needs "one of the highest",
 *  since penalties never stack regardless of which one is shown. */
export function highestSeverityStatus(statuses: CharacterStatus[]): CharacterStatus | null {
  if (statuses.length === 0) return null;
  return [...statuses].sort((a, b) => STATUS_SEVERITY_RANK[b.Severity] - STATUS_SEVERITY_RANK[a.Severity])[0];
}

/** Minor (-1) / Major (Disadvantage) / Severe (roll 1d6 instead of 2d6) — V0.6's own table,
 *  verbatim. */
export function statusPenalty(severity: StatusSeverity): StatusPenalty {
  switch (severity) {
    case 'Minor':
      return { Severity: 'Minor', Label: '-1' };
    case 'Major':
      return { Severity: 'Major', Label: 'Disadvantage' };
    case 'Severe':
      return { Severity: 'Severe', Label: 'roll 1d6 instead of 2d6' };
  }
}

/** "What to roll" for a given Virtue: base score, Condition penalty (floored, same rule as
 *  `effectiveVirtueScore`), then — V0.6 slice 2 — whatever the player declared for this specific
 *  roll via `extras`: a Skill Tag, a Push Yourself tag, any Flaw Tags, and a Minor Status penalty
 *  if that's the sheet's highest-severity Status. All of those fold into `Sources`/`Total`; a
 *  Major/Severe Status stays a separate `StatusPenalty` (see its doc comment), and Boons/Banes
 *  produce `Advantage` rather than a number. */
export function computeRollBreakdown(sheet: CharacterSheet, virtueId: string, library: Library, extras: RollExtras = {}): RollBreakdown {
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

  let extraTotal = 0;
  if (extras.SkillTag) {
    sources.push({ Label: `Skill Tag — "${extras.SkillTag}"`, Value: 1, Kind: 'SkillTag' });
    extraTotal += 1;
  }
  if (extras.PushYourselfTag) {
    sources.push({ Label: `Push Yourself — "${extras.PushYourselfTag}"`, Value: 1, Kind: 'PushYourself' });
    extraTotal += 1;
  }
  for (const flaw of extras.FlawTags ?? []) {
    sources.push({ Label: `Flaw Tag — "${flaw}"`, Value: -1, Kind: 'FlawTag' });
    extraTotal -= 1;
  }

  const status = highestSeverityStatus(sheet.Statuses);
  let statusPenaltyDisplay: { Status: CharacterStatus; Penalty: StatusPenalty } | null = null;
  if (status) {
    const penalty = statusPenalty(status.Severity);
    if (status.Severity === 'Minor') {
      sources.push({ Label: `${status.Name} (Minor)`, Value: -1, Kind: 'Status' });
      extraTotal -= 1;
    } else {
      statusPenaltyDisplay = { Status: status, Penalty: penalty };
    }
  }

  return {
    VirtueId: virtueId,
    VirtueName: virtue?.Name ?? virtueId,
    Sources: sources,
    Total: flooredVirtue + extraTotal,
    StatusPenalty: statusPenaltyDisplay,
    Advantage: compareBoonsAndBanes(extras.BoonsSelected ?? 0, extras.BanesSelected ?? 0),
  };
}

// ---------- Resist Rolls ----------

/** Matches `MoveResults`' own tier keys (Tier3 = 10+, Tier2 = 7-9, Tier1 = miss) so a Resist
 *  Roll's outcome is reported the same way a Move's is. */
export type RollTier = 'Tier3' | 'Tier2' | 'Tier1';

/** Resist Roll: roll + relevant Virtue. On a hit, incoming Strain is reduced by the Virtue score
 *  used (10+ reduces one further); on a miss, no reduction — the incoming Strain lands in full.
 *  A negative Virtue score can't make a resist roll *worse* than a miss, so it's floored at 0
 *  before the tier bonus is added. Some effects that deal Strain don't trigger a Resist at all —
 *  the GM or the effect's own text says so, and this app can't detect that on its own. */
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

// ---------- Box-row primitives ----------
//
// A box row (ruleset V0.5, carried into V0.6 for the Strain track and an Enemy's own Strain
// marks — see combat.ts's EnemyStrainMark) is a sparse row of marked boxes. These three helpers
// are the only places that know how a row works; everything else routes through them.

/** Default box count for a fresh row — matches `GameSettings.StrainTrackLength` (5). Enemy
 *  tracks (`combat.ts`) pass their own box count explicitly rather than relying on this. */
export const DEFAULT_STRAIN_BOXES = 5;

/** The row's Rank/value: the **highest marked box**, or 0 if none are marked. Never count marks
 *  — the row is deliberately sparse (`[_, X, _, X, _]` is 4, not 2). */
export function statusRank(row: { Marks: boolean[] }): number {
  const { Marks } = row;
  for (let i = Marks.length - 1; i >= 0; i -= 1) if (Marks[i]) return i + 1;
  return 0;
}

/** An empty row of `boxes` boxes. */
export function emptyMarks(boxes: number = DEFAULT_STRAIN_BOXES): boolean[] {
  return Array.from({ length: boxes }, () => false);
}

/** The row's actual marking rule: gaining value `n` marks box `n` — **or the next empty box to
 *  its right** if box `n` is already marked. So marking 2 then marking 4 gives `[_, X, _, X, _]`
 *  (value 4), and a second mark of 2 on `[_, X, _, _, _]` gives `[_, X, X, _, _]` (value 3), not
 *  2 again.
 *
 *  Returns the row unchanged when `n` is out of range or every box from `n` rightwards is
 *  already marked (the row is saturated — the caller decides what that means, e.g. Subdued for
 *  Strain). Pure. */
export function markRank(marks: boolean[], n: number, boxes: number = DEFAULT_STRAIN_BOXES): boolean[] {
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

/** Reducing a row clears `amount` marks **from the highest box down**. Reduced to nothing, the
 *  row is simply empty — the caller decides whether an empty row means the Status/track is gone.
 *  Pure. */
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

// ---------- Strain (V0.6 slice 1) ----------

/** Marks `amount` Strain onto a Hero's own Strain track — a thin, named wrapper over `markRank`
 *  so call sites read as Strain-specific rather than generic box-row arithmetic. Clamped at
 *  `boxes` (a value higher than the track itself can hold marks the top box, same as `markRank`
 *  would already do). */
export function markStrain(current: boolean[], amount: number, boxes: number = DEFAULT_STRAIN_BOXES): boolean[] {
  if (amount <= 0) return current;
  return markRank(current, Math.min(amount, boxes), boxes);
}

/** No call site outside tests yet — `isSubdued()` derives the full condition from a saturated
 *  row and full slots, so nothing needs the look-ahead so far. Kept because it is the first
 *  half of V0.6's own Subdued rule and the only thing that can answer "would this Strain land"
 *  *before* mutating; Subdued's own duration and consequence are Section D item 13, still open.
 */
/** Whether marking `amount` more Strain would find nowhere to go — no box at or above `amount`
 *  is still empty. V0.6: "If there is no higher available Strain box, and you can't take a
 *  Status that would mitigate the incoming Strain to 0, your Hero is Subdued." This predicts
 *  that first half ahead of actually mutating the row, so the caller can decide whether to run
 *  Subdued instead of silently no-op'ing (`markRank` itself just returns the row unchanged when
 *  saturated). */
export function strainExhausted(current: boolean[], amount: number, boxes: number = DEFAULT_STRAIN_BOXES): boolean {
  if (amount <= 0) return false;
  const start = Math.max(1, Math.min(amount, boxes));
  for (let i = start - 1; i < boxes; i += 1) if (!current[i]) return false;
  return true;
}

// ---------- Statuses (V0.6 slice 1) ----------

/** How much incoming Strain taking a Status of a given severity absorbs — "2 for Minor, 4 for
 *  Major, 6 for Severe," V0.6's own table, verbatim. Any Strain left over after absorbing still
 *  lands on the Strain track. */
export function statusAbsorb(severity: StatusSeverity): number {
  return severity === 'Minor' ? 2 : severity === 'Major' ? 4 : 6;
}

/** How many of a holder's Statuses currently occupy each severity's slots — the bound a new
 *  Status has to check against before it can be taken (Minor x`MinorStatusSlots`, etc.). */
export function statusSeverityCounts(statuses: CharacterStatus[]): Record<StatusSeverity, number> {
  return {
    Minor: statuses.filter((s) => s.Severity === 'Minor').length,
    Major: statuses.filter((s) => s.Severity === 'Major').length,
    Severe: statuses.filter((s) => s.Severity === 'Severe').length,
  };
}

/** Gains a new Status in a severity slot — the write path both "take a Status to Resist
 *  incoming Strain" and StatusesPanel's own manual "take a Status" control share. Does not
 *  itself check slot capacity; the caller (which already has to show the player which
 *  severities still have a free slot) is expected to have filtered the choice down to one that
 *  fits. */
export function takeStatus(statuses: CharacterStatus[], input: { Severity: StatusSeverity; Name: string; Description: string }): CharacterStatus[] {
  return [...statuses, { Id: newId('st'), Severity: input.Severity, Name: input.Name.trim(), Description: input.Description.trim() }];
}

const DOWNGRADE_SEVERITY: Record<StatusSeverity, StatusSeverity | null> = { Severe: 'Major', Major: 'Minor', Minor: null };

/** When the Healing Track fills: "downgrade every Status you currently have by one severity
 *  (Severe becomes Major; Major becomes Minor)... You must have an empty slot at the lower
 *  severity... If the required slot is already full, that specific Status does not downgrade."
 *  Slot availability is checked against the *starting* counts (`slotCaps` minus how many already
 *  sit at each severity before this pass), so downgrading one Status doesn't free a slot for
 *  another to downgrade into in the same pass — matches the doc's "in any order you want," which
 *  wouldn't be a real choice if order changed the outcome. Renaming a downgraded Status ("Broken
 *  Arm" -> "Arm in a Sling") is the player's own call; this only moves the severity. */
export function downgradeStatuses(statuses: CharacterStatus[], slotCaps: Record<StatusSeverity, number>): CharacterStatus[] {
  const startCounts = statusSeverityCounts(statuses);
  const movedIn: Record<StatusSeverity, number> = { Minor: 0, Major: 0, Severe: 0 };
  return statuses.map((s) => {
    const target = DOWNGRADE_SEVERITY[s.Severity];
    if (!target) return s;
    const freeAtTarget = slotCaps[target] - startCounts[target] - movedIn[target];
    if (freeAtTarget <= 0) return s;
    movedIn[target] += 1;
    return { ...s, Severity: target };
  });
}

const ALL_SEVERITIES: StatusSeverity[] = ['Minor', 'Major', 'Severe'];

/** V0.6 slice 1's redefinition of **Subdued**: "no higher available Strain box, and you can't
 *  take a Status that would mitigate the incoming Strain to 0" — generalized here to a standing,
 *  badge-able state rather than something computed only at the instant of a specific incoming
 *  hit: the Strain track is entirely full *and* every severity slot is full, so by construction
 *  no future incoming Strain, at any amount, could possibly find a box or a slot to land in.
 *  V0.6 deliberately leaves Subdued's *consequence* undefined (Section D of
 *  `WorkPlan-V0.6.md`) — the old three-way Scar/Risk Death/Blaze of Glory choice retires with
 *  no replacement, so this is display-only: a fact the table narrates around, not a modal that
 *  fires. */
export function isSubdued(strain: boolean[], statuses: CharacterStatus[], slotCaps: Record<StatusSeverity, number>): boolean {
  if (strain.length === 0 || !strain.every(Boolean)) return false;
  const counts = statusSeverityCounts(statuses);
  return ALL_SEVERITIES.every((s) => counts[s] >= slotCaps[s]);
}

/** A Hero is **Unstable** while holding any Major or Severe Status (V0.6 slice 1 — replaces the
 *  old "Rank 4 of any ranked Status" rule). No mechanical effect on its own; exists for other
 *  abilities and moves to key off. Derived, never stored — a stored flag would drift from the
 *  Statuses that determine it. */
export function isUnstable(statuses: CharacterStatus[]): boolean {
  return statuses.some((s) => s.Severity === 'Major' || s.Severity === 'Severe');
}

// ---------- Healing Track (V0.6 slice 1) ----------

/** Advances the Healing Track by `segments` (3/2/1 for a Recuperate roll's 10+/7-9/6-), clamped
 *  at `length`. Filling it is the caller's own job to detect (`current + segments >= length`)
 *  and act on via `downgradeStatuses` — this function only does the addition. */
export function advanceHealingTrack(current: number, segments: number, length: number): number {
  return Math.max(0, Math.min(length, current + segments));
}

/** Segments a Recuperate roll's reported tier marks on the Healing Track — the doc's own 10+/7-9/
 *  6- table (3/2/1), shared so every call site (the sheet's own Recuperate, and Enjoy Downtime's
 *  Rest — V0.6 slice 4, `WorkPlan-V0.6.md` Section A2: "Rest becomes Recuperate without taking
 *  Strain") uses the same numbers rather than each hand-copying them. */
export const RECUPERATE_SEGMENTS: Record<RollTier, number> = { Tier3: 3, Tier2: 2, Tier1: 1 };

/** The full Recuperate effect — take 2 Strain (unless `takeStrain` is false), optionally remove
 *  one Minor Status, advance the Healing Track by the reported tier's segments, and downgrade
 *  every held Status a severity if the track fills. Shared between `StatusesPanel.tsx`'s own
 *  Recuperate action (`takeStrain: true`, the doc's normal cost) and Enjoy Downtime's Rest
 *  (`takeStrain: false` — V0.6's own "Recuperate without taking Strain," the one place this app
 *  waives that cost) so the two never drift on the rest of the mechanic. A pure function, like
 *  every other primitive in this module — the caller applies the returned fields to its own
 *  mutable draft. */
export function applyRecuperateEffect(
  sheet: { Strain: boolean[]; Statuses: CharacterStatus[]; HealingTrack: number },
  removeStatusId: string | null,
  tier: RollTier,
  slotCaps: Record<StatusSeverity, number>,
  settings: { StrainTrackLength: number; HealingTrackLength: number },
  takeStrain: boolean = true,
): { Strain: boolean[]; Statuses: CharacterStatus[]; HealingTrack: number } {
  const strain = takeStrain ? markStrain(sheet.Strain, 2, settings.StrainTrackLength) : sheet.Strain;
  let statuses = removeStatusId ? sheet.Statuses.filter((s) => s.Id !== removeStatusId) : sheet.Statuses;
  const length = settings.HealingTrackLength;
  const advanced = advanceHealingTrack(sheet.HealingTrack, RECUPERATE_SEGMENTS[tier], length);
  let healingTrack = advanced;
  if (advanced >= length) {
    statuses = downgradeStatuses(statuses, slotCaps);
    healingTrack = Math.max(0, advanced - length);
  }
  return { Strain: strain, Statuses: statuses, HealingTrack: healingTrack };
}

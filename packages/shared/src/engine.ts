/**
 * Rules engine: modifier transparency + mechanical-effect application, no dice simulation.
 *
 * By explicit product decision (see HANDOFF.md), this app does not roll dice for the player —
 * it tells them what to roll (2d6 + Virtue, plus every modifier and where each one comes from)
 * and, once they report back which tier they hit (or a physically-rolled d6 for a formula like
 * "1d6 + Mettle"), applies the resulting mechanical change to the sheet. The randomness always
 * happens at the table, on real dice. The admin-only odds readout (`rollOdds()`, `odds.ts`) counts
 * every possible outcome instead of rolling one, so it keeps this true.
 */
import { newId } from './ids.js';
import type { ArmorKey, ArmorType, CharacterSheet, CharacterStatus, Item, Library, StatusSeverity, StrainTag } from './types.js';

// ---------- Roll modifier breakdown ----------

/** `Condition` is kept only for history: under the V0.6 revision a marked Condition gives a Bane
 *  (see `conditionBaneCandidates`), never a numeric source. `PartyTag`/`Reminder`/`Aid`/`Bond`/
 *  `WorkTogether` arrive through `RollExtras.ExtraModifiers` from later slices; `Cap` labels the
 *  line that brings an over-cap sum back to ±`HeroRollModifierCap`. */
export type RollModifierKind =
  | 'Virtue'
  | 'Condition'
  | 'SkillTag'
  | 'FlawTag'
  | 'PushYourself'
  | 'Status'
  | 'PartyTag'
  | 'Reminder'
  | 'Aid'
  | 'Bond'
  | 'WorkTogether'
  | 'Cap';

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
 *  (including none selected) rolls the usual 2d6. `DoubleDisadvantage` (4d6, keep the worst two)
 *  is the revision's one extra step, reachable only through Repeated Attacks in Combat (slice 6);
 *  `compareBoonsAndBanes` never returns it. */
export type AdvantageState = 'Advantage' | 'Disadvantage' | 'Normal' | 'DoubleDisadvantage';

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
  /** Numeric modifiers other features contribute to this roll (a Party Skill Tag, a Forward or
   *  Ongoing reminder, Aid, a Bond spend, a Work Together contribution). Each is added to the total
   *  as given, before the Hero Roll's cap. Declared here in slice 1 so later slices add a section,
   *  not a signature change. */
  ExtraModifiers?: RollModifierSource[];
}

export interface RollBreakdown {
  VirtueId: string;
  VirtueName: string;
  /** Every numeric modifier that sums to `Total`: Virtue base, Condition penalty (if marked),
   *  the declared Skill Tag and Push Yourself tag (if any), each declared Flaw Tag, and a Minor
   *  Status penalty (if the sheet's highest-severity Status is Minor — see `StatusPenalty` below
   *  for why Major/Severe don't appear here). */
  Sources: RollModifierSource[];
  /** The final modifier, capped to ±`GameSettings.HeroRollModifierCap` (V0.6 revision). */
  Total: number;
  /** The sum of every numeric source before the cap. Equal to `Total` unless `Capped`. */
  Uncapped: number;
  /** True when the cap changed the total — the UI says so rather than hiding the lost points. */
  Capped: boolean;
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

/** "What to roll" for a given Virtue: base score, then — V0.6 revision — whatever the player
 *  declared for this specific roll via `extras`: a Skill Tag, a Push Yourself tag (both +1), any
 *  Flaw Tags (each −1), and a Minor Status penalty if that's the sheet's highest-severity Status
 *  (also −1). All of those fold into `Sources`/`Total` before the Hero Roll's cap (±3 or
 *  `GameSettings.HeroRollModifierCap`). A marked Condition now gives a Bane instead (see
 *  `conditionBaneCandidates`), not a numeric source. A Major/Severe Status stays a separate
 *  `StatusPenalty` (see its doc comment), and Boons/Banes produce `Advantage` rather than a number. */
export function computeRollBreakdown(sheet: CharacterSheet, virtueId: string, library: Library, extras: RollExtras = {}): RollBreakdown {
  const vv = sheet.Virtues.find((v) => v.VirtueId === virtueId);
  const virtue = library.virtues.find((v) => v.Id === virtueId);
  const sources: RollModifierSource[] = [];

  const base = vv?.Score ?? 0;
  sources.push({ Label: virtue?.Name ?? 'Virtue', Value: base, Kind: 'Virtue' });

  if (extras.SkillTag) {
    sources.push({ Label: `Skill Tag — "${extras.SkillTag}"`, Value: 1, Kind: 'SkillTag' });
  }
  if (extras.PushYourselfTag) {
    sources.push({ Label: `Push Yourself — "${extras.PushYourselfTag}"`, Value: 1, Kind: 'PushYourself' });
  }
  for (const flaw of extras.FlawTags ?? []) {
    sources.push({ Label: `Flaw Tag — "${flaw}"`, Value: -1, Kind: 'FlawTag' });
  }

  const status = highestSeverityStatus(sheet.Statuses);
  let statusPenaltyDisplay: { Status: CharacterStatus; Penalty: StatusPenalty } | null = null;
  if (status) {
    const penalty = statusPenalty(status.Severity);
    if (status.Severity === 'Minor') {
      sources.push({ Label: `${status.Name} (Minor)`, Value: -1, Kind: 'Status' });
    } else {
      statusPenaltyDisplay = { Status: status, Penalty: penalty };
    }
  }

  for (const extra of extras.ExtraModifiers ?? []) {
    sources.push(extra);
  }

  const uncapped = sources.reduce((sum, source) => sum + source.Value, 0);
  const cap = library.settings.HeroRollModifierCap ?? 3;
  const total = Math.max(-cap, Math.min(cap, uncapped));
  const capped = total !== uncapped;

  if (capped) {
    sources.push({ Label: `Hero Roll cap (±${cap})`, Value: total - uncapped, Kind: 'Cap' });
  }

  return {
    VirtueId: virtueId,
    VirtueName: virtue?.Name ?? virtueId,
    Sources: sources,
    Total: total,
    Uncapped: uncapped,
    Capped: capped,
    StatusPenalty: statusPenaltyDisplay,
    Advantage: compareBoonsAndBanes(extras.BoonsSelected ?? 0, extras.BanesSelected ?? 0),
  };
}

// ---------- Conditions as Banes (V0.6 revision) ----------

/** "Each Condition you mark gives you an associated Bane that applies to any relevant rolls" (V0.6
 *  revision, "Mark a Condition"). Returns one candidate per marked Condition on the sheet — the
 *  Virtue it sits on and the Condition's library name, which is the Bane's name — in the library's
 *  Virtue order. Whether each is *relevant* to a given roll is the table's call; the roll builder
 *  offers them as Banes to tick (pre-ticking the rolled Virtue's own, a UI default). */
export function conditionBaneCandidates(sheet: CharacterSheet, library: Library): { VirtueId: string; ConditionName: string }[] {
  const result: { VirtueId: string; ConditionName: string }[] = [];

  for (const virtue of library.virtues) {
    const sheetVirtue = sheet.Virtues.find((v) => v.VirtueId === virtue.Id);
    if (sheetVirtue?.ConditionMarked) {
      const condition = library.conditions.find((c) => c.VirtueId === virtue.Id);
      if (condition) {
        result.push({ VirtueId: virtue.Id, ConditionName: condition.Name });
      }
    }
  }

  return result;
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
/** Resist is a Hero Roll with a fixed reduction (V0.6 revision, "Resistance"): "10+: Reduce
 *  incoming Strain by 2. 7–9: Reduce it by 1. 6-, take the full effect. The GM gains a
 *  Drama." The Virtue rolled no longer sets the amount. (Drama itself is slice 2's.) */
export function resistReduction(tier: RollTier): number {
  switch (tier) {
    case 'Tier3':
      return 2;
    case 'Tier2':
      return 1;
    case 'Tier1':
      return 0;
  }
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
// A box row (ruleset V0.5, carried into V0.6 for the Strain track and an enemy's Strain row —
// see `enemies.ts`) is a sparse row of marked boxes. These three helpers
// are the only places that know how a row works; everything else routes through them.

/** Default box count for a fresh row — matches `GameSettings.StrainTrackLength` (5). An enemy's
 *  row (`enemies.ts`) passes its own box count explicitly rather than relying on this. */
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
 *  already marked (the row is saturated — the caller decides what that means, e.g. Dying for
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

/** Whether marking `amount` more Strain would find nowhere to go — no box at or above `amount`
 *  is still empty. V0.6: "If there is no higher available Strain box, and you can't take a
 *  Status that would mitigate the incoming Strain to 0, your Hero is Subdued" (V0.7: Dying). This predicts
 *  that first half ahead of actually mutating the row, so the caller can decide whether to run
 *  Subdued instead of silently no-op'ing (`markRank` itself just returns the row unchanged when
 *  saturated). */
export function strainExhausted(current: boolean[], amount: number, boxes: number = DEFAULT_STRAIN_BOXES): boolean {
  if (amount <= 0) return false;
  const start = Math.max(1, Math.min(amount, boxes));
  for (let i = start - 1; i < boxes; i += 1) if (!current[i]) return false;
  return true;
}

// ---------- Temporary Strain, one-box-per-hit, and what a Hero can still absorb (V0.7 slice 7) ----------

/** The outcome of one Strain hit landing on a Hero (`takeStrainHit`). */
export interface StrainHitResult {
  Strain: boolean[];
  TempStrain: number;
  /** A Temporary Strain box took the hit (so no regular box was marked). */
  UsedTemp: boolean;
  /** Nothing could take it: no Temporary box, and no regular box at or above the amount. The
   *  caller decides what that means: for a Hero it is the moment they become Dying (slice 8a,
   *  `CharacterSheet.Dying`). */
  Exhausted: boolean;
}

/** One Strain hit, after Resist / Status / Armor have already reduced it. V0.7: "You only check off
 *  one Strain box per action taken against you" (L513) and Temporary Strain boxes "are always marked
 *  first when taking Strain. Once a Temporary Strain box has been checked, it disappears"
 *  (L541-543). So a hit with Strain left over spends exactly one Temporary box if there is one,
 *  whatever its size, since a Temporary box has no value; otherwise it marks a regular box by
 *  `markStrain`'s rule. A hit already reduced to 0 touches nothing. Pure.
 *
 *  Judgment call (`docs/decisions.md` item 70): V0.7 does not say whether a Temporary box absorbs the
 *  whole hit or only 1 of it; "one box per action" plus "a buffer" is read as the whole hit. */
export function takeStrainHit(strain: boolean[], tempStrain: number, amount: number, boxes: number = DEFAULT_STRAIN_BOXES): StrainHitResult {
  if (amount <= 0) return { Strain: strain, TempStrain: tempStrain, UsedTemp: false, Exhausted: false };
  if (tempStrain > 0) return { Strain: strain, TempStrain: tempStrain - 1, UsedTemp: true, Exhausted: false };
  const exhausted = strainExhausted(strain, amount, boxes);
  return { Strain: exhausted ? strain : markStrain(strain, amount, boxes), TempStrain: tempStrain, UsedTemp: false, Exhausted: exhausted };
}

/** Strain absorbed by several Status slots taken at once: "You can use more than one Status slot if
 *  available" (L531). Each Status negates its own fixed amount (2/4/6) and the amounts add. */
export function statusesAbsorb(severities: StatusSeverity[]): number {
  return severities.reduce((n, s) => n + statusAbsorb(s), 0);
}

/** How many more Statuses of each severity a holder has room for. */
export function freeStatusSlots(statuses: CharacterStatus[], slotCaps: Record<StatusSeverity, number>): Record<StatusSeverity, number> {
  const counts = statusSeverityCounts(statuses);
  return {
    Minor: Math.max(0, slotCaps.Minor - counts.Minor),
    Major: Math.max(0, slotCaps.Major - counts.Major),
    Severe: Math.max(0, slotCaps.Severe - counts.Severe),
  };
}

/** Whether taking `picks` all at once fits the open slots (each severity at most its free count). */
export function statusPicksFit(picks: StatusSeverity[], free: Record<StatusSeverity, number>): boolean {
  const need: Record<StatusSeverity, number> = { Minor: 0, Major: 0, Severe: 0 };
  for (const p of picks) need[p] += 1;
  return need.Minor <= free.Minor && need.Major <= free.Major && need.Severe <= free.Severe;
}

/** What a Hero can still take before nothing is left to absorb a hit: the shape slice 8 (Dying)
 *  builds on. */
export interface StrainCapacity {
  /** Temporary Strain boxes still open. */
  TempBoxes: number;
  /** Regular Strain boxes still open. */
  FreeBoxes: number;
  /** The 1-based number of the highest open regular box, 0 if none. A hit of N lands on box N or the
   *  next open box to its right, so this is the biggest hit the track alone can take (when below the
   *  top box; a hit past the top box marks the top box). */
  HighestFreeBox: number;
  /** Strain the open Status slots could absorb together (2/4/6 each). */
  StatusAbsorb: number;
  /** The largest single hit, after any Resist roll or Armor, that can be taken without leaving
   *  nothing to absorb it: `Infinity` when a Temporary box is open or the top regular box is free
   *  (either takes a hit of any size), otherwise the highest open box plus what open Status slots
   *  absorb. */
  MaxSingleHit: number;
}

/** "How much Strain can this Hero still absorb?" Strain boxes + Temporary Strain + open Status
 *  slots (V0.7 slice 7). Pure; takes only the three sheet fields it reads. It deliberately leaves
 *  out the two reductions that need a roll or a tag at the table (a Resist roll's 1-2, and Armor), so
 *  it answers the guaranteed floor. Slice 8's Dying test is `!canAbsorbStrain(...)` for the hit in
 *  question: V0.7 L517 "If there is no higher available Strain box, and you can't take a Status that
 *  would mitigate the incoming Strain to 0, your Hero is Dying". */
export function remainingStrainCapacity(
  sheet: { Strain: boolean[]; TempStrain?: number; Statuses: CharacterStatus[] },
  slotCaps: Record<StatusSeverity, number>,
  boxes: number = DEFAULT_STRAIN_BOXES,
): StrainCapacity {
  let highest = 0;
  let free = 0;
  for (let i = 0; i < boxes; i += 1) {
    if (!sheet.Strain[i]) {
      free += 1;
      highest = i + 1;
    }
  }
  const slots = freeStatusSlots(sheet.Statuses, slotCaps);
  const statusAbsorbTotal = slots.Minor * statusAbsorb('Minor') + slots.Major * statusAbsorb('Major') + slots.Severe * statusAbsorb('Severe');
  const temp = Math.max(0, sheet.TempStrain ?? 0);
  return {
    TempBoxes: temp,
    FreeBoxes: free,
    HighestFreeBox: highest,
    StatusAbsorb: statusAbsorbTotal,
    MaxSingleHit: temp > 0 || highest === boxes ? Infinity : highest + statusAbsorbTotal,
  };
}

/** Whether one hit of `amount` (already reduced by any Resist roll or Armor) can be taken without
 *  leaving the Hero nothing to absorb it. A hit of 0 always can. */
export function canAbsorbStrain(
  sheet: { Strain: boolean[]; TempStrain?: number; Statuses: CharacterStatus[] },
  amount: number,
  slotCaps: Record<StatusSeverity, number>,
  boxes: number = DEFAULT_STRAIN_BOXES,
): boolean {
  if (amount <= 0) return true;
  return amount <= remainingStrainCapacity(sheet, slotCaps, boxes).MaxSingleHit;
}

// ---------- Armor types (V0.7 slice 7) ----------

/** Armor and Heavy Armor each cost 1 Load (V0.7 L552-553); Special Armor's Load varies with the
 *  ability that grants it, so it keeps the granting item's own `LoadCost`. */
export const ARMOR_LOAD_COST = 1;

/** The Load an item that grants Armor of `key` costs. `itemLoadCost` is the item's own stored cost,
 *  used as-is for Special. */
export function armorLoadCost(key: ArmorKey, storedLoadCost: number): number {
  return key === 'Special' ? storedLoadCost : ARMOR_LOAD_COST;
}

/** The Load an item costs once its Armor type is accounted for: `item.LoadCost` unless it grants
 *  Physical or Heavy Armor, which is always 1. An unknown `GrantsArmorTypeId` falls back to the
 *  item's own cost. */
export function itemLoadCost(item: Item, armorTypes: ArmorType[]): number {
  if (!item.GrantsArmorTypeId) return item.LoadCost;
  const type = armorTypes.find((t) => t.Id === item.GrantsArmorTypeId);
  return type ? armorLoadCost(type.Key, item.LoadCost) : item.LoadCost;
}

/** Whether a ready Armor box may be marked against a given hit. `unsure` is "the app cannot tell":
 *  the GM left the hit untagged, or a Special Armor lists no effects. The table decides, so the UI
 *  allows it with a note rather than blocking it. */
export type ArmorFitResult = 'applies' | 'blocked' | 'unsure';

const normEffect = (e: string) => e.trim().toLowerCase();

/** The Armor rules (V0.7 L552-554) read against the GM's tag on the hit (`StrainTag`):
 *  - **Armor** (`Physical`) "stops all incoming Strain from one source": a Strain offer is one
 *    source, so it always applies and needs no tag.
 *  - **Heavy** stops Strain "on your body": applies when the hit is tagged on the body, is blocked
 *    when tagged otherwise, and is `unsure` when the hit is untagged.
 *  - **Special** stops the effects "noted by the ability that allows you to mark" it: applies when
 *    the hit's `Effect` matches one of the Armor's listed `effects` (case-insensitive, either text
 *    containing the other), is blocked when the hit is tagged and none match, and is `unsure` when the
 *    hit is untagged or the Armor lists no effects. */
export function armorFit(key: ArmorKey, tag: StrainTag | undefined, effects: string[] | undefined): ArmorFitResult {
  if (key === 'Physical') return 'applies';
  if (!tag) return 'unsure';
  if (key === 'Heavy') return tag.OnBody ? 'applies' : 'blocked';
  const listed = (effects ?? []).map(normEffect).filter(Boolean);
  if (listed.length === 0) return 'unsure';
  const e = normEffect(tag.Effect);
  if (!e) return 'blocked';
  return listed.some((l) => l.includes(e) || e.includes(l)) ? 'applies' : 'blocked';
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

// ---------- Dying (V0.7 slice 8a) ----------

/** "A Hero's normal Speed is 6" (the Combat chapter); Dying takes it to 0. */
export const HERO_BASE_SPEED = 6;

/** Whether a Hero is Dying — V0.7 L609-613. Reads the stored flag, which is set when a Strain hit
 *  could not be absorbed (`takeStrainHit`'s `Exhausted`). Replaces V0.6's derived Hero `isSubdued`:
 *  Subdued is now an Enemy-only state (V0.7 L6204). A missing flag (a stale row) reads as not Dying. */
export function isDying(sheet: { Dying?: boolean }): boolean {
  return sheet.Dying === true;
}

/** A Hero's Speed: 0 while Dying ("Your speed is 0", L613) or Immobilized, else the normal 6. */
export function heroSpeed(who: { Dying?: boolean; Immobilized?: boolean }): number {
  return who.Dying || who.Immobilized ? 0 : HERO_BASE_SPEED;
}

/** Whether the Hero may take the Recuperate Move or otherwise recover a Status: not while Dying
 *  ("you can not recover any Statuses, and you can't take the Recuperate Move", L613). */
export function canRecoverStatuses(who: { Dying?: boolean }): boolean {
  return !who.Dying;
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
  sheet: { Strain: boolean[]; Statuses: CharacterStatus[]; HealingTrack: number; Dying?: boolean; StrainBoxBonus?: number },
  removeStatusId: string | null,
  tier: RollTier,
  slotCaps: Record<StatusSeverity, number>,
  settings: { StrainTrackLength: number; HealingTrackLength: number },
  takeStrain: boolean = true,
): { Strain: boolean[]; Statuses: CharacterStatus[]; HealingTrack: number } {
  // V0.7 L613: a Dying Hero can't take Recuperate or recover any Status. The UI disables the action;
  // this keeps a stale client or a second call site from slipping past it.
  if (!canRecoverStatuses(sheet)) return { Strain: sheet.Strain, Statuses: sheet.Statuses, HealingTrack: sheet.HealingTrack };
  const strain = takeStrain ? markStrain(sheet.Strain, 2, settings.StrainTrackLength + Math.max(0, sheet.StrainBoxBonus ?? 0)) : sheet.Strain;
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

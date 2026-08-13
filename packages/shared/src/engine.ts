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
import type { Ability, AbilityEffect, CharacterSheet, CharacterStatus, Library, StatusPolarity } from './types.js';

// ---------- Roll modifier breakdown ----------

export type RollModifierKind = 'Virtue' | 'Condition' | 'Status' | 'Ability';

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

/** A RollBonus Ability effect whose Duration isn't 'Permanent' depends on a fictional trigger
 *  (`TriggerText`) this engine has no way to evaluate on its own — surfaced separately so the
 *  player can decide by hand whether it applies right now, rather than silently guessed at. */
export interface ConditionalRollBonus {
  Label: string;
  Value: number;
  TriggerText: string;
}

function applicableRollBonusEffects(abilities: Ability[], abilityIds: string[], virtueId: string, moveId?: string): AbilityEffect[] {
  const owned = abilities.filter((a) => abilityIds.includes(a.Id));
  const effects: AbilityEffect[] = [];
  for (const a of owned) {
    for (const e of a.Effects) {
      if (e.Kind !== 'RollBonus') continue;
      const targetsVirtue = !e.AppliesToVirtueId || e.AppliesToVirtueId === virtueId;
      const targetsMove = !e.AppliesToMoveId || e.AppliesToMoveId === moveId;
      if (targetsVirtue && targetsMove) effects.push(e);
    }
  }
  return effects;
}

/** "What to roll" for a given Virtue: base score, Condition penalty (floored, same rule as
 *  `effectiveVirtueScore`), and any always-on (`Permanent`) Ability RollBonus — together, `Total`.
 *  The single highest helpful and highest hindering Status (only the highest of each counts — see
 *  the Statuses rule) are computed too, but returned separately as `StatusSources` rather than
 *  folded into `Total`: a Status is a circumstance affecting this roll, not part of what "roll
 *  2d6 + Heart" itself means, and showing it as if it were the named stat's own number is
 *  misleading (confirmed directly with the repo owner, not assumed — an earlier version of this
 *  engine did fold Status into `Total`, which read as if a Status swing *was* the Virtue's
 *  modifier). Pass `moveId` to also pick up move-specific bonuses (e.g. "+2 Ongoing to Sway the
 *  Spirit"). */
export function computeRollBreakdown(sheet: CharacterSheet, virtueId: string, library: Library, moveId?: string): RollBreakdown {
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

  for (const e of applicableRollBonusEffects(library.abilities, sheet.AbilityIds, virtueId, moveId)) {
    if (e.Duration === 'Permanent') {
      sources.push({ Label: `Ability bonus${e.TriggerText ? ` (${e.TriggerText})` : ''}`, Value: e.Value ?? 0, Kind: 'Ability' });
    }
  }

  const statusSources: RollModifierSource[] = [];
  const helpful = [...sheet.Statuses].filter((s) => s.Polarity === 'Positive').sort((a, b) => b.Rank - a.Rank)[0];
  const hindering = [...sheet.Statuses].filter((s) => s.Polarity === 'Negative').sort((a, b) => b.Rank - a.Rank)[0];
  if (helpful) statusSources.push({ Label: `${helpful.Name} (highest helpful Status)`, Value: helpful.Rank, Kind: 'Status' });
  if (hindering) statusSources.push({ Label: `${hindering.Name} (highest hindering Status)`, Value: -hindering.Rank, Kind: 'Status' });

  const abilityExtra = sources.filter((s) => s.Kind === 'Ability').reduce((n, s) => n + s.Value, 0);

  return {
    VirtueId: virtueId,
    VirtueName: virtue?.Name ?? virtueId,
    Sources: sources,
    StatusSources: statusSources,
    Total: flooredVirtue + abilityExtra,
  };
}

/** Ability RollBonus effects that *might* apply but need the player's own judgment call (their
 *  Duration isn't 'Permanent') — shown alongside the breakdown above, not folded into its Total. */
export function conditionalRollBonuses(sheet: CharacterSheet, library: Library, virtueId: string, moveId?: string): ConditionalRollBonus[] {
  return applicableRollBonusEffects(library.abilities, sheet.AbilityIds, virtueId, moveId)
    .filter((e) => e.Duration !== 'Permanent')
    .map((e) => ({ Label: e.AppliesToMoveId ? 'This move' : `${e.Duration} bonus`, Value: e.Value ?? 0, TriggerText: e.TriggerText ?? '' }));
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

// ---------- Status engine ----------

/** Ranks 1-5 are normal; a Negative Status that would reach this Rank is Subdued instead of
 *  simply sitting at "Rank 6" — the doc describes the scale as 1-6 but enforces a functional
 *  cap of 5, with the 6th mark meaning overflow, not a bigger version of the same thing.
 *  Matches `GameSettings.StatusMaxRank` (6) by default. */
export const DEFAULT_SUBDUED_RANK = 6;

export interface StatusApplyResult {
  Statuses: CharacterStatus[];
  /** True when this application pushed a Negative Status to `maxRank` — the caller should run
   *  the Subdued flow (see `resolveSubdued`/`resolveRiskDeath`) rather than just display Rank 6. */
  Subdued: boolean;
}

/** Gives (or increases) a Status by name+polarity. An existing Status with the same Name and
 *  Polarity has its Rank increased by the incoming amount ("mark the next empty box to the
 *  right"); otherwise a new Status is created. Capped at `maxRank` — see `DEFAULT_SUBDUED_RANK`. */
export function giveStatus(
  statuses: CharacterStatus[],
  incoming: { Name: string; Polarity: StatusPolarity; Rank: number },
  maxRank: number = DEFAULT_SUBDUED_RANK,
): StatusApplyResult {
  if (incoming.Rank <= 0) return { Statuses: statuses, Subdued: false };
  const existing = statuses.find((s) => s.Name.toLowerCase() === incoming.Name.toLowerCase() && s.Polarity === incoming.Polarity);
  const rawRank = (existing?.Rank ?? 0) + incoming.Rank;
  const subdued = incoming.Polarity === 'Negative' && rawRank >= maxRank;
  const cappedRank = Math.min(rawRank, maxRank);

  const next = existing
    ? statuses.map((s) => (s.Id === existing.Id ? { ...s, Rank: cappedRank } : s))
    : [...statuses, { Id: newId('st'), Name: incoming.Name, Rank: cappedRank, Polarity: incoming.Polarity, LinkedToIds: [], AffectedByIds: [] }];

  return { Statuses: next, Subdued: subdued };
}

/** Clears Ranks off a single existing Status (healing, a successful Resist Roll's reduction,
 *  etc.) — fully clearing removes the Status entry, matching the sheet's existing Pip behavior. */
export function healStatus(statuses: CharacterStatus[], statusId: string, amount: number): CharacterStatus[] {
  if (amount <= 0) return statuses;
  return statuses
    .map((s) => (s.Id === statusId ? { ...s, Rank: Math.max(0, s.Rank - amount) } : s))
    .filter((s) => s.Rank > 0);
}

/** Opposite Statuses can't coexist — giving one cancels Rank-for-Rank against a Status the
 *  player/GM identifies as its opposite (e.g. Friendly 2 into an existing Hostile 3 leaves
 *  Hostile 1; the reverse leaves Friendly 1; an exact match clears both). There's no authored
 *  "opposite pairs" registry yet (Statuses are free-text — see `StatusesPanel`), so the caller
 *  supplies which existing Status this one opposes rather than it being inferred from the name. */
export function applyOpposingStatus(
  statuses: CharacterStatus[],
  incoming: { Name: string; Polarity: StatusPolarity; Rank: number },
  opposingId: string,
): CharacterStatus[] {
  const opposing = statuses.find((s) => s.Id === opposingId);
  if (!opposing) return giveStatus(statuses, incoming).Statuses;
  const net = opposing.Rank - incoming.Rank;
  const withoutOpposing = statuses.filter((s) => s.Id !== opposingId);
  if (net > 0) return [...withoutOpposing, { ...opposing, Rank: net }];
  if (net < 0) {
    return [...withoutOpposing, { Id: newId('st'), Name: incoming.Name, Rank: -net, Polarity: incoming.Polarity, LinkedToIds: [], AffectedByIds: [] }];
  }
  return withoutOpposing;
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
    if (a.Rank !== b.Rank) return b.Rank - a.Rank;
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

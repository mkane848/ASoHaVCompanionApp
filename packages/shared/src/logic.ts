import type {
  Adventure,
  Bond,
  BondChangeType,
  BondPendingChange,
  Campaign,
  CampaignPhase,
  Character,
  CharacterMotif,
  CharacterSheet,
  CharacterSummary,
  Clock,
  ClockKind,
  Condition,
  Encounter,
  Improvement,
  Invite,
  Item,
  Library,
  LoadTierDef,
  Membership,
  Party,
  World,
} from './types.js';
import { ADVENTURE_COUNTDOWN_STEP_NAMES } from './types.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = 'x'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Capacity = BaseCapacity + Might. Confirmed addition, not multiplication (Issue 2). */
export function loadCapacityFor(tierKey: string, loadTiers: LoadTierDef[], mightScore: number): number {
  const t = loadTiers.find((x) => x.Key === tierKey);
  return t ? t.Base + mightScore : 0;
}

/** Each declared wildcard item (slice 5, `WorkPlan-V0.6.md` A4 item 2) is a flat 1 Load —
 *  there's no catalog `LoadCost` for something invented on the fly, unlike a pre-authored `Item`. */
export function carriedLoad(sheet: CharacterSheet, items: Item[]): number {
  const catalogLoad = sheet.Items.filter((ci) => ci.Carried).reduce((n, ci) => {
    const it = items.find((x) => x.Id === ci.ItemId);
    return n + (it ? it.LoadCost : 0);
  }, 0);
  return catalogLoad + sheet.WildcardDeclarations.length;
}

/** Light/Heavy Loadouts grant a matching Boon/Bane (V0.6's own Load text: "3 Load is Light ...
 *  gain Inconspicuous Boon", "6 Load is Heavy ... gain Conspicuous Bane") — Normal grants neither.
 *  Called from `LoadPanel.tsx`'s tier-switch handler so the two stay in sync deterministically,
 *  rather than left for the player to remember to add/remove by hand. Adds/removes by exact-name
 *  match only, the same "freeform text, no hidden bookkeeping" treatment every other Boon/Bane
 *  gets — a player who's already renamed or duplicated one of these two tags keeps full control
 *  of it afterward, same as any other Boon/Bane on the sheet. This app has no numeric Combat
 *  movement/speed stat (Range is theater-of-the-mind bands — see CLAUDE.md's "Architecture:
 *  Combat" section), so the doc's own "+1 Movement"/"-1 Speed in Combat" clauses in the same
 *  paragraph are deliberately not modeled here; only the Boon/Bane grant is. */
export function applyLoadTierBoonBane(sheet: CharacterSheet, newTier: 'Light' | 'Normal' | 'Heavy'): void {
  sheet.Boons = sheet.Boons.filter((b) => b !== 'Inconspicuous');
  sheet.Banes = sheet.Banes.filter((b) => b !== 'Conspicuous');
  if (newTier === 'Light') sheet.Boons.push('Inconspicuous');
  if (newTier === 'Heavy') sheet.Banes.push('Conspicuous');
}

export function markedConditionCount(sheet: CharacterSheet): number {
  return sheet.Virtues.filter((v) => v.ConditionMarked).length;
}

/** Number of Virtues, and so the number of Conditions a character can have marked at once. */
export const CONDITION_COUNT = 5;

/** Every Condition is marked. This is a legal state, not a consequence — under ruleset V0.5 the
 *  consequence (Crumble) fires on the *next* mark after this, not on reaching it. Named
 *  `isDishonored` before `0.28.0`, when reaching five marks was itself the trigger. */
export function allConditionsMarked(sheet: CharacterSheet): boolean {
  return markedConditionCount(sheet) >= CONDITION_COUNT;
}

/** The single funnel for marking a Condition, and the only place Crumble is decided.
 *
 *  V0.5: "If you need to mark a Condition but all Conditions are already marked, you Crumble.
 *  You lose consciousness, flee, or otherwise must leave the scene. Say how you do this and then
 *  clear one Condition." So Crumble is an *event fired by an attempted mark*, not a state you
 *  reach — which is why this returns a flag rather than the caller checking a predicate.
 *
 *  Mutates `sheet` in place. When it reports `Crumbled: true` nothing was marked, and the caller
 *  owns the rest of the consequence: choosing which Condition to clear (V0.5 leaves that to the
 *  player) and narrating leaving the scene. Combat used to also grant a flat Vulnerable-4 Status
 *  here (`applyCrumbleVulnerable` in `combat.ts`) — V0.6 slice 1 deletes that clause from Crumble
 *  entirely, so the only remaining consequence is the movement restriction, which is a table rule
 *  this app doesn't enforce. */
export function markCondition(sheet: CharacterSheet, virtueId: string): { Crumbled: boolean } {
  // Order matters, and it is not obvious. The all-marked check has to come FIRST: when every
  // Condition is marked there is nowhere to put this one no matter which Virtue was named, so it
  // Crumbles — including when the named Virtue happens to be one of the already-marked ones.
  // Checking "already marked" first would swallow exactly that case and silently do nothing,
  // which is what this did before its own test caught it.
  if (allConditionsMarked(sheet)) return { Crumbled: true };
  const vv = sheet.Virtues.find((v) => v.VirtueId === virtueId);
  // Below five, re-marking a marked Virtue is a plain no-op, not a Crumble — the player could
  // have picked a different one, so nothing is forced.
  if (vv?.ConditionMarked) return { Crumbled: false };
  if (vv) vv.ConditionMarked = true;
  return { Crumbled: false };
}

/** Derived GM live-peek summary — computed from the real sheet, never a second stored copy. */
export function summaryFor(character: Character, sheet: CharacterSheet, library: Library): CharacterSummary {
  const conds: Condition[] = library.conditions;
  const marked = sheet.Virtues.filter((v) => v.ConditionMarked).map((v) => {
    const c = conds.find((x) => x.VirtueId === v.VirtueId);
    return c ? c.Name : v.VirtueId;
  });
  const tier = library.loadTiers.find((t) => t.Key === sheet.Load.Tier);
  const might = sheet.Virtues.find((v) => v.VirtueId === 'v-might')?.Score ?? 0;
  const capacity = tier ? tier.Base + might : 0;
  const carried = carriedLoad(sheet, library.items);
  return {
    Id: character.Id,
    Name: character.Name,
    PlayerName: character.PlayerName,
    Motifs: sheet.Motifs.map((m) => ({ Name: m.Name, Potential: m.Potential })),
    Virtues: sheet.Virtues,
    ConditionsMarked: marked,
    Strain: sheet.Strain,
    Statuses: sheet.Statuses,
    Load: { Tier: sheet.Load.Tier, Carried: carried, Capacity: capacity },
    ArmorReady: sheet.Armor.filter((a) => !a.Used).length,
    ArmorTotal: sheet.Armor.length,
  };
}

// ---------- Motifs ----------

/** A blank Motif slot — used for backfilling a pre-0.29 sheet and for character creation before
 *  the player has filled each of the three slots in. */
export function emptyMotif(): CharacterMotif {
  return { MotifId: null, Name: '', SkillTags: [], FlawTags: [], Potential: 0, Quest: '', ActBreaks: 0, Forsakes: 0 };
}

/** Adds `amount` Potential to one Motif, capped at `cap` (`GameSettings.PotentialTrackLength`, 5).
 *  Mutates `motif` in place; reports whether the track just hit the cap and is ready to advance. */
export function addMotifPotential(motif: CharacterMotif, amount: number, cap: number): { ready: boolean } {
  motif.Potential = Math.min(cap, motif.Potential + amount);
  return { ready: motif.Potential >= cap };
}

/** Rewrites or updates a single Skill or Flaw Tag on a Motif — V0.6's "rewrite or update any one
 *  of your Skill or Flaw Tags" option, offered at Advance a Motif, as a Camp Action, and at End
 *  the Session alike (`WorkPlan-V0.6.md` Section A2, slice 4). `index === null` appends a new tag
 *  instead of replacing an existing one — a Motif with no tags yet in that category has nothing
 *  to rewrite. Mutates `motif` in place. */
export function rewriteMotifTag(motif: CharacterMotif, category: 'Skill' | 'Flaw', index: number | null, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const tags = category === 'Skill' ? motif.SkillTags : motif.FlawTags;
  if (index !== null && index >= 0 && index < tags.length) tags[index] = trimmed;
  else tags.push(trimmed);
}

/** Enjoy Downtime's Pivot (slice 4): "change a Motif as if you had marked your third Forsake" —
 *  the practical outcome of that (per this module's own `markForsake()`: three Forsakes abandon
 *  the Quest) is a fresh Quest slate, so this resets tracking straight to that end state and sets
 *  the new Quest text, rather than making the player click through an intermediate abandoned
 *  state this app has no other UI for. Mutates `motif` in place. */
export function pivotMotifQuest(motif: CharacterMotif, newQuest: string): void {
  motif.ActBreaks = 0;
  motif.Forsakes = 0;
  motif.Quest = newQuest.trim();
}

/** No call site outside tests, deliberately — these four are the Quest-progress mechanic
 *  (`WorkPlan-V0.6.md` A2), implemented and tested ahead of the UI that will drive them.
 *  `pivotMotifQuest()` currently reaches the Forsake-3 end state directly; stepping through Act
 *  Breaks and Forsakes one at a time in play is real scope no slice has asked for yet
 *  (CLAUDE.md, slice 4's "Deliberately not built"). Kept, not dead. */
/** Marks one Act Break toward the Motif's Quest (0..3). Three completes the Quest. */
export function markActBreak(motif: CharacterMotif): { questComplete: boolean } {
  if (motif.ActBreaks < 3) motif.ActBreaks += 1;
  return { questComplete: motif.ActBreaks >= 3 };
}

/** Marks one Forsake on the Motif's Quest (0..3). Three abandons the Quest. */
export function markForsake(motif: CharacterMotif): { questAbandoned: boolean } {
  if (motif.Forsakes < 3) motif.Forsakes += 1;
  return { questAbandoned: motif.Forsakes >= 3 };
}

export function questComplete(motif: CharacterMotif): boolean {
  return motif.ActBreaks >= 3;
}

export function questAbandoned(motif: CharacterMotif): boolean {
  return motif.Forsakes >= 3;
}

// ---------- Quest completion and abandonment (V0.6 revision, slice 3) ----------

/** Anything that carries a Quest with three Act Breaks and three Forsakes: a Hero's `CharacterMotif`
 *  today, and the Party's own Quest in slice 4 (`WorkPlan-V0.6-Revision.md` A2.5) — so the two
 *  procedures below are written once. `Name` is the Motif's title. The progress each procedure
 *  awards (Potential for a Hero, Rapport for the Party) is returned for the caller to apply, since
 *  the two tracks live in different places. */
export interface QuestHolder {
  Name: string;
  SkillTags: string[];
  FlawTags: string[];
  Quest: string;
  ActBreaks: number;
  Forsakes: number;
}

/** "When you complete all the Act Breaks in a Quest, the Quest is complete. Then you may choose any
 *  number of the following to do" (Ruleset-V0.6.md, "Hero Motif Advancement — Quests"). Every field
 *  is optional because every option is. `FillProgress` is "mark Potential on that Quest's Motif
 *  until you have 5, then instantly Advance/Level Up that Motif (no need to wait for the next
 *  Camp)". `NewQuest` is "revise or write a new Quest", which starts a fresh Act Break / Forsake
 *  slate. */
export interface QuestCompletionChoices {
  FillProgress?: boolean;
  NewName?: string;
  SkillTags?: string[];
  FlawTags?: string[];
  NewQuest?: string;
}

/** "When you mark your third Forsake in a Quest, the Quest has been abandoned. Then do all of" —
 *  retitle, remove every tag, write one new Skill and one new Flaw Tag, write a new Quest, and add
 *  progress equal to the Act Breaks plus Forsakes. All four fields are required because all four
 *  steps are. */
export interface QuestAbandonInput {
  NewName: string;
  SkillTag: string;
  FlawTag: string;
  NewQuest: string;
}

/** Applies the completion choices to a holder whose Quest is complete (three Act Breaks). Throws if
 *  the Quest isn't complete. Returns whether the caller should fill the progress track to its cap
 *  and advance immediately. Mutates `holder` in place. */
export function completeQuest(holder: QuestHolder, choices: QuestCompletionChoices): { fillProgress: boolean } {
  if (holder.ActBreaks < 3) {
    throw new Error('This Quest is not complete yet.');
  }
  if (choices.NewName !== undefined) {
    const trimmed = choices.NewName.trim();
    if (trimmed) holder.Name = trimmed;
  }
  if (choices.SkillTags !== undefined) {
    holder.SkillTags = choices.SkillTags.map((t) => t.trim()).filter(Boolean);
  }
  if (choices.FlawTags !== undefined) {
    holder.FlawTags = choices.FlawTags.map((t) => t.trim()).filter(Boolean);
  }
  if (choices.NewQuest !== undefined) {
    const trimmed = choices.NewQuest.trim();
    if (trimmed) {
      holder.Quest = trimmed;
      holder.ActBreaks = 0;
      holder.Forsakes = 0;
    }
  }
  return { fillProgress: choices.FillProgress === true };
}

/** Applies the abandonment procedure to a holder whose Quest has three Forsakes. Throws if it
 *  hasn't. Returns how much progress (Potential or Rapport) the caller must add — "Add Potential
 *  equal to the total number of Forsakes and Act Breaks to the new Motif, taking a Motif Advance if
 *  you mark 5 Potential". Mutates `holder` in place. */
export function abandonQuest(holder: QuestHolder, input: QuestAbandonInput): { progressToAdd: number } {
  if (holder.Forsakes < 3) {
    throw new Error('This Quest has not been abandoned.');
  }
  const skillTrimmed = input.SkillTag.trim();
  const flawTrimmed = input.FlawTag.trim();
  const questTrimmed = input.NewQuest.trim();
  const nameTrimmed = input.NewName.trim();
  if (!skillTrimmed || !flawTrimmed || !questTrimmed || !nameTrimmed) {
    throw new Error('Abandoning a Quest needs a new name, one Skill Tag, one Flaw Tag and a new Quest.');
  }
  const progressToAdd = holder.ActBreaks + holder.Forsakes;
  holder.Name = nameTrimmed;
  holder.SkillTags = [skillTrimmed];
  holder.FlawTags = [flawTrimmed];
  holder.Quest = questTrimmed;
  holder.ActBreaks = 0;
  holder.Forsakes = 0;
  return { progressToAdd };
}

// ---------- Starting Hero Improvements (V0.6 revision, slice 3) ----------

/** "Choose two Hero Improvements. You can only get a Starting Improvement on any Improvement Tree
 *  first. Then, for your second Improvement, you may choose a second Starting Improvement or an
 *  Improvement connected by a line to another Improvement you already have on that same tree. Each
 *  can only be chosen once." (Ruleset-V0.6.md, "Choose Hero Improvements"). Returns `null` when
 *  `ids` is a legal starting pair, otherwise a player-facing reason. Order-insensitive: the pair is
 *  legal if at least one is a Starting Improvement and the other is either Starting too or is
 *  unlocked by it (`improvementState`). */
export function validateStartingImprovements(ids: readonly string[], improvements: readonly Improvement[]): string | null {
  if (ids.length !== 2) return 'Choose exactly two Hero Improvements.';
  if (ids[0] === ids[1]) return 'Each Hero Improvement can only be chosen once.';
  const imp0 = improvements.find((i) => i.Id === ids[0]);
  const imp1 = improvements.find((i) => i.Id === ids[1]);
  if (!imp0 || !imp1) return 'One or more Hero Improvements are not recognized.';

  // Try each arrangement: one as "first", one as "second"
  // First arrangement: imp0 first, imp1 second
  if (imp0.IsStarting) {
    const state = improvementState(imp1, new Set([ids[0]]));
    if (state === 'available') return null;
  }
  // Second arrangement: imp1 first, imp0 second
  if (imp1.IsStarting) {
    const state = improvementState(imp0, new Set([ids[1]]));
    if (state === 'available') return null;
  }

  return 'This is not a legal starting pair.';
}

/** What a full Motif Potential track can be spent on — `GainImprovement` opens the Improvement
 *  Tree picker (slice 4; see `improvementState` below). */
export const MOTIF_ADVANCE_OPTIONS = ['AddSkillTag', 'AddFlawTag', 'RemoveFlawTag', 'GainImprovement'] as const;
export type MotifAdvanceOption = (typeof MOTIF_ADVANCE_OPTIONS)[number];

/** Clears a full Motif Potential track and returns the advance options now on offer. The caller
 *  applies whichever the player chooses; this only handles the "at 5, clear and choose" gate. */
export function takeMotifAdvance(motif: CharacterMotif): MotifAdvanceOption[] {
  motif.Potential = 0;
  return [...MOTIF_ADVANCE_OPTIONS];
}

// ---------- Improvements (slice 4) ----------

export type ImprovementAvailability = 'held' | 'available' | 'locked';

/** DAG gate for one Improvement, per Ruleset-V0.5.md's own rule (lines 458/489): a Starting
 *  Improvement is always available; any other Improvement is available once at least one of its
 *  same-tree `PrerequisiteIds` is already held. No Tier or Level gate — see `Improvement`'s doc
 *  comment in `types.ts` for why. `heldIds` is the holder's own taken-Improvement Ids (a
 *  character's `Improvements`, or the party's `RapportImprovementsTaken`). */
export function improvementState(imp: Improvement, heldIds: ReadonlySet<string>): ImprovementAvailability {
  if (heldIds.has(imp.Id)) return 'held';
  if (imp.IsStarting) return 'available';
  return imp.PrerequisiteIds.some((id) => heldIds.has(id)) ? 'available' : 'locked';
}

/** What a full Rapport track can be spent on, per Ruleset-V0.5.md's "Party Advancement —
 *  Rapport" (slice 7 gives Party a Motif to hold the tags — see `Party`'s doc comment). A third
 *  option the doc also names, "Gain a Party Improvement", stays unavailable: the doc's own "Party
 *  Motif + Improvements" section names no trees at all (unlike Hero's 25) — see `Improvement`'s
 *  doc comment. */
export const PARTY_ADVANCE_OPTIONS = ['AddSkillTag', 'AddWeaknessTag', 'RemoveWeaknessTag'] as const;
export type PartyAdvanceOption = (typeof PARTY_ADVANCE_OPTIONS)[number];

/** Clears a full Rapport track, raises `PartyLevel` by one, and applies one of the two real
 *  Skill/Weakness Tag options above — the party-level analog of `takeMotifAdvance`. `tag` is the
 *  new tag's text for `AddSkillTag`/`AddWeaknessTag`; `RemoveWeaknessTag` pops the most recently
 *  added Weakness Tag (same convention `MotifPanel`'s `RemoveFlawTag` uses) and ignores `tag`.
 *
 *  `cap` (`GameSettings.RapportTrackLength`) is subtracted, not reset to 0 — V0.6 slice 7's own
 *  Rapport-overflow rule (`WorkPlan-V0.6.md` Section A4 item 1): a banked overflow beyond the cap
 *  survives an advance and can fund another one in the same sitting if what's left is still at or
 *  above `cap` (the caller's own "Rapport full" trigger re-checks after this runs, so a second
 *  advance just needs the player to tap it again — no loop needed here). Mutates `party` in
 *  place. */
export function applyPartyRapportAdvance(party: Party, option: PartyAdvanceOption, cap: number, tag?: string): void {
  party.Rapport = Math.max(0, party.Rapport - cap);
  party.PartyLevel = (party.PartyLevel ?? 0) + 1;
  const trimmed = tag?.trim();
  let effect = 'Party Level increased.';
  if (option === 'AddSkillTag' && trimmed) {
    party.SkillTags.push(trimmed);
    effect = `Skill Tag: ${trimmed}`;
  } else if (option === 'AddWeaknessTag' && trimmed) {
    party.WeaknessTags.push(trimmed);
    effect = `Weakness Tag: ${trimmed}`;
  } else if (option === 'RemoveWeaknessTag') {
    const removed = party.WeaknessTags.pop();
    effect = removed ? `Removed Weakness Tag: ${removed}` : 'No Weakness Tag to remove.';
  }
  party.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'took', Name: 'Progress the Party', Effect: effect });
}

/** V0.6 slice 7 (`WorkPlan-V0.6.md` Section A4 item 1): spending Rapport (Aid) before the party
 *  reaches Camp forfeits any banked overflow and resolves the spend from the normal cap instead —
 *  the meeting's own worked example: a party at 10/5 that spends 1 before Camp drops to 4/5, not
 *  9/5. Below the cap this is just an ordinary floored subtraction, same as before this slice. */
export function spendRapportForAid(party: Party, cost: number, cap: number): void {
  const capped = Math.min(party.Rapport, cap);
  party.Rapport = Math.max(0, capped - cost);
}

/** How many Camp Actions each player may take at Make Camp (Ruleset-V0.5.md: "each player can
 *  take as many Camp Actions as Party Level + 1"). */
export function campActionsAllowed(partyLevel: number): number {
  return (partyLevel ?? 0) + 1;
}

/** V0.6's own "Spending Bond" list, verbatim (Slice 7, `WorkPlan-V0.6.md` Section C: "The Bond
 *  spend menu's five explicit options"). `SpendBond` already applies immediately with no handshake
 *  (`applySpendBond`) and its propose route already accepts a freeform `note` — this is that note,
 *  offered as a picker instead of the single hardcoded "I need this from you." both Bond UIs used
 *  before this slice, so a teammate reading Bond History sees which of the five a spend was for.
 *  The last option's "Rank 2 Status" is the doc's own pre-Strain wording (see CLAUDE.md's
 *  "Architecture: Combat" for why the Combat chapter was never rewritten for severity slots) —
 *  mapped here to "a Minor Status", the closest severity-slot equivalent, the same kind of
 *  documented B1-style reading this app already gives every other stale "Rank N" reference. */
export const BOND_SPEND_OPTIONS = [
  'Get +1 to your roll against them, or an action you take that they see and oppose.',
  'Give -1 to their roll against you, or an action they take that you see and oppose.',
  'Offer them an experience point to do what you want.',
  'Add an extra harm (1-for-1) to whatever harm you’re dealing them.',
  'Mark a Condition on them, or give them a Minor Status.',
] as const;

// ---------- Bond handshake ----------

export class BondHandshakeError extends Error {}

export function assertCanPropose(bond: Bond) {
  if (bond.PendingChange) {
    throw new BondHandshakeError('That Bond already has a change awaiting confirmation.');
  }
}

/** How many of `bonds` have a change awaiting `myCharacterId`'s own confirmation — proposed by
 * the other party on a Bond this character is part of. Backs the pending-confirmation badge
 * wherever it appears (Campaign Shell, the sheet's Kin & Bonds section). */
export function pendingBondCountFor(bonds: Bond[], myCharacterId: string): number {
  return bonds.filter(
    (b) =>
      (b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId) &&
      b.PendingChange &&
      b.PendingChange.ProposedBy !== myCharacterId,
  ).length;
}

export function buildProposal(proposerCharId: string, type: BondChangeType, payload: BondPendingChange['Payload'], note?: string): BondPendingChange {
  return {
    Id: newId('pc'),
    ProposedBy: proposerCharId,
    Type: type,
    Payload: payload || {},
    Note: note || '',
    ProposedAt: nowIso(),
  };
}

/** The Bond cap. `GameSettings.BondTrackLength` is admin-editable and seeds to 5; every Bond
 *  function below hardcoded a literal 5 until 0.50.0, so raising the setting rendered more pips
 *  (`AdvancementPanel` reads `count={bondLen}`) than the logic would ever fill. One number governs
 *  both the track and the Level because the ruleset uses one — whether 5 is even right is
 *  `WorkPlan-V0.6.md` Section D item 22, still open, which is exactly why it belongs in a setting
 *  rather than in the code. The default keeps every existing call site behaving identically. */
export const DEFAULT_BOND_CAP = 5;

/** V0.5: "When you place your 5th Bond at Bond 5, your Bond Level locks and can not be moved
 *  down. You can no longer spend Bond on that track." A maxed Bond (Level and Bond Track both at
 *  `cap`) is locked — no stored field needed, it's fully derived from the two numbers already on
 *  `Bond`. This rule is unchanged from the pre-V0.5 ruleset; only its vocabulary moved from Kin
 *  to Bond. */
export function isBondLocked(bond: Bond, cap = DEFAULT_BOND_CAP): boolean {
  return bond.BondLevel >= cap && bond.BondTrack >= cap;
}

/** Spending Bond is unilateral — either partner may do it without the other's approval (the
 * game's rules text says "either PC on the Bond Track can spend Bond", unlike Forging, which
 * needs both to agree), so it applies immediately rather than going through the propose/accept
 * handshake. Mutates `bond` in place; returns a short detail string for the log. Throws
 * `BondHandshakeError` if the Bond is locked (see `isBondLocked`) rather than silently dropping
 * it back below Level 5. */
export function applySpendBond(bond: Bond, delta = 1, cap = DEFAULT_BOND_CAP): string {
  if (isBondLocked(bond, cap)) {
    throw new BondHandshakeError(`This Bond is locked at Level ${cap} with a full Bond Track — Bond can no longer be spent on it.`);
  }
  bond.BondTrack = bond.BondTrack - delta;
  if (bond.BondTrack < 0) {
    bond.BondLevel = Math.max(0, bond.BondLevel - 1);
    bond.BondTrack = cap - 1;
  }
  return 'Bond now ' + bond.BondTrack;
}

/** Mutates `bond` in place per the accepted proposal's type. Returns a short detail string for the log. */
export function resolveAcceptedBond(bond: Bond, cap = DEFAULT_BOND_CAP): string {
  const p = bond.PendingChange;
  if (!p) return '';
  let detail = '';
  if (p.Type === 'MarkBond') {
    bond.BondTrack = Math.min(cap, bond.BondTrack + (p.Payload.Delta || 1));
    detail = 'Bond now ' + bond.BondTrack;
  } else if (p.Type === 'SpendBond') {
    // No longer reachable via the normal UI (SpendBond applies immediately — see
    // applySpendBond above) — kept so a proposal created before that change can still resolve.
    detail = applySpendBond(bond, p.Payload.Delta || 1, cap);
  } else if (p.Type === 'ForgeBond') {
    bond.BondLevel = Math.min(cap, bond.BondLevel + 1);
    bond.BondTrack = 0;
    bond.BondMoves = (bond.BondMoves || []).concat([{ Level: bond.BondLevel, Text: p.Payload.Text || '', AuthoredAt: nowIso() }]);
    detail = 'Bond Level ' + bond.BondLevel;
  }
  bond.PendingChange = null;
  bond.UpdatedAt = nowIso();
  return detail;
}

// ---------- Character creation ----------

/** The game's five canonical starting Virtue arrays, confirmed directly with the repo owner — a
 * new character picks one, then assigns its five values across the five Virtues however they
 * like, rather than free-allocating points. (seedPlay.ts's premade characters predate this list
 * and use an older single array retired below; that's fine, since this multiset is only ever
 * checked at character-creation time — see isStandardVirtueArray's one call site in
 * apps/server/src/routes/characters.ts.) */
export const STANDARD_VIRTUE_ARRAYS: readonly (readonly number[])[] = [
  [2, 1, 1, 0, -1],
  [2, 2, 1, -1, -1],
  [2, 1, 0, 0, 0],
  [1, 1, 1, 1, -1],
  [1, 1, 1, 0, 0],
] as const;

function matchesMultiset(scores: number[], candidate: readonly number[]): boolean {
  if (scores.length !== candidate.length) return false;
  const remaining: number[] = [...candidate];
  for (const s of scores) {
    const i = remaining.indexOf(s);
    if (i === -1) return false;
    remaining.splice(i, 1);
  }
  return true;
}

export function isStandardVirtueArray(scores: number[]): boolean {
  return STANDARD_VIRTUE_ARRAYS.some((candidate) => matchesMultiset(scores, candidate));
}

// ---------- Invite redemption ----------

export class InviteError extends Error {}

function normalizedEmail(e: string): string {
  return e.trim().toLowerCase();
}

// ---------- Campaign archive freeze ----------

/** `status` is read by index.ts's error-handling middleware (`err?.status || 500`), so a route
 *  can simply call `assertCampaignActive(campaign)` and let the throw become a clean 409 on its
 *  own. That matters because there is no RLS or middleware layer that would catch a *missing*
 *  call — and it was in fact missed five times before 0.50.0 (combat /end, invite revoke, phase,
 *  ready, invite decline). The older, more verbose `try { … } catch (err) { if (err instanceof
 *  CampaignArchivedError) … }` form at ~16 existing call sites still works identically and is
 *  left alone; new routes should prefer the bare call. */
export class CampaignArchivedError extends Error {
  readonly status = 409;
}

// ---------- Misfortune (revised V0.6, slice 2) ----------

/** The four ways Misfortune changes (Ruleset-V0.6.md, "Misfortune"). `Gain` is +1 — every 6-, open
 *  to any member since any Hero can roll one. `Spend` is −1, the GM paying for a Hard Move or an
 *  enemy's cost. `Reset` sets it to 1, what concluding an Adventure does. `BeginSession` is "At the
 *  beginning of a Session, the GM gains 1 Misfortune if they have none": 0 becomes 1, anything
 *  higher is left alone. The app has no session concept, so that GM control is the implementation
 *  (`WorkPlan-V0.6-Revision.md` D item 18). */
export const MISFORTUNE_ACTIONS = ['Gain', 'Spend', 'Reset', 'BeginSession'] as const;
export type MisfortuneAction = (typeof MISFORTUNE_ACTIONS)[number];

/** Spending with none left. A real conflict with the stored state, not a bad request, hence 409 —
 *  `index.ts`'s `errorMiddleware` reads `status`, so a route can let it propagate. */
export class NoMisfortuneError extends Error {
  readonly status = 409;
  constructor() {
    super('The GM has no Misfortune to spend.');
  }
}

/** Applies one Misfortune change to `party` in place, floored at 0, and records it in
 *  `party.History` (Action `'noted'`, Name `Misfortune`, Effect describing the change and `note`,
 *  `By` = `by`) — every change leaves a trace, since it's a GM resource on a shared document.
 *  Throws `NoMisfortuneError` when spending at 0. Returns whether the value changed
 *  (`BeginSession` with Misfortune already above 0 changes nothing and records nothing). */
export function applyMisfortune(party: Party, action: MisfortuneAction, note: string, by: string | null): boolean {
  throw new Error('not implemented: WP-2B');
}

/** Every mutating route that touches a campaign's play state (invites, Bond propose/accept/
 * reject, sheet edits, party edits, character creation) calls this after loading the campaign.
 * Archiving is a GM action, not an admin one — see routes/campaign.ts's PATCH /:id/status. */
export function assertCampaignActive(campaign: Campaign) {
  if (campaign.Status === 'Archived') {
    throw new CampaignArchivedError('This campaign is archived. Unarchive it before making changes.');
  }
}

/** Shared precondition for both redeeming and declining an invite: it must still be Pending,
 * and it must be addressed to the acting user's own email (case-insensitively) — a code alone
 * isn't enough to join, since invites are per-recipient. Throws InviteError to abort. */
export function assertInviteActionable(invite: Invite, userEmail: string) {
  if (invite.Status !== 'Pending') {
    throw new InviteError(`This invite has already been ${invite.Status.toLowerCase()}.`);
  }
  if (normalizedEmail(invite.Email) !== normalizedEmail(userEmail)) {
    throw new InviteError('This invite was sent to a different email address.');
  }
}

// ---------- Campaign setup workflow (Signup -> PartyCreation -> Playing) ----------

/** Treat a campaign with no `Phase` set as `'PartyCreation'` — matches the DB migration's
 *  backfill default for rows that predate this field, so an already-running campaign keeps
 *  letting a newly-invited player create a character rather than being retroactively locked out. */
export function campaignPhase(campaign: Campaign): CampaignPhase {
  return campaign.Phase ?? 'PartyCreation';
}

/** 409 via index.ts's error middleware — see CampaignArchivedError's note. */
export class PartyCreationRequiredError extends Error {
  readonly status = 409;
}

/** Character creation (the multi-field chargen flow) only opens once the GM has closed signup
 *  and moved the campaign into the Party Creation phase — called from routes/characters.ts. */
export function assertPartyCreationPhase(campaign: Campaign) {
  if (campaignPhase(campaign) !== 'PartyCreation') {
    throw new PartyCreationRequiredError('Character creation is only open during the Party Creation phase.');
  }
}

/** 409 via index.ts's error middleware — see CampaignArchivedError's note. */
export class PlayingRequiredError extends Error {
  readonly status = 409;
}

/** Combat can't happen before the campaign is actually Playing — called from
 *  routes/combat.ts's POST /start (0.38.0 item 7). `PUT /:encounterId` and `POST
 *  /:encounterId/end` need no equivalent gate: `CAMPAIGN_PHASE_TRANSITIONS.Playing` is `[]`, so a
 *  campaign can never leave Playing once it's there, and with /start gated an Encounter can
 *  therefore only ever exist in a Playing campaign. */
export function assertPlayingPhase(campaign: Campaign) {
  if (campaignPhase(campaign) !== 'Playing') {
    throw new PlayingRequiredError('Combat can only start once the campaign is in the Playing phase.');
  }
}

/** Forward-only except PartyCreation can step back to Signup (the GM reopening signup after
 *  closing it early) — Playing is terminal for this control; archiving is a separate mechanism. */
export const CAMPAIGN_PHASE_TRANSITIONS: Record<CampaignPhase, CampaignPhase[]> = {
  Signup: ['PartyCreation'],
  PartyCreation: ['Signup', 'Playing'],
  Playing: [],
};

/** 409 via index.ts's error middleware — see CampaignArchivedError's note. */
export class InvalidPhaseTransitionError extends Error {
  readonly status = 409;
}

export function assertValidPhaseTransition(from: CampaignPhase, to: CampaignPhase) {
  if (!CAMPAIGN_PHASE_TRANSITIONS[from].includes(to)) {
    throw new InvalidPhaseTransitionError(`Cannot move a campaign from ${from} to ${to}.`);
  }
}

/** How many Player memberships (GMs don't have characters, so aren't counted) have marked
 *  themselves ready — backs the GM's "N / M ready" readout during Party Creation. */
export function partyReadiness(members: Membership[]): { ready: number; total: number } {
  const players = members.filter((m) => m.Role === 'Player');
  return { ready: players.filter((m) => m.Ready).length, total: players.length };
}

/** V0.6 slice 1's own valid severities — a legacy pre-migration Status entry has no `Severity`
 *  at all (it has `Marks`/`Polarity` instead), so this doubles as the filter that drops them. */
const VALID_STATUS_SEVERITIES = new Set(['Minor', 'Major', 'Severe']);

/** `Recoveries`/`Scars` were added to `CharacterSheet` in `0.13.0` with no backfill — a sheet
 *  saved before then is JSONB missing both keys entirely, which crashes any unguarded
 *  `sheet.Scars.length`/`.map()` read. Called from `repo.ts#getSheet` so every sheet read anywhere
 *  in the server (and by extension every client) sees a fully-populated shape, the same
 *  self-heal-on-read pattern `campaign.ts`'s bootstrap route already uses for a missing `Party`.
 *
 *  V0.6 slice 1 retires `Recoveries` and adds `Strain`/`HealingTrack`/`Boons`/`Banes` — all
 *  default per `WorkPlan-V0.6.md` Section B2's own guidance: a missing `HealingTrack` backfills
 *  to 0, not full, the mirror image of the old `Recoveries` trap (backfilling full would have
 *  under-healed nobody; backfilling a full Healing Track would falsely downgrade an old sheet's
 *  Statuses the moment `downgradeStatuses` next ran against it). There is no honest translation
 *  from a ranked pre-migration Status (`Marks`/`Polarity`) to a severity slot — B2's own "clean
 *  break" decision — so a legacy `Statuses` entry is dropped on read rather than guessed at.
 *
 *  `WildcardDeclarations` (slice 5) backfills to `[]` the same way every other new list field on
 *  this interface has — a sheet saved before it existed has no such key. */
export function normalizeSheet(sheet: CharacterSheet, strainBoxes = 5): CharacterSheet {
  return {
    ...sheet,
    Motifs: Array.isArray(sheet.Motifs) && sheet.Motifs.length === 3 ? sheet.Motifs : [emptyMotif(), emptyMotif(), emptyMotif()],
    Strain: Array.isArray(sheet.Strain) ? sheet.Strain : Array.from({ length: strainBoxes }, () => false),
    Statuses: Array.isArray(sheet.Statuses) ? sheet.Statuses.filter((s) => VALID_STATUS_SEVERITIES.has((s as { Severity?: string }).Severity ?? '')) : [],
    HealingTrack: sheet.HealingTrack ?? 0,
    Boons: sheet.Boons ?? [],
    Banes: sheet.Banes ?? [],
    WildcardDeclarations: sheet.WildcardDeclarations ?? [],
    Scars: sheet.Scars ?? [],
    Wealth: sheet.Wealth ?? 0,
    Treasure: sheet.Treasure ?? 0,
    Hold: sheet.Hold ?? 0,
    Improvements: sheet.Improvements ?? [],
  };
}

/** Same self-heal-on-read pattern as `normalizeSheet`, for the `Party` row — added slice 4 for
 *  `PartyLevel`/`RapportImprovementsTaken` (renamed from `RapportAdvancementsTaken`, so an old
 *  row's stale key needs dropping as well as the new ones backfilling). Called from
 *  `repo.ts#getParty`. */
export function normalizeParty(party: Party): Party {
  const legacy = party as unknown as { RapportAdvancementsTaken?: unknown };
  return {
    ...party,
    RapportImprovementsTaken: party.RapportImprovementsTaken ?? (Array.isArray(legacy.RapportAdvancementsTaken) ? (legacy.RapportAdvancementsTaken as Party['RapportImprovementsTaken']) : []),
    PartyLevel: party.PartyLevel ?? 0,
    // Revised V0.6 slice 2 — "at the beginning of a Session… the GM gains 1", so a row saved
    // before Misfortune existed starts with one, not zero.
    Misfortune: party.Misfortune ?? 1,
    // slice 7 (0.34.0) — Party identity fields, backfilled for a row saved before they existed.
    Motif: party.Motif ?? '',
    Quest: party.Quest ?? '',
    SkillTags: party.SkillTags ?? [],
    WeaknessTags: party.WeaknessTags ?? [],
    Path: party.Path ?? '',
    Goal: party.Goal ?? '',
    CampAssets: party.CampAssets ?? [],
  };
}

/** Same self-heal-on-read pattern as `normalizeSheet`, applied to the `Library` singleton — a
 *  gap CLAUDE.md already called out as the general rule ("extend `normalizeSheet()` or add its
 *  equivalent") but never actually did for `Library`. `glossary` (`0.9.0`) and `enemies`
 *  (`0.14.0`) default to `[]`; `improvementTrees`/`improvements` (slice 4) do the same for a
 *  library seeded before those collections existed. The remaining `GameSettings` fields default
 *  to the same values a fresh project is seeded with. Unlike a missing sheet field, a missing
 *  settings field doesn't crash — it silently breaks real gameplay math instead (new characters
 *  getting 0 Recoveries, the server-side Skill-count cap never triggering), which is worse: no
 *  error ever points back to the cause. Called from `repo.ts#getLibrary`. Preserves object
 *  identity when nothing needed backfilling, so callers can cheaply detect "did this need a
 *  write-back" the same way `getSheet` does for `Recoveries`/`Scars`. */
export function normalizeLibrary(library: Library): Library {
  const settings = library.settings;
  const settingsIncomplete =
    settings == null ||
    settings.StrainTrackLength == null ||
    settings.HealingTrackLength == null ||
    settings.MinorStatusSlots == null ||
    settings.MajorStatusSlots == null ||
    settings.SevereStatusSlots == null ||
    settings.BondTrackLength == null ||
    settings.GlossaryAutoLink == null ||
    settings.HeroRollModifierCap == null;
  return {
    ...library,
    glossary: library.glossary ?? [],
    enemies: library.enemies ?? [],
    improvementTrees: library.improvementTrees ?? [],
    improvements: library.improvements ?? [],
    campAssets: library.campAssets ?? [],
    villains: library.villains ?? [],
    npcs: library.npcs ?? [],
    locations: library.locations ?? [],
    settings: settingsIncomplete
      ? {
          ...settings,
          StrainTrackLength: settings?.StrainTrackLength ?? 5,
          HealingTrackLength: settings?.HealingTrackLength ?? 5,
          MinorStatusSlots: settings?.MinorStatusSlots ?? 3,
          MajorStatusSlots: settings?.MajorStatusSlots ?? 2,
          SevereStatusSlots: settings?.SevereStatusSlots ?? 1,
          BondTrackLength: settings?.BondTrackLength ?? 5,
          GlossaryAutoLink: settings?.GlossaryAutoLink ?? true,
          HeroRollModifierCap: settings?.HeroRollModifierCap ?? 3,
        }
      : settings,
  };
}

/** V0.6 slice 6 (`0.47.0`) renamed/split `ClockKind`: `'Basic'` → `'Opposition'` (a pure rename,
 *  same mechanic — translated forward, not dropped) and `'Countdown'` → `'Threat'`/`'Project'` (a
 *  genuine one-to-two split with no way to reconstruct which a given legacy Clock was meant to be,
 *  so this defaults every legacy `'Countdown'` to `'Threat'`, the closer semantic match, rather
 *  than guessing per-clock or discarding data). `Goal`/`SkillTags`/`Developments`/`PromotedToBoard`
 *  backfill to their empty defaults the same self-heal-on-read way every other new field on a
 *  JSONB-blob type does. `UnlocksClockId` (Linked Clocks, deleted this slice) is simply not carried
 *  forward — there's no concept left for it to attach to. Called from `repo.ts#listClocksForCampaign`. */
const LEGACY_CLOCK_KIND_MAP: Record<string, ClockKind> = { Basic: 'Opposition', Countdown: 'Threat' };

export function normalizeClock(clock: Clock): Clock {
  const legacy = LEGACY_CLOCK_KIND_MAP[clock.Kind as string];
  return {
    ...clock,
    Kind: legacy ?? clock.Kind,
    Goal: clock.Goal ?? '',
    SkillTags: clock.SkillTags ?? [],
    Developments: clock.Developments ?? [],
    PromotedToBoard: clock.PromotedToBoard ?? false,
  };
}

/** V0.6 slice 8 ("Creating the World"). One `World` row per campaign, the same shape `Party`
 *  already establishes — `Id` follows `Party`'s own `pt-${campaignId}` convention (a stable,
 *  derivable id rather than a random one, so a second create-if-missing call can't accidentally
 *  mint a duplicate row for the same campaign). Called from both `campaign.ts`'s campaign-creation
 *  route and its bootstrap route's self-heal path — a real, shared function rather than the two
 *  independent inline object literals `Party` has had ever since `0.7.0` (see `campaign.ts`'s own
 *  `Party` literals for that precedent, not one worth repeating for a type created fresh here). */
export function newWorld(campaignId: string): World {
  return {
    Id: `wd-${campaignId}`,
    CampaignId: campaignId,
    Concept: '',
    Aim: '',
    Tone: '',
    SubjectMatter: '',
    StartingPlace: {
      Name: '',
      Details: [],
      FamousFor: '',
      InfamousFor: '',
      ResourceSituation: '',
      ResourceConsequence: '',
      NotableOrganization: '',
      NearestNeighbor: '',
      NeighborRelationship: '',
      Rumors: [],
    },
    Regions: [],
    PlacesOfInterest: [],
    PersonalPlaces: [],
    Connectors: [],
    Rumors: [],
    UpdatedAt: nowIso(),
    UpdatedBy: null,
  };
}

/** Same self-heal-on-read pattern as `normalizeParty`/`normalizeClock` — a brand-new type with no
 *  legacy rows to translate, but any future field addition still needs a read-time default rather
 *  than trusting the TypeScript type alone (`WorkPlan-V0.6.md` Section B2's own standing warning).
 *  Called from `repo.ts#getWorld`. */
export function normalizeWorld(world: World): World {
  return {
    ...world,
    StartingPlace: world.StartingPlace ?? newWorld(world.CampaignId).StartingPlace,
    Regions: world.Regions ?? [],
    PlacesOfInterest: world.PlacesOfInterest ?? [],
    PersonalPlaces: world.PersonalPlaces ?? [],
    Connectors: world.Connectors ?? [],
    Rumors: world.Rumors ?? [],
  };
}

/* The three JSONB aggregates below had no read-time normalize at all until 0.50.0, despite each
   having gained required fields after rows were already live. CLAUDE.md's own rule — "adding a new
   required field to a JSONB-blob type needs a read-time default, not just a type change" — was
   written after the `Recoveries`/`Scars` crash-on-render bug and then not applied here. The
   TypeScript types claim these fields are always present; a row written before the field existed
   deserializes them as `undefined`, and an unguarded `.length`/`.map()` on one throws at render.
   Called from repo.ts on every read, same as their four siblings above. */

/** `BondMoves`/`History`/`PendingChange` predate nothing, but `BondMoveEntry.AuthoredAt` was added
 *  after Bonds shipped, and a Bond row is written by `withBondLock`'s transaction rather than
 *  through a normalizing read — so a legacy entry keeps whatever it has and only the containers
 *  are guaranteed. */
export function normalizeBond(bond: Bond): Bond {
  return {
    ...bond,
    BondTrack: bond.BondTrack ?? 0,
    BondLevel: bond.BondLevel ?? 0,
    BondMoves: bond.BondMoves ?? [],
    PendingChange: bond.PendingChange ?? null,
    History: bond.History ?? [],
  };
}

/** Slice 1 renamed `PendingStatusOffers` to `PendingStrainOffers` and slice 3 added
 *  `CombatGoalAchieved`; slice 5 of the V0.5 migration added `ActingParticipantId`/
 *  `PairedParticipantId`. An Encounter saved before any of those reads back missing them, and
 *  `EncounterView.tsx` maps over `PendingStrainOffers` unguarded. The rename is a clean break, not
 *  a translation — a pre-slice-1 offer named a Status and a Rank, which have no honest Strain
 *  equivalent (`WorkPlan-V0.6.md` Section B2), so it is dropped rather than guessed at. */
export function normalizeEncounter(encounter: Encounter): Encounter {
  return {
    ...encounter,
    CombatGoal: encounter.CombatGoal ?? '',
    CombatGoalAchieved: encounter.CombatGoalAchieved ?? false,
    DefiantGoals: encounter.DefiantGoals ?? [],
    Round: encounter.Round ?? 1,
    ActingSide: encounter.ActingSide ?? null,
    ActingParticipantId: encounter.ActingParticipantId ?? null,
    PairedParticipantId: encounter.PairedParticipantId ?? null,
    Participants: encounter.Participants ?? [],
    PendingStrainOffers: encounter.PendingStrainOffers ?? [],
    History: encounter.History ?? [],
  };
}

/** `NpcIds`/`LocationIds`/`Secrets`/`CountdownSteps` were all added after the `adventures` table
 *  was created. `CountdownSteps` backfills to the five canonical step names rather than `[]`, since
 *  an empty array would make `tickAdventureCountdown()`'s clamp ceiling 0 and silently freeze the
 *  Countdown at zero — the same class of asymmetric-default trap `HealingTrack` documents. */
export function normalizeAdventure(adventure: Adventure): Adventure {
  return {
    ...adventure,
    Concept: adventure.Concept ?? '',
    Type: adventure.Type ?? null,
    Hook: adventure.Hook ?? '',
    VillainId: adventure.VillainId ?? null,
    NpcIds: adventure.NpcIds ?? [],
    LocationIds: adventure.LocationIds ?? [],
    Secrets: adventure.Secrets ?? [],
    CountdownSteps: adventure.CountdownSteps ?? ADVENTURE_COUNTDOWN_STEP_NAMES.map((Name) => ({ Name, Text: '' })),
    CountdownMarks: adventure.CountdownMarks ?? 0,
    Status: adventure.Status ?? 'Active',
  };
}

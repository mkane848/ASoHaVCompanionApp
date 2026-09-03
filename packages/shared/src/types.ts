/**
 * ASoHaV reconciled data model.
 * Source of truth: Planning Docs handoff README + Character Sheet Plan (§2-4) + design/_shared/*.js.
 * These shapes ARE the wire contract — the JSON a client sends/receives and the eventual
 * GM-tooling import format. Keep them stable; add fields rather than renaming.
 */

// ---------- Content Library (authored in the admin panel, read-only to players) ----------

export interface Virtue {
  Id: string;
  Name: string;
  Tagline: string;
  Essence: string;
  UsageHelperText: string;
}

export type VirtueKey = 'v-might' | 'v-mettle' | 'v-heart' | 'v-wit' | 'v-guile';

export interface Condition {
  Id: string;
  Name: string;
  VirtueId: string;
  RollPenalty: number; // default -2
  ClearAction: string;
}

export type ArmorKey = 'Physical' | 'Heavy' | 'Special';

export interface ArmorType {
  Id: string;
  Name: string;
  Key: ArmorKey;
  Description: string;
}

export interface Item {
  Id: string;
  Name: string;
  Description: string;
  LoadCost: 0 | 1 | 2;
  Charges?: number;
  GrantsArmorTypeId?: string | null;
}

/** A Motif is the core aspect of a Hero — one of three per character, replacing the single Theme
 *  of the pre-V0.5 ruleset. Each Motif is a bucket for that Hero's Skill Tags, Flaw Tags, its own
 *  Potential track, and a Quest. Players choose from the 13 canonical Motifs (or write their own)
 *  and may rename any of them to fit their character's flavor. */
export interface Motif {
  Id: string;
  Name: string;
  Description: string;
  SkillTagExamples: string[];
  FlawTagExamples: string[];
}

/** V0.5's authored Hero Improvements: 11 Combat + 14 Narrative trees (Ruleset-V0.5.md, "Hero
 *  Improvements"). `library.improvementTrees` names and themes them; `library.improvements`
 *  holds their actual nodes. Party and Bond get an "Improvement" mention too (the doc's own
 *  "Party Motif + Improvements"/"Bond Track + Improvements" headers), but neither names any
 *  trees at all — both sections read "Here that is!" with nothing under them — so this slice
 *  only builds the Hero side; see HANDOFF.md open issue 12 for the gap. */
export type ImprovementCategory = 'Combat' | 'Narrative';

export interface ImprovementTree {
  Id: string;
  Name: string;
  Category: ImprovementCategory;
  Description: string;
}

/** One node on an Improvement Tree, replacing the flat Tier-gated `Advancement` list (slice 4).
 *  Gating is DAG-only, per Ruleset-V0.5.md's own current rule (lines 458/489): take a Starting
 *  Improvement on any tree, or one connected to an Improvement you already hold on that same
 *  tree; each takeable once. The doc's separate "Level Up"/"Progress the Party" section names a
 *  Tier-1..4-and-Level gate instead — read as leftover text from an earlier, unreconciled draft
 *  (it pastes the old flat-list gate onto the newer tree model, and nowhere else in the doc
 *  assigns a Tier to a tree node) and deliberately not implemented; confirmed with the repo
 *  owner rather than guessed — see HANDOFF.md open issue 12. `PrerequisiteIds` only ever names
 *  other Improvements on the same `TreeId`; nothing here validates that at the type level, but
 *  `apps/server/src/adminLogic.ts`'s `validateLibrary` does. */
export interface Improvement {
  Id: string;
  TreeId: string;
  Name: string;
  Effect: string;
  IsStarting: boolean;
  PrerequisiteIds: string[];
}

export interface MoveResult {
  Description: string;
  Options: string[];
  ChooseCount: number;
}

export interface MoveResults {
  Tier3: MoveResult; // 10+
  Tier2: MoveResult; // 7-9
  Tier1: MoveResult; // miss
}

export type MoveKind = 'Basic' | 'Adventure';

export interface Move {
  Id: string;
  Name: string;
  Kind: MoveKind;
  VirtueId: string | null;
  Description: string;
  Results: MoveResults;
  PlayerVariantResults?: MoveResults | null;
  /** Hold this Move grants directly on a reported roll tier (V0.5 slice 3) — e.g. Assess the
   *  Situation grants 3 on a 10+. Only the two Moves whose Hold grant is a literal number carry
   *  this; every other Move's Tier results stay freeform reference text with no mechanical hook.
   *  Missing/omitted for a tier means that tier grants no Hold. See `holdGrantForTier()`
   *  (`engine.ts`) for how this is applied once a player reports which tier they hit. */
  HoldGrant?: Partial<Record<'Tier3' | 'Tier2' | 'Tier1', number>>;
  /** How this Move can trigger Advantage (V0.5 slice 3) — the two named triggers this app can
   *  actually detect. 'wealthSpend': spending 1 Wealth grants Advantage on this roll (Follow a
   *  Lead). 'selfReport': a self-reported checkbox (e.g. "I have a written record") grants
   *  Advantage (Consult the Past). Every other Move keeps the informational-only tooltip — V0.5's
   *  third named trigger (Venture Forth without Scouting Ahead) has no roll UI to attach to yet,
   *  since Undertake a Journey ships as reference text this slice (slice 7 builds its flow). */
  AdvantageTrigger?: 'wealthSpend' | 'selfReport';
}

/** A rules term or phrase whose definition should be reachable as an inline tap-link anywhere it
 *  appears in authored text (move/skill/ability descriptions, etc.) — see `glossary.ts`'s
 *  `buildGlossaryMatcher`/`linkifyText`. Deliberately its own collection rather than borrowing
 *  `Description`-shaped fields off existing entities: general mechanics referenced in prose
 *  ("Condition", "Bond", "Hold") often have no single matching entity — `conditions` holds five
 *  specific per-Virtue Conditions, not the mechanic itself. `Name` doubles as the canonical
 *  matched phrase; `Aliases` covers other forms (plurals, "Mark Bond" vs "Bond") that should link
 *  to the same definition without duplicating it. */
export interface GlossaryTerm {
  Id: string;
  Name: string;
  Aliases: string[];
  Definition: string;
}

export interface GameSettings {
  Id: string;
  PotentialTrackLength: number;
  RapportTrackLength: number;
  BondTrackLength: number;
  StatusMaxRank: number;
  ConditionFloor: number;
  /** How many Recoveries a character starts with (and refills to at Make Camp) — spent 1-for-1
   *  to heal a Status (see `healStatus` in `engine.ts`). The doc's own draft wavers between 6
   *  and 8; kept configurable rather than guessed at. */
  RecoveriesMax: number;
  /** Library-wide kill switch for the regex auto-linker in `glossary.ts` (0.24.0). Defaults
   *  `true` so existing authored text keeps linking exactly as it does today. A field with at
   *  least one explicit `[Term]` tag always disables auto-linking for that one field regardless
   *  of this setting; this flag is for retiring the regex matcher library-wide once content has
   *  fully migrated to explicit tags. */
  GlossaryAutoLink: boolean;
}

export interface LoadTierDef {
  Key: 'Light' | 'Normal' | 'Heavy';
  Base: number;
  Note: string;
}

/** How much a Toughness tier blunts an incoming Status Rank in Combat — see
 *  `applyToughness()` in `combat.ts`. 'None' is the default for a rank-and-file enemy. */
export type ToughnessTier = 'None' | 'Medium' | 'Heavy';

export interface EnemyStatusLimit {
  StatusName: string;
  Limit: number;
}

/** A reusable enemy stat block, authored in Content Admin — spawned into a live Encounter as a
 *  `CombatParticipant` (which carries its own copy of Toughness/StatusLimits/Statuses, so a
 *  spawned enemy can be tweaked per-fight without touching the template). Ad-hoc, un-saved
 *  enemies skip this collection entirely and are built directly as a `CombatParticipant`. */
export interface EnemyTemplate {
  Id: string;
  Name: string;
  Description: string;
  IsBoss: boolean;
  Toughness: ToughnessTier;
  StatusLimits: EnemyStatusLimit[];
  /** Boss-only (slice 5): "Boss Enemies have a set number of Gambits they can use (pulling from
   *  the same list of Gambits as the Heroes)" — a plain resource count, not simulated Gambit
   *  content. Undefined/0 for an ordinary enemy. Carried onto the spawned `CombatParticipant` by
   *  `newParticipant()` so it can be decremented per-fight without touching the template. */
  GambitCharges?: number;
}

export interface Library {
  virtues: Virtue[];
  conditions: Condition[];
  armorTypes: ArmorType[];
  items: Item[];
  motifs: Motif[];
  improvementTrees: ImprovementTree[];
  improvements: Improvement[];
  moves: Move[];
  glossary: GlossaryTerm[];
  enemies: EnemyTemplate[];
  settings: GameSettings;
  loadTiers: LoadTierDef[];
}

export type LibraryCollectionKey =
  | 'virtues'
  | 'conditions'
  | 'armorTypes'
  | 'items'
  | 'motifs'
  | 'improvementTrees'
  | 'improvements'
  | 'moves'
  | 'glossary'
  | 'enemies';

// ---------- Play state (per campaign) ----------

export type MembershipRole = 'GM' | 'Player';

export type CampaignStatus = 'Active' | 'Archived';

/** Lifecycle stage for the campaign-setup workflow, orthogonal to `Status` (which is purely the
 *  GM's archive/freeze toggle). `Signup`: open for invites, players may accept and join, nobody
 *  has a character yet. `PartyCreation`: the GM has closed signup; players fill out character
 *  sheets and mark themselves ready. `Playing`: the GM has started the campaign proper. Optional
 *  on the type (rather than required) so existing fixtures/tests that don't care about the
 *  campaign-setup workflow don't need updating — treat a missing value as `'PartyCreation'`
 *  everywhere it's read (matches the DB migration's backfill default for pre-existing rows, since
 *  an already-running campaign should keep letting a newly-invited player create a character
 *  rather than being retroactively locked out). */
export type CampaignPhase = 'Signup' | 'PartyCreation' | 'Playing';

export interface Campaign {
  Id: string;
  Name: string;
  GmUserId: string;
  CreatedAt: string;
  Status: CampaignStatus;
  Phase?: CampaignPhase;
}

export interface PublicUser {
  Id: string;
  Name: string;
}

export interface Membership {
  Id: string;
  UserId: string;
  CampaignId: string;
  Role: MembershipRole;
  CharacterId: string | null;
  /** Player has confirmed their character/setup choices are done during the `PartyCreation`
   *  phase — backs the GM's "N / M ready" readout. Optional for the same reason as `Campaign.Phase`
   *  above; treat a missing value as `false`. Meaningless for a GM membership. */
  Ready?: boolean;
}

export type InviteStatus = 'Pending' | 'Accepted' | 'Declined' | 'Revoked';

export interface Invite {
  Id: string;
  CampaignId: string;
  Email: string;
  Code: string;
  SentAt: string;
  Status: InviteStatus;
}

export interface Character {
  Id: string;
  Name: string;
  PlayerName: string;
  UserId: string;
  CampaignId: string;
}

export interface VirtueValue {
  VirtueId: string;
  Score: number; // -2..3
  ConditionMarked: boolean;
}

export type StatusPolarity = 'Positive' | 'Negative' | 'Neutral';

/** A Status is a row of marked boxes, not a magnitude (changed in `0.28.0` for ruleset V0.5).
 *
 *  `Marks[i]` is box `i + 1`. The Status's **Rank is the highest marked box** — read it with
 *  `statusRank()` from `engine.ts`, never by counting marks, because the row is deliberately
 *  sparse: gaining Rank N marks box N *or the next empty box to its right* if N is already
 *  marked, so `[_, X, _, X, _]` is Rank 4, not Rank 2. Reducing clears marks from the highest
 *  box down.
 *
 *  The row is `GameSettings.StatusMaxRank` boxes long (6). Boxes 1-5 are the normal range;
 *  box 6 is the Subdued overflow, not simply a bigger version of Rank 5. */
export interface CharacterStatus {
  Id: string;
  Name: string;
  Marks: boolean[];
  Polarity: StatusPolarity;
  LinkedToIds: string[];
  AffectedByIds: string[];
}

export interface CharacterArmor {
  Id: string;
  ArmorTypeId: string;
  Used: boolean;
  SourceId: string;
  SourceLabel: string;
}

export interface CharacterLoad {
  Tier: 'Light' | 'Normal' | 'Heavy';
  LatchedUntilCamp: boolean;
}

export interface CharacterItem {
  ItemId: string;
  Carried: boolean;
  ChargesUsed: number;
}

/** A held Improvement, recorded wherever it was taken from (a character's own `Improvements`, or
 *  `Party.RapportImprovementsTaken`) — renamed from `TakenAdvancement` (slice 4); no `Tier` field
 *  any more, since gating dropped Tiers entirely in favor of the DAG. */
export interface TakenImprovement {
  Id: string;
  Name: string;
  Effect: string;
  TakenAt: string;
}

export interface AdvancementHistoryEntry {
  Id: string;
  At: string;
  Action: string;
  Name?: string;
  Tier?: number;
  Effect?: string;
  By?: string;
  Note?: string;
}

/** A character's Motifs are fixed at three for life — advancement retitles or rewrites a Motif
 *  but never adds or removes one. `MotifId` is the canonical library Motif this started from
 *  (`null` for a custom one); `Name` is always the player's own wording and may diverge from the
 *  library Name once retitled. `ActBreaks`/`Forsakes` count 0..3, three completing or abandoning
 *  the Quest respectively. */
export interface CharacterMotif {
  MotifId: string | null;
  Name: string;
  SkillTags: string[];
  FlawTags: string[];
  Potential: number;
  Quest: string;
  ActBreaks: 0 | 1 | 2 | 3;
  Forsakes: 0 | 1 | 2 | 3;
}

export interface CharacterAdvancement {
  History: AdvancementHistoryEntry[];
}

/** A near-permanent consequence taken instead of dying at Subdued (see `resolveSubdued` in
 *  `engine.ts`) — free-text by design, since the doc's own examples (lost limb, nightmares,
 *  ostracization, vampirism) are as varied as the Status that caused them. If a character's
 *  Scar count ever exceeds their Playbook Level, the doc says they must retire from the party;
 *  Playbooks aren't built yet (see HANDOFF), so that check isn't enforced anywhere yet. */
export interface Scar {
  Id: string;
  Text: string;
  At: string;
}

export interface CharacterSheet {
  Id: string;
  CharacterId: string;
  Looks: string;
  Virtues: VirtueValue[];
  Statuses: CharacterStatus[];
  Armor: CharacterArmor[];
  /** Always three Motifs — the fixed slots a Hero's identity lives in. */
  Motifs: CharacterMotif[];
  Load: CharacterLoad;
  Items: CharacterItem[];
  Advancement: CharacterAdvancement;
  /** Hero Improvements this character holds, across every tree — the DAG-availability check
   *  (`improvementAvailability` in `logic.ts`) reads this to decide which nodes are unlockable
   *  next. Gained by clearing a Motif's Potential track and choosing "Gain a Hero Improvement"
   *  (`MotifPanel.tsx`); see `Improvement` in `types.ts` for the gating rule (slice 4). */
  Improvements: TakenImprovement[];
  /** A running count of "Level Up" events (V0.5: reduce a full Motif Potential track by clearing
   *  it, for any of the three advance options — not only Gain a Hero Improvement). Gates
   *  nothing — the doc's own Tier-gate text tying this to unlocking Advancement Tiers is the
   *  same leftover, unreconciled draft language `Improvement`'s doc comment explains; kept as a
   *  plain, informational counter per the repo owner's call (HANDOFF.md open issue 12). */
  Level: number;
  /** Current Recovery pool — spend 1 to heal a Status (`healStatus`/`RecoveriesMax` in
   *  GameSettings). Refills to `RecoveriesMax` at Make Camp. */
  Recoveries: number;
  Scars: Scar[];
  /** Personal spendable resources named in the doc (Follow a Lead, Enjoy Downtime, Gear Charges)
   *  — every mention in the doc is a "you"/per-player spend, never a shared party pool like
   *  Rapport, so both live on the character rather than `Party`. `0.17.0` audit found these named
   *  but never modeled; there's no earn mechanic in the doc either, so for now both are just a
   *  freely player/GM-adjusted counter (a `+`/`−` stepper on the sheet) — see HANDOFF.md for the
   *  deferred "should the GM grant these automatically" question. */
  Wealth: number;
  Treasure: number;
  /** End the Session's per-player pool: 1 Hold per personal question that hit, spent 1-for-1 on
   *  refreshing a piece of Gear, clearing a Condition, marking Bond with another party member, or
   *  marking Potential — see `EndSessionModal.tsx`. Persisted (not resolved in one sitting) since
   *  nothing about the doc's wording requires it be spent immediately. */
  Hold: number;
  CreatedAt: string;
  UpdatedAt: string;
}

// ---------- Shared, table-owned state ----------

export interface Party {
  Id: string;
  CampaignId: string;
  Rapport: number; // 0..5
  RapportImprovementsTaken: TakenImprovement[];
  History: AdvancementHistoryEntry[];
  /** Same running counter as `CharacterSheet.Level`, party-scoped ("Progress the Party" clearing
   *  a full Rapport track) — gates nothing, see `CharacterSheet.Level`'s doc comment. */
  PartyLevel: number;
  UpdatedAt: string;
  UpdatedBy: string | null;
}

export interface BondMoveEntry {
  Level: number;
  Text: string;
  AuthoredAt: string;
}

export type BondChangeType = 'MarkBond' | 'SpendBond' | 'ForgeBond';

export interface BondPendingChange {
  Id: string;
  ProposedBy: string; // CharacterId
  Type: BondChangeType;
  Payload: { Delta?: number; Text?: string };
  Note: string;
  ProposedAt: string;
}

export interface BondHistoryEntry {
  Id: string;
  At: string;
  Action: 'proposed' | 'accepted' | 'rejected' | 'withdrawn' | 'spent';
  Type: BondChangeType;
  By: string;
  Note: string;
}

export interface Bond {
  Id: string;
  CampaignId: string;
  CharacterAId: string;
  CharacterBId: string;
  BondTrack: number; // 0..5
  BondLevel: number; // 0..5
  BondMoves: BondMoveEntry[];
  PendingChange: BondPendingChange | null;
  History: BondHistoryEntry[];
  UpdatedAt: string;
}

// ---------- Combat (play state) ----------

/** Theater-of-the-mind range bands, not a grid — see README's architecture notes for why: a
 *  rendered map is real future scope, not this slice. Ordered near to far;
 *  `COMBAT_RANGE_ORDER` is the canonical ordering `shiftRange()` walks in `combat.ts`. */
export type CombatRange = 'Melee' | 'Close' | 'Far' | 'VeryFar' | 'OutOfRange';

export const COMBAT_RANGE_ORDER: CombatRange[] = ['Melee', 'Close', 'Far', 'VeryFar', 'OutOfRange'];

export type CombatParticipantKind = 'PC' | 'Enemy';

/** One combatant in a live Encounter. A PC participant is a thin pointer at a real Character —
 *  its Statuses live on that Character's own `CharacterSheet` (single source of truth, same as
 *  everywhere else in the app), so `Statuses`/`Toughness`/`StatusLimits` here are Enemy-only.
 *  An Enemy participant may be spawned from an `EnemyTemplate` (`RefId` set) or built ad-hoc
 *  (`RefId` empty) — either way it carries its own copy of everything, editable per-fight. */
export interface CombatParticipant {
  Id: string;
  Kind: CombatParticipantKind;
  RefId: string;
  Name: string;
  Range: CombatRange;
  ActionPointsRemaining: number;
  /** Whether this participant has acted this round — set by `endTurn()` (slice 5) as each unit
   *  finishes its own turn, cleared for everyone by `startNewRound()` at a new round boundary.
   *  Drives `nextActor()`'s alternating-sides-with-leftovers suggestion; the GM can always pick a
   *  different participant directly, this is a default, not an enforced order. */
  HasActedThisRound: boolean;
  Toughness?: ToughnessTier;
  StatusLimits?: EnemyStatusLimit[];
  Statuses?: CharacterStatus[];
  Defeated?: boolean;
  /** Boss-only (slice 5) — see `EnemyTemplate.IsBoss`/`GambitCharges`. Carried onto the
   *  participant at spawn so Combat code doesn't need to look the template back up mid-fight. */
  IsBoss?: boolean;
  GambitCharges?: number;
}

/** A minority of the party may declare their own win condition when they disagree with the
 *  group's Combat Goal — achieving it ends Combat on their terms instead. */
export interface DefiantGoal {
  Id: string;
  ParticipantId: string;
  Text: string;
  Achieved: boolean;
}

export type EncounterStatus = 'Active' | 'Ended';

export interface CombatHistoryEntry {
  Id: string;
  At: string;
  Text: string;
}

/** A Status an attack would give a PC, waiting on that PC's own player to apply it. Needed
 *  because a sheet can only ever be written by its own owner (see sheet.ts's PUT
 *  authorization) — an Enemy's attack can't write directly to a PC's CharacterSheet the way it
 *  writes directly to another CombatParticipant's Statuses, so it's offered here instead and
 *  the target applies it themselves (optionally Resisting first) from their own participant
 *  card. Anyone can create one (writing the Encounter); only the target's own player can
 *  fulfill it (writing their own sheet). */
export interface PendingStatusOffer {
  Id: string;
  TargetParticipantId: string;
  StatusName: string;
  Polarity: StatusPolarity;
  Rank: number;
  Note: string;
  /** False for an offer redirected by Interpose — the doc is explicit that interposing means
   *  taking the Status in the ally's place with no Resist Roll of your own. True for every
   *  ordinary offer. */
  Resistable: boolean;
}

export interface Encounter {
  Id: string;
  CampaignId: string;
  Status: EncounterStatus;
  CombatGoal: string;
  DefiantGoals: DefiantGoal[];
  Round: number;
  /** Which side is due to pick next in the "zipper" order — still a shared reference the GM
   *  operates rather than something the app enforces (see CLAUDE.md's Combat architecture note).
   *  `nextActor()` reads this to suggest who logically acts next; `endTurn()` flips it, staying on
   *  the same side once it has no more not-yet-acted units this round (the "leftover units act
   *  consecutively" rule). */
  ActingSide: 'Party' | 'Enemies' | null;
  /** Whose turn it currently is (slice 5) — `null` between turns, while the GM is picking who
   *  acts next. Setting this doesn't recharge anything by itself; `endTurn()` does that when the
   *  acting participant(s) are done. */
  ActingParticipantId: string | null;
  /** The second participant acting alongside `ActingParticipantId`, for "two Heroes may choose to
   *  move together on a Hero turn" (and its enemy-side mirror) — always at most one partner, per
   *  the doc's own wording. `null` when nobody is paired this turn. */
  PairedParticipantId: string | null;
  Participants: CombatParticipant[];
  PendingStatusOffers: PendingStatusOffer[];
  History: CombatHistoryEntry[];
  CreatedAt: string;
  UpdatedAt: string;
}

// ---------- Clocks (V0.5 slice 6) ----------

/** Ruleset-V0.5.md names six Clock variants (Basic, Threat/Quest, Long-Term Project, Progress,
 *  Linked, Mission, Tug-of-War) but only gives one — Basic — a complete mechanic; the rest are
 *  each described only as "a single track a GM ticks 1-3 on their own judgment" (Threat/Quest/
 *  Mission/Progress/Long-Term-Project — the doc even asks itself whether Threat and Quest are the
 *  same thing, without answering) or "a single track that can also go down" (Tug-of-War). Per a
 *  repo-owner decision (README.md's slice-6 judgment-call entry) these collapse to three `Kind`s
 *  rather than six shapes: `'Basic'` is the only one with the Success/Failure/Headway-risk
 *  mechanic; `'Countdown'` covers Threat/Quest/Mission/Progress/Long-Term-Project as one
 *  GM-ticked single track (Threat and Quest treated as one concept, the same "doc contradicts
 *  itself, pick the usable reading" call already made for Bond/Kin/Kith); `'TugOfWar'` is
 *  Countdown's single track but allowed to move down as well as up. Linked Clocks are not a
 *  fourth Kind — see `UnlocksClockId` below. */
export type ClockKind = 'Basic' | 'Countdown' | 'TugOfWar';

export interface ClockHistoryEntry {
  Id: string;
  At: string;
  Text: string;
}

/** A player-facing Clock (Ruleset-V0.5.md's "Clocks" chapter) — a GM-created tracker for an
 *  ongoing effort against an obstacle, independent of Combat (the doc's own examples include
 *  "violent skirmishes that don't require Combat"). Track-and-display, same trust model as
 *  `Encounter`: any campaign member may progress one via the whole-document PUT, and the UI (not
 *  the server) decides which controls a given Kind or role actually shows.
 *
 *  `SuccessMarks` is the Basic Kind's Success track *and* the single track both Countdown and
 *  TugOfWar use — one field name rather than a differently-named field per Kind, since exactly one
 *  of them is ever meaningful for a given Clock. `FailureMarks` only exists for `'Basic'`. */
export interface Clock {
  Id: string;
  CampaignId: string;
  Title: string;
  Kind: ClockKind;
  /** Segments the Clock is divided into — the doc's own guidance is 4 for a basic obstacle,
   *  rising in even numbers for more complex ones. Not enforced as even/>=4 by the type itself
   *  (GM judgment call, same as everything else about a Clock's shape), only by `newClock()`'s
   *  default. */
  Segments: number;
  SuccessMarks: number;
  FailureMarks?: number;
  Status: 'Open' | 'Resolved';
  /** Set once `Status` is `'Resolved'`. Auto-set for `'Basic'` the moment a track fills (see
   *  `clockOutcome()`); for `'Countdown'`/`'TugOfWar'` it's only ever set by the GM's own manual
   *  Resolve action, since the doc gives those Kinds no auto-completion semantics to key off. */
  ResolvedAs?: 'Success' | 'Failure';
  /** The Clock this one's resolution (as `'Success'`) is meant to unlock, per the doc's Linked
   *  Clocks example (overcoming "Defense" unlocks "Vulnerable"). Purely a reference the GM sets
   *  when creating a *dependent* Clock ahead of time — see `isClockLocked()`'s doc comment for why
   *  this deliberately doesn't hide the target Clock until unlocked. */
  UnlocksClockId?: string | null;
  History: ClockHistoryEntry[];
  CreatedAt: string;
  UpdatedAt: string;
}

// ---------- Derived / view models ----------

export interface CharacterSummary {
  Id: string;
  Name: string;
  PlayerName: string;
  Motifs: { Name: string; Potential: number }[];
  Virtues: VirtueValue[];
  ConditionsMarked: string[];
  Statuses: CharacterStatus[];
  Load: { Tier: string; Carried: number; Capacity: number };
  ArmorReady: number;
  ArmorTotal: number;
}

// ---------- Change log (admin panel) ----------

export interface ChangeLogEntry {
  Id: string;
  At: string;
  Who: string;
  Action: 'create' | 'update' | 'delete' | 'import' | 'reset';
  Collection: string;
  ObjectId: string;
  ObjectName: string;
  Before: unknown;
  After: unknown;
}

export interface ValidationIssue {
  collection: string;
  label: string;
  objectId: string;
  objectName: string;
  message: string;
}

export interface ReferencedByRow {
  label: string;
  name: string;
  field: string;
}

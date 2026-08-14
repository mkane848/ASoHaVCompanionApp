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

export interface Theme {
  Id: string;
  Name: string;
  Description: string;
  StartingQuestId: string;
  QuestIds: string[];
}

export interface Quest {
  Id: string;
  Name: string;
  ThemeId: string;
  Description: string;
  StaleAfter?: string | null; // reserved for a future staleness penalty
}

export interface Skill {
  Id: string;
  Name: string;
  Effect: string;
}

/** The three Advancement categories from Planning Docs/Advancements.md: Potential (personal),
 *  Kin (social — scoped to a Bond between two PCs), Rapport (party). Kin has no authored
 *  library content yet — Forging a Bond stays the freeform "write it together" move on
 *  `Bond.BondMoves`, not a pick from a Tier-gated list like Potential/Rapport — but it's a real
 *  Advancement track, not a gap; see README.md#architecture-notes--judgment-calls. */
export type AdvancementTrack = 'Potential' | 'Kin' | 'Rapport';

/** What an Advancement on each track is scoped to — one character, a Bond pair, or the whole
 *  party. Kin's `TakenAdvancement`-equivalent bookkeeping lives on `Bond` (`KinTrack`,
 *  `BondLevel`, `BondMoves`) rather than as picks from `library.advancements`. */
export const ADVANCEMENT_TRACK_SCOPE: Record<AdvancementTrack, 'Character' | 'Bond' | 'Party'> = {
  Potential: 'Character',
  Kin: 'Bond',
  Rapport: 'Party',
};

export interface Advancement {
  Id: string;
  Name: string;
  Track: AdvancementTrack;
  Tier: 1 | 2 | 3 | 4;
  Repeatable: boolean;
  MaxTimes: number | null;
  Effect: string;
}

export type AbilityAcquisition = 'Starting' | 'Advancement' | 'Item' | 'Bond' | 'Other';

export type AbilityEffectKind =
  | 'VirtueBoost'
  | 'RollBonus'
  | 'GrantArmor'
  | 'GrantMove'
  | 'ModifyMove'
  | 'GrantStatus'
  | 'ResourceChange'
  | 'Hold'
  | 'Narrative';

export type EffectDuration = 'Permanent' | 'Ongoing' | 'Forward' | 'Instant' | 'WhileConditionHolds';

export interface AbilityEffect {
  Kind: AbilityEffectKind;
  Duration?: EffectDuration;
  TriggerText?: string;
  // VirtueBoost, RollBonus
  VirtueId?: string;
  Value?: number;
  // RollBonus (optional targeting)
  AppliesToMoveId?: string;
  AppliesToVirtueId?: string;
  // GrantArmor, Hold
  ArmorTypeId?: string;
  Count?: number;
  // GrantMove, ModifyMove
  MoveId?: string;
  ReplacementResults?: MoveResults;
  AddedOptions?: string[];
  // GrantStatus
  StatusName?: string;
  Polarity?: StatusPolarity;
  Rank?: number;
  // ResourceChange
  Resource?: 'Load' | 'Potential' | 'Kin' | 'Rapport' | 'Recovery';
  // Narrative / Hold spend text
  Text?: string;
  SpendText?: string;
  // limited uses
  Uses?: number;
  RechargeOn?: string;
}

export interface Ability {
  Id: string;
  Name: string;
  RulesText: string;
  Acquisition: AbilityAcquisition;
  Tags: string[];
  Effects: AbilityEffect[];
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
}

/** A rules term or phrase whose definition should be reachable as an inline tap-link anywhere it
 *  appears in authored text (move/skill/ability descriptions, etc.) — see `glossary.ts`'s
 *  `buildGlossaryMatcher`/`linkifyText`. Deliberately its own collection rather than borrowing
 *  `Description`-shaped fields off existing entities: general mechanics referenced in prose
 *  ("Condition", "Kin", "Hold") often have no single matching entity — `conditions` holds five
 *  specific per-Virtue Conditions, not the mechanic itself. `Name` doubles as the canonical
 *  matched phrase; `Aliases` covers other forms (plurals, "Mark Kin" vs "Kin") that should link
 *  to the same definition without duplicating it. */
export interface GlossaryTerm {
  Id: string;
  Name: string;
  Aliases: string[];
  Definition: string;
}

export interface GameSettings {
  Id: string;
  AbilitiesAtCreation: number;
  SkillsAtCreation: number;
  PotentialTrackLength: number;
  RapportTrackLength: number;
  KinTrackLength: number;
  StatusMaxRank: number;
  ConditionFloor: number;
  /** Advancement-tier unlock thresholds, by cumulative Advancements taken on a track (Potential
   *  or Rapport — both share the same gating). Defaults 4/7/10 match the historical hardcoded
   *  values in `unlockedTier()`; kept here so Content Admin can retune them during playtesting
   *  without a code change. */
  AdvancementTier2At: number;
  AdvancementTier3At: number;
  AdvancementTier4At: number;
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
}

export interface Library {
  virtues: Virtue[];
  conditions: Condition[];
  armorTypes: ArmorType[];
  items: Item[];
  themes: Theme[];
  quests: Quest[];
  skills: Skill[];
  advancements: Advancement[];
  abilities: Ability[];
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
  | 'themes'
  | 'quests'
  | 'skills'
  | 'advancements'
  | 'abilities'
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

export interface CharacterStatus {
  Id: string;
  Name: string;
  Rank: number; // 1..6, magnitude not a clock
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

export interface AcceptedQuest {
  QuestId: string;
  Completed: boolean;
  AcceptedAt: string;
}

export interface CharacterTheme {
  ThemeId: string;
  AcceptedQuests: AcceptedQuest[];
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

export interface TakenAdvancement {
  Id: string;
  Name: string;
  Tier?: number;
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

export interface CharacterAdvancement {
  Potential: number; // 0..5
  PotentialAdvancementsTaken: TakenAdvancement[];
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
  Theme: CharacterTheme;
  Load: CharacterLoad;
  Items: CharacterItem[];
  AbilityIds: string[];
  SkillIds: string[];
  Advancement: CharacterAdvancement;
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
   *  refreshing a piece of Gear, clearing a Condition, marking Kin with another party member, or
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
  RapportAdvancementsTaken: TakenAdvancement[];
  History: AdvancementHistoryEntry[];
  UpdatedAt: string;
  UpdatedBy: string | null;
}

export interface BondMoveEntry {
  Level: number;
  Text: string;
  AuthoredAt: string;
}

export type BondChangeType = 'MarkKin' | 'SpendKin' | 'ForgeBond';

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
  KinTrack: number; // 0..5
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
  HasActedThisRound: boolean;
  Unstable: boolean;
  Toughness?: ToughnessTier;
  StatusLimits?: EnemyStatusLimit[];
  Statuses?: CharacterStatus[];
  Defeated?: boolean;
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
  /** Whose turn it is to pick a unit in the "zipper" order — a shared reference the GM
   *  operates, not something the app auto-sequences (see CLAUDE.md's Combat architecture note). */
  ActingSide: 'Party' | 'Enemies' | null;
  Participants: CombatParticipant[];
  PendingStatusOffers: PendingStatusOffer[];
  History: CombatHistoryEntry[];
  CreatedAt: string;
  UpdatedAt: string;
}

// ---------- Derived / view models ----------

export interface CharacterSummary {
  Id: string;
  Name: string;
  PlayerName: string;
  Theme: string;
  Virtues: VirtueValue[];
  ConditionsMarked: string[];
  Statuses: CharacterStatus[];
  Load: { Tier: string; Carried: number; Capacity: number };
  Potential: number;
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

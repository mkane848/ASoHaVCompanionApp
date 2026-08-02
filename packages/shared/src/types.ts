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

export type AdvancementTrack = 'Potential' | 'Rapport';

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

export interface GameSettings {
  Id: string;
  AbilitiesAtCreation: number;
  PotentialTrackLength: number;
  RapportTrackLength: number;
  KinTrackLength: number;
  StatusMaxRank: number;
  ConditionFloor: number;
}

export interface LoadTierDef {
  Key: 'Light' | 'Normal' | 'Heavy';
  Base: number;
  Note: string;
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
  | 'moves';

// ---------- Play state (per campaign) ----------

export type MembershipRole = 'GM' | 'Player';

export interface Campaign {
  Id: string;
  Name: string;
  GmUserId: string;
  CreatedAt: string;
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
}

export type InviteStatus = 'Pending' | 'Accepted' | 'Revoked';

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
  Action: 'proposed' | 'accepted' | 'rejected' | 'withdrawn';
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

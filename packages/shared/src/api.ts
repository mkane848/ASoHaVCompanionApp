import type { MisfortuneAction } from './logic.js';
import type { GmContentKind } from './gmContent.js';
import type { Adventure, Bond, Campaign, CampaignPhase, CampaignStatus, Character, CharacterSheet, CharacterSummary, Clock, Encounter, GmContentScope, Invite, Library, Membership, NPC, Party, PublicUser, Villain, World } from './types.js';

// ---------- REST contract ----------

export interface CampaignOverviewMember {
  CharacterId: string;
  CharacterName: string;
  PlayerName: string;
  IsYou: boolean;
}

/** The other character in one of your own character's Bonds, for whichever have any Bond marked.
 * A GM membership has no character, so it simply never has any of these — not a special case. */
export interface CampaignOverviewBond {
  CharacterName: string;
  BondTrack: number;
}

/** Enough to render a home-screen campaign tile without a second round trip per campaign — see
 * `WorkPlan-0.23.0.md` item A. `LastPlayedAt` is derived (the max `UpdatedAt` across that
 * campaign's sheets/party/bonds/encounters), not backed by its own column. */
export interface CampaignOverview {
  GmName: string;
  Roster: CampaignOverviewMember[];
  Rapport: number;
  Bonds: CampaignOverviewBond[];
  LastPlayedAt: string | null;
}

export interface MeResponse {
  user: PublicUser & { Email: string; IsAdmin: boolean };
  memberships: (Membership & { CampaignName: string; CampaignStatus: CampaignStatus; CampaignPhase: CampaignPhase; Overview: CampaignOverview })[];
}

export interface CampaignBootstrap {
  campaign: Campaign;
  membership: Membership;
  members: Membership[];
  users: PublicUser[];
  characters: Character[];
  party: Party;
  bonds: Bond[];
  invites: Invite[]; // empty for players
  mySheet: CharacterSheet | null;
  peekSheets: Record<string, CharacterSheet>; // GM only, CharacterId -> sheet
  peekSummaries: Record<string, CharacterSummary>; // GM only
  encounter: Encounter | null; // the campaign's Active Encounter, if any
  clocks: Clock[]; // every Clock for the campaign, Open and Resolved alike (slice 6)
  adventures: Adventure[]; // every Adventure for the campaign, Active and Concluded alike (slice 9); GM-only content, empty for a Player
  world: World; // shared collaborative world-building content, one per campaign (V0.6 slice 8)
}

// ---------- GM-authored Villains and NPCs (0.67.0) ----------

/** What `GET /gm-content` returns: the caller's own entries plus every site-wide one. Each carries
 *  `Custom` (author and scope), which is what the UI reads to decide whether to offer Edit. */
export interface GmContentList {
  villains: Villain[];
  npcs: NPC[];
}

export interface GmContentCreateRequest {
  kind: GmContentKind;
  scope: GmContentScope;
  /** The Villain or NPC fields, without `Id` or `Custom` — the server assigns the first and
   *  derives the second. */
  data: Record<string, unknown>;
}

/** `POST` (201) and `PUT` (200) `/gm-content` both answer with the saved entry, `Id` and `Custom` set. */
export interface GmContentEntryResponse {
  entry: Villain | NPC;
}

export interface GmContentUpdateRequest {
  scope?: GmContentScope;
  data?: Record<string, unknown>;
}

export interface LibraryResponse {
  library: Library;
}

export interface MyInvite extends Invite {
  CampaignName: string;
}

// ---------- Admin: account & play-state management ----------

export interface AdminUserRow {
  Id: string;
  Email: string;
  Name: string;
  IsAdmin: boolean;
  CreatedAt: string;
  LastSignInAt: string | null;
}

export interface AdminCampaignRow extends Campaign {
  GmName: string;
  MemberCount: number;
}

export interface AdminCharacterRow extends Character {
  CampaignName: string;
}

export interface ChangeLogEntryDTO {
  Id: string;
  At: string;
  Who: string;
  Action: string;
  Collection: string;
  ObjectId: string;
  ObjectName: string;
  Before: unknown;
  After: unknown;
}

export interface ApiError {
  error: string;
}

/** `POST /api/campaigns/:campaignId/party/misfortune` (revised V0.6, slice 2). `Gain` is open to any
 *  member and needs a `Note` saying what earned it (e.g. "A 6- on Take a Risk"); `Spend`, `Reset`
 *  and `BeginSession` are GM-only. Answers `{ party }`, the whole document after the change. */
export interface MisfortuneChangeRequest {
  Action: MisfortuneAction;
  Note?: string;
}


import type { Bond, Campaign, Character, CharacterSheet, CharacterSummary, Invite, Library, Membership, Party, PublicUser } from './types.js';

// ---------- REST contract ----------

export interface MeResponse {
  user: PublicUser & { Email: string; IsAdmin: boolean };
  memberships: (Membership & { CampaignName: string })[];
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
}

export interface LibraryResponse {
  library: Library;
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

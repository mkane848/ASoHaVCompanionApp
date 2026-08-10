import { supabaseAdmin } from './supabase.js';
import { pgPool } from './pgPool.js';
import type {
  AdminUserRow,
  Bond,
  Campaign,
  CampaignPhase,
  CampaignStatus,
  ChangeLogEntry,
  Character,
  CharacterSheet,
  Encounter,
  Invite,
  InviteStatus,
  Library,
  Membership,
  Party,
  PublicUser,
} from '@asohav/shared';
import { newId, normalizeSheet, nowIso } from '@asohav/shared';

// All queries here go through the service-role client, which bypasses RLS entirely —
// authorization (membership checks, GM-only actions, admin-only writes) is enforced by the
// Express route handlers that call these functions, not by Postgres. See the design note at
// the top of supabase/migrations/0001_init.sql.

// ---------- Library (global singleton JSON blob) ----------

export async function getLibrary(): Promise<Library> {
  const { data, error } = await supabaseAdmin.from('library').select('data').eq('id', 'singleton').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Library not seeded');
  return data.data as Library;
}

export async function saveLibrary(lib: Library) {
  const { error } = await supabaseAdmin.from('library').upsert({ id: 'singleton', data: lib, updated_at: nowIso() });
  if (error) throw error;
}

export async function libraryExists(): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('library').select('id').eq('id', 'singleton').maybeSingle();
  if (error) throw error;
  return !!data;
}

// ---------- Changelog ----------

export async function appendChangeLog(entry: Omit<ChangeLogEntry, 'Id' | 'At'>) {
  const id = newId('log');
  const at = nowIso();
  const { error } = await supabaseAdmin.from('changelog').insert({
    id,
    at,
    who: entry.Who,
    action: entry.Action,
    collection: entry.Collection,
    object_id: entry.ObjectId,
    object_name: entry.ObjectName,
    before: entry.Before,
    after: entry.After,
  });
  if (error) throw error;
}

export async function listChangeLog(limit = 200): Promise<ChangeLogEntry[]> {
  const { data, error } = await supabaseAdmin.from('changelog').select('*').order('at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    Id: r.id,
    At: r.at,
    Who: r.who,
    Action: r.action,
    Collection: r.collection,
    ObjectId: r.object_id,
    ObjectName: r.object_name,
    Before: r.before,
    After: r.after,
  }));
}

// ---------- Users (Supabase Auth identity + profiles) ----------

export async function listUsers(): Promise<PublicUser[]> {
  const { data, error } = await supabaseAdmin.from('profiles').select('id, name');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ Id: r.id, Name: r.name }));
}

/** Joins Supabase Auth's identity (email, sign-in history) with `profiles` (display name,
 * content-admin flag) — neither table alone has the full picture the admin panel needs. Not
 * paginated: `auth.admin.listUsers()` defaults to its first page (1000 users), which comfortably
 * covers this app's account volume. */
export async function listAuthUsers(): Promise<AdminUserRow[]> {
  const [{ data: authData, error: authError }, { data: profileRows, error: profileError }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers(),
    supabaseAdmin.from('profiles').select('id, name, is_admin'),
  ]);
  if (authError) throw authError;
  if (profileError) throw profileError;
  const profileById = new Map((profileRows ?? []).map((p: any) => [p.id, p]));
  return authData.users.map((u) => {
    const profile = profileById.get(u.id);
    return {
      Id: u.id,
      Email: u.email ?? '',
      Name: profile?.name ?? u.email ?? u.id,
      IsAdmin: profile?.is_admin ?? false,
      CreatedAt: u.created_at,
      LastSignInAt: u.last_sign_in_at ?? null,
    };
  });
}

/** A recovery magic-link the admin relays to the account holder out of band — there's no
 * outbound email configured for this app (see README's Auth note), so this can't send it
 * itself. Never accepts or sets a password directly; that's the point of using this over
 * `auth.admin.updateUserById({ password })`. Returns null if the user id doesn't exist. */
export async function generatePasswordResetLink(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: data.user.email,
  });
  if (linkError) throw linkError;
  return linkData.properties?.action_link ?? null;
}

// ---------- Campaigns / Memberships / Invites ----------

function mapCampaign(r: any): Campaign {
  return { Id: r.id, Name: r.name, GmUserId: r.gm_user_id, CreatedAt: r.created_at, Status: r.status, Phase: r.phase };
}

export async function insertCampaign(c: Campaign) {
  const { error } = await supabaseAdmin
    .from('campaigns')
    .insert({ id: c.Id, name: c.Name, gm_user_id: c.GmUserId, created_at: c.CreatedAt, status: c.Status, phase: c.Phase ?? 'PartyCreation' });
  if (error) throw error;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await supabaseAdmin.from('campaigns').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapCampaign(data) : null;
}

export async function updateCampaignStatus(id: string, status: CampaignStatus) {
  const { error } = await supabaseAdmin.from('campaigns').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function updateCampaignPhase(id: string, phase: CampaignPhase) {
  const { error } = await supabaseAdmin.from('campaigns').update({ phase }).eq('id', id);
  if (error) throw error;
}

/** Every campaign, regardless of who's a member — for the admin panel's Play Data view.
 * `listCampaignsForUser` below stays scoped to one user; this is the unscoped admin-only twin. */
export async function listAllCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabaseAdmin.from('campaigns').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCampaign);
}

/** Cascades via FK (`on delete cascade` on characters/memberships/party/bonds/invites,
 * `character_sheets` cascading further off `characters`) — see supabase/migrations/0001_init.sql. */
export async function deleteCampaign(id: string) {
  const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id);
  if (error) throw error;
}

export async function listCampaignsForUser(userId: string): Promise<(Campaign & { role: string })[]> {
  const { data, error } = await supabaseAdmin.from('memberships').select('role, campaigns(*)').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...mapCampaign(r.campaigns), role: r.role }));
}

function mapMembership(r: any): Membership {
  return { Id: r.id, UserId: r.user_id, CampaignId: r.campaign_id, Role: r.role, CharacterId: r.character_id, Ready: r.ready };
}

export async function insertMembership(m: Membership) {
  const { error } = await supabaseAdmin
    .from('memberships')
    .insert({ id: m.Id, user_id: m.UserId, campaign_id: m.CampaignId, role: m.Role, character_id: m.CharacterId, ready: m.Ready ?? false });
  if (error) throw error;
}

export async function updateMembershipReady(membershipId: string, ready: boolean) {
  const { error } = await supabaseAdmin.from('memberships').update({ ready }).eq('id', membershipId);
  if (error) throw error;
}

export async function listMemberships(campaignId: string): Promise<Membership[]> {
  const { data, error } = await supabaseAdmin.from('memberships').select('*').eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map(mapMembership);
}

export async function membershipFor(campaignId: string, userId: string): Promise<Membership | null> {
  const { data, error } = await supabaseAdmin
    .from('memberships')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMembership(data) : null;
}

export async function updateMembershipCharacter(membershipId: string, characterId: string) {
  const { error } = await supabaseAdmin.from('memberships').update({ character_id: characterId }).eq('id', membershipId);
  if (error) throw error;
}

function mapInvite(r: any): Invite {
  return { Id: r.id, CampaignId: r.campaign_id, Email: r.email, Code: r.code, SentAt: r.sent_at, Status: r.status };
}

export async function insertInvite(i: Invite) {
  const { error } = await supabaseAdmin
    .from('invites')
    .insert({ id: i.Id, campaign_id: i.CampaignId, email: i.Email, code: i.Code, sent_at: i.SentAt, status: i.Status });
  if (error) throw error;
}

export async function listInvites(campaignId: string): Promise<Invite[]> {
  const { data, error } = await supabaseAdmin.from('invites').select('*').eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map(mapInvite);
}

export async function getInvite(id: string): Promise<Invite | null> {
  const { data, error } = await supabaseAdmin.from('invites').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapInvite(data) : null;
}

/** Case-insensitive — a code the player retyped by hand shouldn't fail on casing alone. */
export async function getInviteByCode(code: string): Promise<Invite | null> {
  const { data, error } = await supabaseAdmin.from('invites').select('*').ilike('code', code).maybeSingle();
  if (error) throw error;
  return data ? mapInvite(data) : null;
}

/** Invites addressed to `email` (case-insensitive), still awaiting a response — used to power
 * a player's "pending invites" list, which isn't scoped to a campaign the way `listInvites` is. */
export async function listPendingInvitesForEmail(email: string): Promise<Invite[]> {
  const { data, error } = await supabaseAdmin.from('invites').select('*').ilike('email', email).eq('status', 'Pending');
  if (error) throw error;
  return (data ?? []).map(mapInvite);
}

export async function updateInviteStatus(id: string, status: InviteStatus) {
  const { error } = await supabaseAdmin.from('invites').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteInvite(id: string) {
  const { error } = await supabaseAdmin.from('invites').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Characters ----------

function mapCharacter(r: any): Character {
  return { Id: r.id, Name: r.name, PlayerName: r.player_name, UserId: r.user_id, CampaignId: r.campaign_id };
}

export async function insertCharacter(c: Character) {
  const { error } = await supabaseAdmin
    .from('characters')
    .insert({ id: c.Id, name: c.Name, player_name: c.PlayerName, user_id: c.UserId, campaign_id: c.CampaignId });
  if (error) throw error;
}

export async function listCharacters(campaignId: string): Promise<Character[]> {
  const { data, error } = await supabaseAdmin.from('characters').select('*').eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map(mapCharacter);
}

export async function getCharacter(id: string): Promise<Character | null> {
  const { data, error } = await supabaseAdmin.from('characters').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapCharacter(data) : null;
}

/** Every character across every campaign — for the admin panel's Play Data view. */
export async function listAllCharacters(): Promise<Character[]> {
  const { data, error } = await supabaseAdmin.from('characters').select('*');
  if (error) throw error;
  return (data ?? []).map(mapCharacter);
}

/** Cascades to the character's sheet and any Bonds it's part of (`on delete cascade`); the
 * owning membership's `character_id` is set null rather than the membership row being removed
 * (`on delete set null`) — deleting a character shouldn't also kick the player from the campaign. */
export async function deleteCharacter(id: string) {
  const { error } = await supabaseAdmin.from('characters').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Character sheets ----------

export async function getSheet(characterId: string): Promise<CharacterSheet | null> {
  const { data, error } = await supabaseAdmin.from('character_sheets').select('data, campaign_id').eq('character_id', characterId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const raw = data.data as CharacterSheet;
  const normalized = normalizeSheet(raw);
  // Self-heal a pre-0.13.0 sheet missing Recoveries/Scars so future reads don't need to repeat
  // this — same pattern as campaign.ts's bootstrap route backfilling a missing Party row.
  if (normalized.Recoveries !== raw.Recoveries || normalized.Scars !== raw.Scars) {
    await saveSheet(normalized, data.campaign_id as string);
  }
  return normalized;
}

export async function saveSheet(sheet: CharacterSheet, campaignId: string) {
  sheet.UpdatedAt = nowIso();
  const { error } = await supabaseAdmin
    .from('character_sheets')
    .upsert({ character_id: sheet.CharacterId, campaign_id: campaignId, data: sheet, updated_at: sheet.UpdatedAt });
  if (error) throw error;
}

export async function listSheetsForCampaign(campaignId: string): Promise<CharacterSheet[]> {
  const chars = await listCharacters(campaignId);
  const sheets = await Promise.all(chars.map((c) => getSheet(c.Id)));
  return sheets.filter((s): s is CharacterSheet => !!s);
}

// ---------- Party ----------

export async function getParty(campaignId: string): Promise<Party | null> {
  const { data, error } = await supabaseAdmin.from('party').select('data').eq('campaign_id', campaignId).maybeSingle();
  if (error) throw error;
  return data ? (data.data as Party) : null;
}

export async function saveParty(party: Party) {
  const { error } = await supabaseAdmin.from('party').upsert({ campaign_id: party.CampaignId, data: party, updated_at: nowIso() });
  if (error) throw error;
}

// ---------- Bonds ----------

export async function listBondsForCampaign(campaignId: string): Promise<Bond[]> {
  const { data, error } = await supabaseAdmin.from('bonds').select('data').eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.data as Bond);
}

export async function insertBond(bond: Bond) {
  const { error } = await supabaseAdmin.from('bonds').insert({
    id: bond.Id,
    campaign_id: bond.CampaignId,
    character_a_id: bond.CharacterAId,
    character_b_id: bond.CharacterBId,
    data: bond,
    updated_at: nowIso(),
  });
  if (error) throw error;
}

/**
 * Runs `mutate` against a Bond row locked with `SELECT ... FOR UPDATE`, inside a real Postgres
 * transaction — via a direct `pg` connection, not `supabase-js`/PostgREST, which only offers a
 * plain check-then-write with no way to hold a row lock across the read and the write. This is
 * what actually makes propose/accept/reject race-safe: two concurrent requests against the same
 * Bond serialize on the lock instead of one silently clobbering the other.
 *
 * `mutate` should throw to abort (the transaction rolls back) rather than return an error value —
 * callers map specific thrown error types to HTTP responses. Returns null if the Bond doesn't
 * exist (also rolled back; there's nothing to lock).
 */
export async function withBondLock<T>(
  bondId: string,
  mutate: (bond: Bond) => T | Promise<T>,
): Promise<{ bond: Bond; result: T } | null> {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ data: Bond }>('SELECT data FROM bonds WHERE id = $1 FOR UPDATE', [bondId]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const bond = rows[0].data;
    const result = await mutate(bond);
    await client.query('UPDATE bonds SET data = $1, updated_at = now() WHERE id = $2', [JSON.stringify(bond), bondId]);
    await client.query('COMMIT');
    return { bond, result };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Combat ----------

export async function listEncountersForCampaign(campaignId: string): Promise<Encounter[]> {
  const { data, error } = await supabaseAdmin.from('combat_encounters').select('data').eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.data as Encounter);
}

export async function getActiveEncounter(campaignId: string): Promise<Encounter | null> {
  const encounters = await listEncountersForCampaign(campaignId);
  return encounters.find((e) => e.Status === 'Active') ?? null;
}

export async function saveEncounter(encounter: Encounter) {
  encounter.UpdatedAt = nowIso();
  const { error } = await supabaseAdmin
    .from('combat_encounters')
    .upsert({ id: encounter.Id, campaign_id: encounter.CampaignId, data: encounter, updated_at: encounter.UpdatedAt });
  if (error) throw error;
}

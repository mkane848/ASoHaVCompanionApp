import { db } from './db.js';
import type {
  Bond,
  Campaign,
  ChangeLogEntry,
  Character,
  CharacterSheet,
  Invite,
  Library,
  Membership,
  Party,
  PublicUser,
} from '@asohav/shared';
import { newId, nowIso } from '@asohav/shared';

// ---------- Library (global singleton JSON blob) ----------

export function getLibrary(): Library {
  const row = db.prepare("SELECT data FROM library WHERE id = 'singleton'").get() as { data: string } | undefined;
  if (!row) throw new Error('Library not seeded');
  return JSON.parse(row.data) as Library;
}

export function saveLibrary(lib: Library) {
  db.prepare("INSERT INTO library (id, data) VALUES ('singleton', ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data").run(
    JSON.stringify(lib),
  );
}

export function libraryExists(): boolean {
  const row = db.prepare("SELECT id FROM library WHERE id = 'singleton'").get();
  return !!row;
}

// ---------- Changelog ----------

export function appendChangeLog(entry: Omit<ChangeLogEntry, 'Id' | 'At'>) {
  const id = newId('log');
  const at = nowIso();
  db.prepare(
    'INSERT INTO changelog (id, at, who, action, collection, object_id, object_name, before, after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, at, entry.Who, entry.Action, entry.Collection, entry.ObjectId, entry.ObjectName, JSON.stringify(entry.Before), JSON.stringify(entry.After));
}

export function listChangeLog(limit = 200): ChangeLogEntry[] {
  const rows = db.prepare('SELECT * FROM changelog ORDER BY at DESC LIMIT ?').all(limit) as any[];
  return rows.map((r) => ({
    Id: r.id, At: r.at, Who: r.who, Action: r.action, Collection: r.collection,
    ObjectId: r.object_id, ObjectName: r.object_name,
    Before: r.before ? JSON.parse(r.before) : null,
    After: r.after ? JSON.parse(r.after) : null,
  }));
}

// ---------- Users ----------

export function listUsers(): PublicUser[] {
  const rows = db.prepare('SELECT id, name FROM users').all() as { id: string; name: string }[];
  return rows.map((r) => ({ Id: r.id, Name: r.name }));
}

// ---------- Campaigns / Memberships / Invites ----------

export function insertCampaign(c: Campaign) {
  db.prepare('INSERT INTO campaigns (id, name, gm_user_id, created_at) VALUES (?, ?, ?, ?)').run(c.Id, c.Name, c.GmUserId, c.CreatedAt);
}

export function getCampaign(id: string): Campaign | null {
  const r = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as any;
  return r ? { Id: r.id, Name: r.name, GmUserId: r.gm_user_id, CreatedAt: r.created_at } : null;
}

export function listCampaignsForUser(userId: string): (Campaign & { role: string })[] {
  const rows = db
    .prepare('SELECT c.*, m.role as m_role FROM campaigns c JOIN memberships m ON m.campaign_id = c.id WHERE m.user_id = ?')
    .all(userId) as any[];
  return rows.map((r) => ({ Id: r.id, Name: r.name, GmUserId: r.gm_user_id, CreatedAt: r.created_at, role: r.m_role }));
}

export function insertMembership(m: Membership) {
  db.prepare('INSERT INTO memberships (id, user_id, campaign_id, role, character_id) VALUES (?, ?, ?, ?, ?)').run(
    m.Id, m.UserId, m.CampaignId, m.Role, m.CharacterId,
  );
}

export function listMemberships(campaignId: string): Membership[] {
  const rows = db.prepare('SELECT * FROM memberships WHERE campaign_id = ?').all(campaignId) as any[];
  return rows.map((r) => ({ Id: r.id, UserId: r.user_id, CampaignId: r.campaign_id, Role: r.role, CharacterId: r.character_id }));
}

export function membershipFor(campaignId: string, userId: string): Membership | null {
  const r = db.prepare('SELECT * FROM memberships WHERE campaign_id = ? AND user_id = ?').get(campaignId, userId) as any;
  return r ? { Id: r.id, UserId: r.user_id, CampaignId: r.campaign_id, Role: r.role, CharacterId: r.character_id } : null;
}

export function insertInvite(i: Invite) {
  db.prepare('INSERT INTO invites (id, campaign_id, email, code, sent_at, status) VALUES (?, ?, ?, ?, ?, ?)').run(
    i.Id, i.CampaignId, i.Email, i.Code, i.SentAt, i.Status,
  );
}

export function listInvites(campaignId: string): Invite[] {
  const rows = db.prepare('SELECT * FROM invites WHERE campaign_id = ?').all(campaignId) as any[];
  return rows.map((r) => ({ Id: r.id, CampaignId: r.campaign_id, Email: r.email, Code: r.code, SentAt: r.sent_at, Status: r.status }));
}

export function deleteInvite(id: string) {
  db.prepare('DELETE FROM invites WHERE id = ?').run(id);
}

// ---------- Characters ----------

export function insertCharacter(c: Character) {
  db.prepare('INSERT INTO characters (id, name, player_name, user_id, campaign_id) VALUES (?, ?, ?, ?, ?)').run(
    c.Id, c.Name, c.PlayerName, c.UserId, c.CampaignId,
  );
}

export function listCharacters(campaignId: string): Character[] {
  const rows = db.prepare('SELECT * FROM characters WHERE campaign_id = ?').all(campaignId) as any[];
  return rows.map((r) => ({ Id: r.id, Name: r.name, PlayerName: r.player_name, UserId: r.user_id, CampaignId: r.campaign_id }));
}

export function getCharacter(id: string): Character | null {
  const r = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
  return r ? { Id: r.id, Name: r.name, PlayerName: r.player_name, UserId: r.user_id, CampaignId: r.campaign_id } : null;
}

// ---------- Character sheets ----------

export function getSheet(characterId: string): CharacterSheet | null {
  const row = db.prepare('SELECT data FROM character_sheets WHERE character_id = ?').get(characterId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as CharacterSheet) : null;
}

export function saveSheet(sheet: CharacterSheet) {
  sheet.UpdatedAt = nowIso();
  db.prepare(
    'INSERT INTO character_sheets (character_id, data) VALUES (?, ?) ON CONFLICT(character_id) DO UPDATE SET data = excluded.data',
  ).run(sheet.CharacterId, JSON.stringify(sheet));
}

export function listSheetsForCampaign(campaignId: string): CharacterSheet[] {
  const chars = listCharacters(campaignId);
  return chars.map((c) => getSheet(c.Id)).filter((s): s is CharacterSheet => !!s);
}

// ---------- Party ----------

export function getParty(campaignId: string): Party | null {
  const row = db.prepare('SELECT data FROM party WHERE campaign_id = ?').get(campaignId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Party) : null;
}

export function saveParty(party: Party) {
  db.prepare(
    'INSERT INTO party (campaign_id, data) VALUES (?, ?) ON CONFLICT(campaign_id) DO UPDATE SET data = excluded.data',
  ).run(party.CampaignId, JSON.stringify(party));
}

// ---------- Bonds ----------

export function getBond(id: string): Bond | null {
  const row = db.prepare('SELECT data FROM bonds WHERE id = ?').get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Bond) : null;
}

export function listBondsForCampaign(campaignId: string): Bond[] {
  const rows = db.prepare('SELECT data FROM bonds WHERE campaign_id = ?').all(campaignId) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as Bond);
}

export function insertBond(bond: Bond) {
  db.prepare('INSERT INTO bonds (id, campaign_id, character_a_id, character_b_id, data) VALUES (?, ?, ?, ?, ?)').run(
    bond.Id, bond.CampaignId, bond.CharacterAId, bond.CharacterBId, JSON.stringify(bond),
  );
}

export function saveBond(bond: Bond) {
  db.prepare('UPDATE bonds SET data = ? WHERE id = ?').run(JSON.stringify(bond), bond.Id);
}

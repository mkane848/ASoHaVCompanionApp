import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../auth.js';
import {
  countGmContentByOwner,
  deleteGmContent,
  getGmContent,
  getLibrary,
  insertGmContent,
  listGmContentVisibleToUser,
  listMembershipsWithCampaignForUser,
  listUsersByIds,
  updateGmContent,
  type GmContentRow,
} from '../repo.js';
import {
  GM_CONTENT_KINDS,
  GM_CONTENT_OWNER_LIMIT,
  getCollection,
  gmContentCollectionKey,
  gmContentIdPrefix,
  newId,
  normalizeGmContentData,
  type GmContentKind,
  type GmContentList,
  type GmContentScope,
  type NPC,
  type Villain,
} from '@asohav/shared';
import { validateCollectionBody, validateLibrary, withFieldDefaults } from '../adminLogic.js';
import { wrap } from '../asyncHandler.js';

export const gmContentRouter = Router();

gmContentRouter.use(requireAuth);

// There is deliberately no `assertCampaignActive` call anywhere in this file. A `gm_content` row
// belongs to a user, not a campaign — it has no campaign_id, so archiving a campaign has nothing
// here to freeze, and a GM must stay free to write content for the next campaign. That is a
// decision, not one of the omitted guards CLAUDE.md warns about.
//
// Authorization is in this file, not RLS: the service-role key bypasses it. The ownership rules
// (`Mine` is invisible to everyone but its author; a visible row is editable only by its author or
// a Content Admin) are enforced by `loadVisibleRow` and `mayEdit` below.

const SCOPES: GmContentScope[] = ['Mine', 'SiteWide'];

function isKind(v: unknown): v is GmContentKind {
  return typeof v === 'string' && (GM_CONTENT_KINDS as string[]).includes(v);
}

function isScope(v: unknown): v is GmContentScope {
  return typeof v === 'string' && (SCOPES as string[]).includes(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Authoring Villains and NPCs is a GM tool: a Content Admin, or anyone who is the GM of at least
 *  one campaign. A Player-only account has no Adventure Prep surface to use it from. */
async function requireGmOrAdmin(req: Request, res: Response): Promise<boolean> {
  const user = req.user!;
  if (user.isAdmin) return true;
  const memberships = await listMembershipsWithCampaignForUser(user.id);
  if (memberships.some((m) => m.Role === 'GM')) return true;
  res.status(403).json({ error: 'Only a GM can write Villains and NPCs.' });
  return false;
}

/** Keeps only the keys the matching schema collection declares. This is what strips a client-sent
 *  `Id` or `Custom` (neither is a schema field) before anything is stored. */
function pickSchemaFields(kind: GmContentKind, raw: Record<string, unknown>): Record<string, unknown> {
  const fields = getCollection(gmContentCollectionKey(kind))?.fields ?? [];
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(raw, f.name)) out[f.name] = raw[f.name];
  }
  return out;
}

/** Everything `validateCollectionBody` leaves unchecked, plus the stat block. `fieldTypeError`
 *  does not look at `enum` or `enemyStatBlock` fields, so an NPC `Type` of `{}` or a malformed
 *  `Stats` would otherwise be stored. The stat block gets the same rules Content Admin's
 *  Validation panel applies, by running `validateLibrary` over a library holding only this one
 *  entry and keeping the issues filed against it. The one issue kind dropped is the one that says
 *  of itself "informational only, not an error" (a write-in NPC Type, which the schema allows). */
async function entryError(kind: GmContentKind, obj: Record<string, unknown> & { Id: string }): Promise<string | null> {
  const fields = getCollection(gmContentCollectionKey(kind))?.fields ?? [];
  for (const f of fields) {
    const v = obj[f.name];
    if (f.type === 'enum' && v !== undefined && v !== null && typeof v !== 'string') {
      return `"${f.label ?? f.name}" must be text.`;
    }
  }
  const scoped = {
    ...(await getLibrary()),
    villains: kind === 'villain' ? [obj as unknown as Villain] : [],
    npcs: kind === 'npc' ? [obj as unknown as NPC] : [],
  };
  const issues = validateLibrary(scoped).filter((i) => i.objectId === obj.Id && !i.message.includes('informational only'));
  return issues.length > 0 ? issues.map((i) => i.message).join('; ') : null;
}

/** Row to the wire shape: the stored `data` with `Id` and `Custom` taken from the row's own
 *  columns, so neither can be spoofed from inside the blob. */
function toEntry(row: GmContentRow, ownerName: string): Villain | NPC {
  const rest: Record<string, unknown> = { ...row.data };
  delete rest.Id;
  delete rest.Custom;
  const base = normalizeGmContentData(row.kind, rest as unknown as Villain | NPC);
  return { ...base, Id: row.id, Custom: { OwnerUserId: row.ownerUserId, OwnerName: ownerName, Scope: row.scope } };
}

async function ownerNameOf(ownerUserId: string): Promise<string> {
  const [u] = await listUsersByIds([ownerUserId]);
  return u?.Name ?? 'Unknown';
}

/** A row the caller is allowed to know exists: their own, or a `SiteWide` one. Anything else —
 *  including a missing row — answers 404, so another GM's `Mine` entry cannot be probed by id. */
async function loadVisibleRow(req: Request<{ id: string }>, res: Response): Promise<GmContentRow | null> {
  const row = await getGmContent(req.params.id);
  if (!row || (row.ownerUserId !== req.user!.id && row.scope !== 'SiteWide')) {
    res.status(404).json({ error: 'No such Villain or NPC.' });
    return null;
  }
  return row;
}

function mayEdit(row: GmContentRow, req: Request): boolean {
  return req.user!.isAdmin || row.ownerUserId === req.user!.id;
}

gmContentRouter.get('/', wrap(async (req, res) => {
  if (!(await requireGmOrAdmin(req, res))) return;
  const rows = await listGmContentVisibleToUser(req.user!.id);
  const owners = await listUsersByIds([...new Set(rows.map((r) => r.ownerUserId))]);
  const nameById = new Map(owners.map((u) => [u.Id, u.Name]));
  const entries = rows.map((r) => toEntry(r, nameById.get(r.ownerUserId) ?? 'Unknown'));
  const byName = (a: { Name?: string }, b: { Name?: string }) => (a.Name ?? '').toLowerCase().localeCompare((b.Name ?? '').toLowerCase());
  const body: GmContentList = {
    villains: rows.flatMap((r, i) => (r.kind === 'villain' ? [entries[i] as Villain] : [])).sort(byName),
    npcs: rows.flatMap((r, i) => (r.kind === 'npc' ? [entries[i] as NPC] : [])).sort(byName),
  };
  res.json(body);
}));

gmContentRouter.post('/', wrap(async (req, res) => {
  if (!(await requireGmOrAdmin(req, res))) return;
  const { kind, scope, data } = (req.body ?? {}) as Record<string, unknown>;
  if (!isKind(kind)) { res.status(400).json({ error: 'kind must be "villain" or "npc".' }); return; }
  if (!isScope(scope)) { res.status(400).json({ error: 'scope must be "Mine" or "SiteWide".' }); return; }
  if (!isPlainObject(data)) { res.status(400).json({ error: 'data must be an object.' }); return; }

  const fields = getCollection(gmContentCollectionKey(kind))?.fields ?? [];
  const picked = withFieldDefaults(fields, pickSchemaFields(kind, data));
  const bodyError = validateCollectionBody(fields, picked, { partial: false });
  if (bodyError) { res.status(400).json({ error: bodyError }); return; }

  const id = newId(gmContentIdPrefix(kind));
  const blockError = await entryError(kind, { ...picked, Id: id });
  if (blockError) { res.status(400).json({ error: blockError }); return; }

  const userId = req.user!.id;
  if ((await countGmContentByOwner(userId)) >= GM_CONTENT_OWNER_LIMIT) {
    res.status(409).json({ error: `You can keep at most ${GM_CONTENT_OWNER_LIMIT} Villains and NPCs. Delete one to make room.` });
    return;
  }

  const row = await insertGmContent({ id, kind, ownerUserId: userId, scope, data: picked });
  res.status(201).json({ entry: toEntry(row, req.user!.name) });
}));

gmContentRouter.put('/:id', wrap<{ id: string }>(async (req, res) => {
  if (!(await requireGmOrAdmin(req, res))) return;
  const row = await loadVisibleRow(req, res);
  if (!row) return;
  if (!mayEdit(row, req)) { res.status(403).json({ error: 'Only its author can edit this.' }); return; }

  const { scope, data } = (req.body ?? {}) as Record<string, unknown>;
  if (scope !== undefined && !isScope(scope)) { res.status(400).json({ error: 'scope must be "Mine" or "SiteWide".' }); return; }
  if (data !== undefined && !isPlainObject(data)) { res.status(400).json({ error: 'data must be an object.' }); return; }
  if (scope === undefined && data === undefined) { res.status(400).json({ error: 'Nothing to update.' }); return; }

  let merged: Record<string, unknown> | undefined;
  if (data !== undefined) {
    const fields = getCollection(gmContentCollectionKey(row.kind))?.fields ?? [];
    const patch = pickSchemaFields(row.kind, data);
    const bodyError = validateCollectionBody(fields, patch, { partial: true });
    if (bodyError) { res.status(400).json({ error: bodyError }); return; }
    merged = { ...pickSchemaFields(row.kind, row.data), ...patch };
    const blockError = await entryError(row.kind, { ...merged, Id: row.id });
    if (blockError) { res.status(400).json({ error: blockError }); return; }
  }

  const updated = await updateGmContent(row.id, { scope: scope as GmContentScope | undefined, data: merged });
  if (!updated) { res.status(404).json({ error: 'No such Villain or NPC.' }); return; }
  res.json({ entry: toEntry(updated, await ownerNameOf(updated.ownerUserId)) });
}));

gmContentRouter.delete('/:id', wrap<{ id: string }>(async (req, res) => {
  if (!(await requireGmOrAdmin(req, res))) return;
  const row = await loadVisibleRow(req, res);
  if (!row) return;
  if (!mayEdit(row, req)) { res.status(403).json({ error: 'Only its author can delete this.' }); return; }
  await deleteGmContent(row.id);
  res.status(204).end();
}));

import { Router } from 'express';
import { getLibrary, getLibraryWithVersion, saveLibrary, appendChangeLog, listChangeLog, getChangeLogEntry } from '../repo.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { getCollection, newId, seedLibrary, type Library } from '@asohav/shared';
import { validateLibrary, referencedBy, diffEntry, validateSettingsPatch, validateCollectionBody, withFieldDefaults } from '../adminLogic.js';
import { wrap } from '../asyncHandler.js';

/** One record in a library collection. `Library` gives each collection its own element type, and
 *  this file's CRUD is generic over all fourteen of them by design — `getCollection()` has already
 *  established the key is real, so the widening happens once, here, rather than at every route. */
type LibRow = Record<string, unknown> & { Id: string; Name?: string };

function rowsOf(lib: Library, key: string): LibRow[] {
  return (lib as unknown as Record<string, LibRow[]>)[key];
}

export const libraryRouter = Router();

libraryRouter.use(requireAuth);

libraryRouter.get('/', wrap(async (_req, res) => {
  res.json({ library: await getLibrary() });
}));

libraryRouter.get('/validation', requireAdmin, wrap(async (_req, res) => {
  res.json({ issues: validateLibrary(await getLibrary()) });
}));

libraryRouter.get('/changelog', requireAdmin, wrap(async (_req, res) => {
  const log = await listChangeLog();
  res.json({
    entries: log.map((e) => ({ ...e, Diffs: diffEntry(e.Before, e.After) })),
  });
}));

/* Restoring a deleted record. Every delete already stored the full record as the changelog
   entry's `Before` — it just had no way back out, so "there is no undo" was true only because
   nothing read it. Restores under the record's *original* Id, which is the whole reason this is a
   route rather than the client re-POSTing the payload: a fresh Id would leave every ref that
   pointed at the deleted record still dangling. */
libraryRouter.post('/changelog/:entryId/restore', requireAdmin, wrap(async (req, res) => {
  const entry = await getChangeLogEntry(req.params.entryId);
  if (!entry) { res.status(404).json({ error: 'No such changelog entry.' }); return; }
  if (entry.Action !== 'delete') { res.status(400).json({ error: 'Only a deleted record can be restored.' }); return; }

  const col = getCollection(entry.Collection);
  if (!col) { res.status(404).json({ error: 'Unknown collection.' }); return; }

  const before = entry.Before as LibRow | null;
  if (!before || typeof before !== 'object' || !before.Id) {
    res.status(400).json({ error: 'That entry has no restorable record.' });
    return;
  }

  const { library: lib, version } = await getLibraryWithVersion();
  const arr = rowsOf(lib, col.key);
  // Re-creating an Id that is live again would give the collection two records with one Id, and
  // every ref to it would resolve arbitrarily.
  if (arr.some((x) => x.Id === before.Id)) {
    res.status(409).json({ error: `A ${col.singular.toLowerCase()} with that Id already exists.` });
    return;
  }

  arr.push(before);
  await saveLibrary(lib, version);
  await appendChangeLog({
    Who: req.user!.name,
    Action: 'create',
    Collection: col.key,
    ObjectId: before.Id,
    ObjectName: before.Name || before.Id,
    Before: null,
    After: before,
  });
  res.json({ object: before });
}));

libraryRouter.get('/:collection/:id/referenced-by', requireAdmin, wrap(async (req, res) => {
  res.json({ rows: referencedBy(await getLibrary(), req.params.collection, req.params.id) });
}));

libraryRouter.put('/settings', requireAdmin, wrap(async (req, res) => {
  const settingsError = validateSettingsPatch(req.body ?? {});
  if (settingsError) { res.status(400).json({ error: settingsError }); return; }
  const { library: lib, version } = await getLibraryWithVersion();
  const before = { ...lib.settings };
  lib.settings = { ...lib.settings, ...req.body };
  await saveLibrary(lib, version);
  await appendChangeLog({ Who: req.user!.name, Action: 'update', Collection: 'settings', ObjectId: 'settings', ObjectName: 'Game settings', Before: before, After: lib.settings });
  res.json({ settings: lib.settings });
}));

libraryRouter.post('/export', requireAdmin, wrap(async (_req, res) => {
  res.json({ exportedAt: new Date().toISOString(), app: 'asohav-content-library', library: await getLibrary() });
}));

libraryRouter.post('/import', requireAdmin, wrap(async (req, res) => {
  const incoming = (req.body?.library ?? req.body) as Library;
  if (!incoming || !incoming.virtues || !incoming.moves) {
    res.status(400).json({ error: 'Not an ASoHaV library export.' });
    return;
  }
  await saveLibrary(incoming);
  await appendChangeLog({ Who: req.user!.name, Action: 'import', Collection: 'library', ObjectId: 'library', ObjectName: 'Whole library', Before: null, After: { note: 'bulk import' } });
  res.json({ library: incoming });
}));

libraryRouter.post('/reset', requireAdmin, wrap(async (req, res) => {
  const fresh = seedLibrary();
  await saveLibrary(fresh);
  await appendChangeLog({ Who: req.user!.name, Action: 'reset', Collection: 'library', ObjectId: 'library', ObjectName: 'Whole library', Before: null, After: { note: 'reset to seed' } });
  res.json({ library: fresh });
}));

libraryRouter.post('/:collection', requireAdmin, wrap(async (req, res) => {
  const col = getCollection(req.params.collection);
  if (!col) { res.status(404).json({ error: 'Unknown collection.' }); return; }
  const body = withFieldDefaults(col.fields, req.body ?? {});
  const bodyError = validateCollectionBody(col.fields, body, { partial: false });
  if (bodyError) { res.status(400).json({ error: bodyError }); return; }
  const { library: lib, version } = await getLibraryWithVersion();
  const arr = rowsOf(lib, col.key);
  // Id last so a client-supplied one can't override the generated one — it could before 0.51.0,
  // since the spread ran the other way round.
  const obj: LibRow = { ...body, Id: newId(col.idPrefix) };
  arr.push(obj);
  await saveLibrary(lib, version);
  await appendChangeLog({ Who: req.user!.name, Action: 'create', Collection: col.key, ObjectId: obj.Id, ObjectName: obj.Name || obj.Id, Before: null, After: obj });
  res.json({ object: obj });
}));

libraryRouter.put('/:collection/:id', requireAdmin, wrap(async (req, res) => {
  const col = getCollection(req.params.collection);
  if (!col) { res.status(404).json({ error: 'Unknown collection.' }); return; }
  const bodyError = validateCollectionBody(col.fields, req.body ?? {}, { partial: true });
  if (bodyError) { res.status(400).json({ error: bodyError }); return; }
  const { library: lib, version } = await getLibraryWithVersion();
  const arr = rowsOf(lib, col.key);
  const idx = arr.findIndex((x) => x.Id === req.params.id);
  if (idx < 0) { res.status(404).json({ error: 'Not found.' }); return; }
  const before = { ...arr[idx] };
  arr[idx] = { ...arr[idx], ...req.body };
  await saveLibrary(lib, version);
  await appendChangeLog({ Who: req.user!.name, Action: 'update', Collection: col.key, ObjectId: arr[idx].Id, ObjectName: arr[idx].Name || arr[idx].Id, Before: before, After: arr[idx] });
  res.json({ object: arr[idx] });
}));

/* `?force=true` is the informed half of deleting something other records point at.
   `referencedBy()` has powered a "deleting this will break these" warning in Content Admin since
   the panel was built, but nothing enforced it — the server deleted regardless, so the warning was
   advice a client could simply not render. Blocking outright would be wrong in the other
   direction: breaking a ref is sometimes exactly what you mean to do, and the Validation panel
   surfaces the dangling ones afterward. So the default refuses and names what would break, and the
   client re-sends with `force` only after the admin confirmed through the "Delete and break N"
   dialog. A caller that never saw that dialog gets the refusal. */
libraryRouter.delete('/:collection/:id', requireAdmin, wrap(async (req, res) => {
  const col = getCollection(req.params.collection);
  if (!col) { res.status(404).json({ error: 'Unknown collection.' }); return; }
  const { library: lib, version } = await getLibraryWithVersion();
  const arr = rowsOf(lib, col.key);
  const idx = arr.findIndex((x) => x.Id === req.params.id);
  if (idx < 0) { res.json({ ok: true }); return; }

  const refs = referencedBy(lib, col.key, req.params.id);
  if (refs.length > 0 && req.query.force !== 'true') {
    res.status(409).json({
      error: `${refs.length} other record${refs.length === 1 ? '' : 's'} still reference${refs.length === 1 ? 's' : ''} this ${col.singular.toLowerCase()}. Delete it anyway to leave those references dangling.`,
      references: refs,
    });
    return;
  }
  const before = arr[idx];
  arr.splice(idx, 1);
  await saveLibrary(lib, version);
  await appendChangeLog({ Who: req.user!.name, Action: 'delete', Collection: col.key, ObjectId: before.Id, ObjectName: before.Name || before.Id, Before: before, After: null });
  res.json({ ok: true });
}));

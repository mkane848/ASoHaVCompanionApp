import { Router } from 'express';
import { getLibrary, saveLibrary, appendChangeLog, listChangeLog } from '../repo.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { getCollection, newId, seedLibrary, type Library } from '@asohav/shared';
import { validateLibrary, referencedBy, diffEntry } from '../adminLogic.js';

export const libraryRouter = Router();

libraryRouter.use(requireAuth);

libraryRouter.get('/', async (_req, res) => {
  res.json({ library: await getLibrary() });
});

libraryRouter.get('/validation', requireAdmin, async (_req, res) => {
  res.json({ issues: validateLibrary(await getLibrary()) });
});

libraryRouter.get('/changelog', requireAdmin, async (_req, res) => {
  const log = await listChangeLog();
  res.json({
    entries: log.map((e) => ({ ...e, Diffs: diffEntry(e.Before, e.After) })),
  });
});

libraryRouter.get('/:collection/:id/referenced-by', requireAdmin, async (req, res) => {
  res.json({ rows: referencedBy(await getLibrary(), req.params.collection, req.params.id) });
});

libraryRouter.put('/settings', requireAdmin, async (req, res) => {
  const lib = await getLibrary();
  const before = { ...lib.settings };
  lib.settings = { ...lib.settings, ...req.body };
  await saveLibrary(lib);
  await appendChangeLog({ Who: req.user!.name, Action: 'update', Collection: 'settings', ObjectId: 'settings', ObjectName: 'Game settings', Before: before, After: lib.settings });
  res.json({ settings: lib.settings });
});

libraryRouter.post('/export', requireAdmin, async (_req, res) => {
  res.json({ exportedAt: new Date().toISOString(), app: 'asohav-content-library', library: await getLibrary() });
});

libraryRouter.post('/import', requireAdmin, async (req, res) => {
  const incoming = (req.body?.library ?? req.body) as Library;
  if (!incoming || !incoming.virtues || !incoming.moves) {
    res.status(400).json({ error: 'Not an ASoHaV library export.' });
    return;
  }
  await saveLibrary(incoming);
  await appendChangeLog({ Who: req.user!.name, Action: 'import', Collection: 'library', ObjectId: 'library', ObjectName: 'Whole library', Before: null, After: { note: 'bulk import' } });
  res.json({ library: incoming });
});

libraryRouter.post('/reset', requireAdmin, async (req, res) => {
  const fresh = seedLibrary();
  await saveLibrary(fresh);
  await appendChangeLog({ Who: req.user!.name, Action: 'reset', Collection: 'library', ObjectId: 'library', ObjectName: 'Whole library', Before: null, After: { note: 'reset to seed' } });
  res.json({ library: fresh });
});

libraryRouter.post('/:collection', requireAdmin, async (req, res) => {
  const col = getCollection(req.params.collection);
  if (!col) { res.status(404).json({ error: 'Unknown collection.' }); return; }
  const lib = await getLibrary();
  const arr = (lib as any)[col.key] as any[];
  const obj = { Id: newId(col.idPrefix), ...req.body };
  arr.push(obj);
  await saveLibrary(lib);
  await appendChangeLog({ Who: req.user!.name, Action: 'create', Collection: col.key, ObjectId: obj.Id, ObjectName: obj.Name || obj.Id, Before: null, After: obj });
  res.json({ object: obj });
});

libraryRouter.put('/:collection/:id', requireAdmin, async (req, res) => {
  const col = getCollection(req.params.collection);
  if (!col) { res.status(404).json({ error: 'Unknown collection.' }); return; }
  const lib = await getLibrary();
  const arr = (lib as any)[col.key] as any[];
  const idx = arr.findIndex((x) => x.Id === req.params.id);
  if (idx < 0) { res.status(404).json({ error: 'Not found.' }); return; }
  const before = { ...arr[idx] };
  arr[idx] = { ...arr[idx], ...req.body };
  await saveLibrary(lib);
  await appendChangeLog({ Who: req.user!.name, Action: 'update', Collection: col.key, ObjectId: arr[idx].Id, ObjectName: arr[idx].Name || arr[idx].Id, Before: before, After: arr[idx] });
  res.json({ object: arr[idx] });
});

libraryRouter.delete('/:collection/:id', requireAdmin, async (req, res) => {
  const col = getCollection(req.params.collection);
  if (!col) { res.status(404).json({ error: 'Unknown collection.' }); return; }
  const lib = await getLibrary();
  const arr = (lib as any)[col.key] as any[];
  const idx = arr.findIndex((x) => x.Id === req.params.id);
  if (idx < 0) { res.json({ ok: true }); return; }
  const before = arr[idx];
  arr.splice(idx, 1);
  await saveLibrary(lib);
  await appendChangeLog({ Who: req.user!.name, Action: 'delete', Collection: col.key, ObjectId: before.Id, ObjectName: before.Name || before.Id, Before: before, After: null });
  res.json({ ok: true });
});

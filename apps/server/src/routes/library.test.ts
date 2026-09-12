import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Library } from '@asohav/shared';

/* library.ts was the only route file in the app with no tests at all until 0.50.0 — including
   POST /reset, which replaces every authored record in the live library with seed content and is
   reachable from one unconfirmed button in Content Admin. These cover the authorization surface,
   the CRUD paths, and the optimistic-locking precondition added in the same release. */
vi.mock('../repo.js', () => ({
  getLibrary: vi.fn(),
  getLibraryWithVersion: vi.fn(),
  saveLibrary: vi.fn(),
  appendChangeLog: vi.fn(),
  listChangeLog: vi.fn(),
  getChangeLogEntry: vi.fn(),
}));

import * as repo from '../repo.js';
import { libraryRouter } from './library.js';
import { errorMiddleware } from '../errorMiddleware.js';

function appAs(isAdmin: boolean) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'u-mike', name: 'Mike', email: 'mike@asohav.dev', isAdmin };
    next();
  });
  app.use('/library', libraryRouter);
  // The real production error middleware, not a copy — LibraryConflictError reaches the client
  // through it rather than through an inline catch, so the harness needs it to see a 409.
  app.use(errorMiddleware);
  return app;
}

const VERSION = '2026-09-11T19:00:00.000+00:00';

function makeLibrary(overrides: Partial<Library> = {}): Library {
  return {
    virtues: [{ Id: 'v-might', Name: 'Might', Tagline: '', Essence: '', UsageHelperText: '' }],
    conditions: [], armorTypes: [], items: [], motifs: [], loadTiers: [],
    improvementTrees: [], improvements: [],
    moves: [{ Id: 'm-1', Name: 'Take a Risk', Kind: 'Basic', Description: '', Results: {} }],
    glossary: [], campAssets: [], enemies: [], villains: [], npcs: [], locations: [],
    settings: {},
    ...overrides,
  } as unknown as Library;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.getLibrary).mockResolvedValue(makeLibrary());
  vi.mocked(repo.getLibraryWithVersion).mockResolvedValue({ library: makeLibrary(), version: VERSION });
  vi.mocked(repo.saveLibrary).mockResolvedValue('2026-09-11T19:05:00.000+00:00');
});

describe('library authorization', () => {
  it('serves GET / to any signed-in user — the sheet needs it, not just admins', async () => {
    const res = await request(appAs(false)).get('/library');
    expect(res.status).toBe(200);
    expect(res.body.library.virtues).toHaveLength(1);
  });

  it('403s a non-admin on every mutating route and on the admin-only reads', async () => {
    const app = appAs(false);
    const calls = [
      request(app).post('/library/virtues').send({ Name: 'New' }),
      request(app).put('/library/virtues/v-might').send({ Name: 'Changed' }),
      request(app).delete('/library/virtues/v-might'),
      request(app).put('/library/settings').send({ PotentialTrackLength: 9 }),
      request(app).post('/library/import').send({ library: makeLibrary() }),
      request(app).post('/library/reset'),
      request(app).post('/library/export'),
      request(app).get('/library/validation'),
      request(app).get('/library/changelog'),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(403);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });
});

describe('library CRUD', () => {
  it('creates a record with a generated Id and logs it', async () => {
    const res = await request(appAs(true)).post('/library/virtues').send({ Name: 'Resolve' });

    expect(res.status).toBe(200);
    expect(res.body.object.Name).toBe('Resolve');
    expect(res.body.object.Id).toMatch(/^v-/);
    expect(repo.appendChangeLog).toHaveBeenCalledWith(expect.objectContaining({ Action: 'create', Collection: 'virtues' }));
  });

  it('updates an existing record by merging the body over it', async () => {
    const res = await request(appAs(true)).put('/library/virtues/v-might').send({ Tagline: 'Force' });

    expect(res.status).toBe(200);
    expect(res.body.object).toMatchObject({ Id: 'v-might', Name: 'Might', Tagline: 'Force' });
  });

  it('404s an unknown collection', async () => {
    const res = await request(appAs(true)).post('/library/sandwiches').send({ Name: 'BLT' });
    expect(res.status).toBe(404);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('404s updating a record that does not exist', async () => {
    const res = await request(appAs(true)).put('/library/virtues/v-nope').send({ Name: 'x' });
    expect(res.status).toBe(404);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('deletes a record and logs the full before-state', async () => {
    const res = await request(appAs(true)).delete('/library/virtues/v-might');

    expect(res.status).toBe(200);
    expect(repo.appendChangeLog).toHaveBeenCalledWith(
      expect.objectContaining({ Action: 'delete', Before: expect.objectContaining({ Id: 'v-might' }) }),
    );
  });

  it('is a no-op, not a 404, on a record that is already gone', async () => {
    const res = await request(appAs(true)).delete('/library/virtues/v-nope');
    expect(res.status).toBe(200);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('rejects an import that is not an ASoHaV library export', async () => {
    const res = await request(appAs(true)).post('/library/import').send({ library: { virtues: [] } });
    expect(res.status).toBe(400);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('resets to seed content unconditionally, with no version precondition', async () => {
    const res = await request(appAs(true)).post('/library/reset');

    expect(res.status).toBe(200);
    // Replacing whatever is there is the whole point of a reset, so it must not be conditional.
    expect(repo.saveLibrary).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repo.saveLibrary).mock.calls[0]).toHaveLength(1);
  });
});

describe('optimistic locking', () => {
  it.each([
    ['create', () => request(appAs(true)).post('/library/virtues').send({ Name: 'New' })],
    ['update', () => request(appAs(true)).put('/library/virtues/v-might').send({ Name: 'Changed' })],
    ['delete', () => request(appAs(true)).delete('/library/virtues/v-might')],
    ['settings', () => request(appAs(true)).put('/library/settings').send({ PotentialTrackLength: 9 })],
  ])('passes the version it read as the write precondition on %s', async (_label, call) => {
    await call();
    expect(repo.saveLibrary).toHaveBeenCalledWith(expect.anything(), VERSION);
  });

  it('409s when someone else saved in between, rather than clobbering them', async () => {
    const conflict = Object.assign(new Error('Someone else saved the library while you were editing.'), { status: 409 });
    vi.mocked(repo.saveLibrary).mockRejectedValue(conflict);

    const res = await request(appAs(true)).put('/library/virtues/v-might').send({ Name: 'Changed' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/someone else saved/i);
  });
});

/* 0.51.0 — FieldDef.required and FieldDef.default had been declared in schema.ts since the schema
   existed and were read by nothing, and PUT /settings shallow-merged its body with no validation
   at all. These pin the three consequences that actually bit. */
describe('field validation', () => {
  it('refuses to create a record missing a required field', async () => {
    const res = await request(appAs(true)).post('/library/virtues').send({ Tagline: 'No name here' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('refuses a required field present but blank, not just absent', async () => {
    // The exact shape the admin panel sends when you hit Save on a fresh record without typing:
    // createNew() seeds `{ Name: '' }`. This used to store, and render as "(unnamed)".
    const res = await request(appAs(true)).post('/library/virtues').send({ Name: '   ' });

    expect(res.status).toBe(400);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('applies a declared default when the field is omitted', async () => {
    // items.LoadCost declares `default: 1`.
    const res = await request(appAs(true)).post('/library/items').send({ Name: 'Lantern' });

    expect(res.status).toBe(200);
    expect(res.body.object.LoadCost).toBe(1);
  });

  it('generates the Id itself and ignores a client-supplied one', async () => {
    const res = await request(appAs(true)).post('/library/virtues').send({ Name: 'Resolve', Id: 'v-injected' });

    expect(res.status).toBe(200);
    expect(res.body.object.Id).not.toBe('v-injected');
    expect(res.body.object.Id).toMatch(/^v-/);
  });

  it('allows an update that omits a required field — a PUT is a partial', async () => {
    const res = await request(appAs(true)).put('/library/virtues/v-might').send({ Tagline: 'Force' });

    expect(res.status).toBe(200);
    expect(res.body.object.Name).toBe('Might');
  });

  it('still refuses an update that blanks a required field', async () => {
    const res = await request(appAs(true)).put('/library/virtues/v-might').send({ Name: '' });

    expect(res.status).toBe(400);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });
});

describe('settings validation', () => {
  it('accepts a boolean for GlossaryAutoLink', async () => {
    const res = await request(appAs(true)).put('/library/settings').send({ GlossaryAutoLink: false });

    expect(res.status).toBe(200);
    expect(repo.saveLibrary).toHaveBeenCalled();
  });

  it('refuses the NaN-to-null a number input produced for GlossaryAutoLink before 0.51.0', async () => {
    // NaN does not survive JSON, so what actually arrived on the wire was null — which merged in
    // cleanly and silently disabled glossary auto-linking library-wide.
    const res = await request(appAs(true)).put('/library/settings').send({ GlossaryAutoLink: null });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/true or false/i);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('refuses a non-integer track length', async () => {
    const res = await request(appAs(true)).put('/library/settings').send({ PotentialTrackLength: 'five' });

    expect(res.status).toBe(400);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('refuses an unknown setting key rather than storing it unread', async () => {
    const res = await request(appAs(true)).put('/library/settings').send({ PotentialTrackLenght: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown setting/i);
  });
});

/* Restoring a deleted record, added in 0.51.0. Every delete had always stored the whole record as
   the entry's `Before`; nothing ever read it, so Content Admin's own delete confirm could only
   say "there is no undo". */
describe('restore from the changelog', () => {
  const deleteEntry = {
    Id: 'cl-1',
    At: '2026-09-11T18:00:00.000Z',
    Who: 'Mike',
    Action: 'delete' as const,
    Collection: 'virtues',
    ObjectId: 'v-resolve',
    ObjectName: 'Resolve',
    Before: { Id: 'v-resolve', Name: 'Resolve', Tagline: 'Grit & Will' },
    After: null,
  };

  it('puts the record back under its original Id', async () => {
    vi.mocked(repo.getChangeLogEntry).mockResolvedValue(deleteEntry);

    const res = await request(appAs(true)).post('/library/changelog/cl-1/restore');

    expect(res.status).toBe(200);
    expect(res.body.object).toEqual(deleteEntry.Before);
    // The whole reason this is a route rather than the client re-POSTing: a `create` would mint a
    // fresh Id and leave every ref that pointed at the old one dangling.
    const saved = vi.mocked(repo.saveLibrary).mock.calls[0][0] as Library;
    expect(saved.virtues.map((v) => v.Id)).toContain('v-resolve');
    expect(repo.appendChangeLog).toHaveBeenCalledWith(
      expect.objectContaining({ Action: 'create', Collection: 'virtues', ObjectId: 'v-resolve' }),
    );
  });

  it('sends the optimistic-locking precondition, like every other library write', async () => {
    vi.mocked(repo.getChangeLogEntry).mockResolvedValue(deleteEntry);
    await request(appAs(true)).post('/library/changelog/cl-1/restore');
    expect(repo.saveLibrary).toHaveBeenCalledWith(expect.anything(), VERSION);
  });

  it('409s when the Id is live again — two records under one Id would break every ref to it', async () => {
    vi.mocked(repo.getChangeLogEntry).mockResolvedValue(deleteEntry);
    vi.mocked(repo.getLibraryWithVersion).mockResolvedValue({
      library: makeLibrary({ virtues: [{ Id: 'v-resolve', Name: 'Resolve (re-added by hand)' }] as any }),
      version: VERSION,
    });

    const res = await request(appAs(true)).post('/library/changelog/cl-1/restore');

    expect(res.status).toBe(409);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('400s on a non-delete entry — there is nothing to put back', async () => {
    vi.mocked(repo.getChangeLogEntry).mockResolvedValue({ ...deleteEntry, Action: 'update' as const });
    const res = await request(appAs(true)).post('/library/changelog/cl-1/restore');
    expect(res.status).toBe(400);
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('400s when the entry has no restorable record', async () => {
    vi.mocked(repo.getChangeLogEntry).mockResolvedValue({ ...deleteEntry, Before: null });
    const res = await request(appAs(true)).post('/library/changelog/cl-1/restore');
    expect(res.status).toBe(400);
  });

  it('404s an unknown entry', async () => {
    vi.mocked(repo.getChangeLogEntry).mockResolvedValue(null);
    const res = await request(appAs(true)).post('/library/changelog/cl-9999/restore');
    expect(res.status).toBe(404);
  });

  it('403s a non-admin', async () => {
    const res = await request(appAs(false)).post('/library/changelog/cl-1/restore');
    expect(res.status).toBe(403);
    expect(repo.getChangeLogEntry).not.toHaveBeenCalled();
  });
});

/* Referential integrity on delete, added in 0.51.0. `referencedBy()` had powered Content Admin's
   "deleting this will break these" warning since the panel was built, and the server ignored it
   entirely — so the warning was advice any client could decline to render. */
describe('delete guards live references', () => {
  const referencing = () =>
    makeLibrary({
      moves: [{ Id: 'm-1', Name: 'Take a Risk', Kind: 'Basic', VirtueId: 'v-might', Description: '', Results: {} }] as any,
    });

  beforeEach(() => {
    vi.mocked(repo.getLibraryWithVersion).mockResolvedValue({ library: referencing(), version: VERSION });
  });

  it('409s a bare delete and names what would break', async () => {
    const res = await request(appAs(true)).delete('/library/virtues/v-might');

    expect(res.status).toBe(409);
    expect(res.body.references).toHaveLength(1);
    expect(res.body.references[0]).toMatchObject({ name: 'Take a Risk' });
    expect(repo.saveLibrary).not.toHaveBeenCalled();
  });

  it('deletes anyway with ?force=true — breaking a reference is sometimes the point', async () => {
    const res = await request(appAs(true)).delete('/library/virtues/v-might?force=true');

    expect(res.status).toBe(200);
    expect(repo.saveLibrary).toHaveBeenCalledTimes(1);
    // Deliberately not cascading: the Validation panel surfaces the now-dangling ref, and
    // silently editing other records out from under the admin would be the bigger surprise.
    const saved = vi.mocked(repo.saveLibrary).mock.calls[0][0] as Library;
    expect((saved.moves[0] as any).VirtueId).toBe('v-might');
  });

  it('needs no force when nothing points at the record', async () => {
    const res = await request(appAs(true)).delete('/library/moves/m-1');
    expect(res.status).toBe(200);
    expect(repo.saveLibrary).toHaveBeenCalledTimes(1);
  });
});

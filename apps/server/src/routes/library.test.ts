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

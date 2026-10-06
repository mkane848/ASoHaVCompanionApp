import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { GM_CONTENT_OWNER_LIMIT, seedLibrary, type GmContentList, type NPC, type Villain } from '@asohav/shared';
import type { GmContentRow } from '../repo.js';

vi.mock('../repo.js', () => ({
  getLibrary: vi.fn(),
  listMembershipsWithCampaignForUser: vi.fn(),
  listUsersByIds: vi.fn(),
  listGmContentVisibleToUser: vi.fn(),
  getGmContent: vi.fn(),
  countGmContentByOwner: vi.fn(),
  insertGmContent: vi.fn(),
  updateGmContent: vi.fn(),
  deleteGmContent: vi.fn(),
}));

import * as repo from '../repo.js';
import { gmContentRouter } from './gmContent.js';

interface TestUser { id: string; name: string; isAdmin: boolean }
const mike: TestUser = { id: 'u-mike', name: 'Mike', isAdmin: false };
const player: TestUser = { id: 'u-pat', name: 'Pat', isAdmin: false };
const admin: TestUser = { id: 'u-admin', name: 'Ada', isAdmin: true };
const names: Record<string, string> = { 'u-mike': 'Mike', 'u-ryan': 'Ryan', 'u-admin': 'Ada' };

function appAs(user: TestUser) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { ...user, email: `${user.id}@asohav.dev` };
    next();
  });
  app.use('/gm-content', gmContentRouter);
  return app;
}

const grizzaStats = seedLibrary().villains.find((v) => v.Id === 'vil-grizza')!.Stats!;
const skreelStats = seedLibrary().npcs.find((n) => n.Id === 'npc-skreel')!.Stats!;

let rows: GmContentRow[];
const NOW = '2026-10-06T12:00:00Z';

function row(overrides: Partial<GmContentRow> & { id: string }): GmContentRow {
  return {
    kind: 'villain',
    ownerUserId: 'u-mike',
    scope: 'Mine',
    data: { Name: 'Placeholder' },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  rows = [];
  // GMs: mike and ryan. Everyone else is a Player (or an admin with no campaigns).
  vi.mocked(repo.listMembershipsWithCampaignForUser).mockImplementation(async (userId: string) =>
    userId === 'u-mike' || userId === 'u-ryan'
      ? [{ Id: 'mb', UserId: userId, CampaignId: 'cm-1', Role: 'GM', CharacterId: null, CampaignName: 'C', CampaignStatus: 'Active', CampaignPhase: 'Playing' }]
      : [{ Id: 'mb', UserId: userId, CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-1', CampaignName: 'C', CampaignStatus: 'Active', CampaignPhase: 'Playing' }],
  );
  vi.mocked(repo.getLibrary).mockResolvedValue(seedLibrary());
  vi.mocked(repo.listUsersByIds).mockImplementation(async (ids: string[]) => ids.filter((i) => names[i]).map((i) => ({ Id: i, Name: names[i] })));
  vi.mocked(repo.listGmContentVisibleToUser).mockImplementation(async (userId: string) => rows.filter((r) => r.ownerUserId === userId || r.scope === 'SiteWide'));
  vi.mocked(repo.getGmContent).mockImplementation(async (id: string) => rows.find((r) => r.id === id) ?? null);
  vi.mocked(repo.countGmContentByOwner).mockImplementation(async (userId: string) => rows.filter((r) => r.ownerUserId === userId).length);
  vi.mocked(repo.insertGmContent).mockImplementation(async (input) => {
    const r: GmContentRow = { ...input, createdAt: NOW, updatedAt: NOW };
    rows.push(r);
    return r;
  });
  vi.mocked(repo.updateGmContent).mockImplementation(async (id, patch) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return null;
    if (patch.scope !== undefined) r.scope = patch.scope;
    if (patch.data !== undefined) r.data = patch.data;
    r.updatedAt = '2026-10-07T00:00:00Z';
    return r;
  });
  vi.mocked(repo.deleteGmContent).mockImplementation(async (id: string) => {
    rows = rows.filter((r) => r.id !== id);
  });
});

describe('the GM-or-admin gate', () => {
  it('403s a non-GM non-admin on every route, touching nothing', async () => {
    rows.push(row({ id: 'gvil-1', ownerUserId: 'u-pat', scope: 'SiteWide' }));
    const app = appAs(player);
    const results = await Promise.all([
      request(app).get('/gm-content'),
      request(app).post('/gm-content').send({ kind: 'villain', scope: 'Mine', data: { Name: 'X' } }),
      request(app).put('/gm-content/gvil-1').send({ scope: 'Mine' }),
      request(app).delete('/gm-content/gvil-1'),
    ]);
    for (const res of results) expect(res.status).toBe(403);
    expect(repo.insertGmContent).not.toHaveBeenCalled();
    expect(repo.updateGmContent).not.toHaveBeenCalled();
    expect(repo.deleteGmContent).not.toHaveBeenCalled();
  });

  it('lets a Content Admin who runs no campaign through', async () => {
    const res = await request(appAs(admin)).get('/gm-content');
    expect(res.status).toBe(200);
    expect(repo.listMembershipsWithCampaignForUser).not.toHaveBeenCalled();
  });
});

describe('GET /gm-content', () => {
  it('returns own rows plus every site-wide row, and hides another GM’s Mine rows', async () => {
    rows.push(
      row({ id: 'gvil-mine', ownerUserId: 'u-mike', data: { Name: 'zeta the Mine' } }),
      row({ id: 'gvil-theirs-mine', ownerUserId: 'u-ryan', data: { Name: 'Ryan Private' } }),
      row({ id: 'gvil-theirs-site', ownerUserId: 'u-ryan', scope: 'SiteWide', data: { Name: 'Alpha Shared' } }),
      row({ id: 'gnpc-mine', kind: 'npc', ownerUserId: 'u-mike', data: { Name: 'Bram' } }),
      row({ id: 'gnpc-theirs-mine', kind: 'npc', ownerUserId: 'u-ryan', data: { Name: 'Hidden' } }),
    );

    const res = await request(appAs(mike)).get('/gm-content');

    expect(res.status).toBe(200);
    const body = res.body as GmContentList;
    expect(body.villains.map((v) => v.Id)).toEqual(['gvil-theirs-site', 'gvil-mine']); // sorted by Name, case-insensitive
    expect(body.npcs.map((n) => n.Id)).toEqual(['gnpc-mine']);
    expect(repo.listGmContentVisibleToUser).toHaveBeenCalledWith('u-mike');
  });

  it('builds Custom from the row columns, ignores any Id/Custom in the stored blob, and applies read-time defaults', async () => {
    rows.push(
      row({
        id: 'gvil-site',
        ownerUserId: 'u-ryan',
        scope: 'SiteWide',
        data: { Id: 'forged', Name: 'Shared', Custom: { OwnerUserId: 'u-mike', OwnerName: 'Mike', Scope: 'Mine' } },
      }),
    );

    const res = await request(appAs(mike)).get('/gm-content');

    const v = (res.body as GmContentList).villains[0];
    expect(v.Id).toBe('gvil-site');
    expect(v.Custom).toEqual({ OwnerUserId: 'u-ryan', OwnerName: 'Ryan', Scope: 'SiteWide' });
    expect(v.Aspects).toEqual([]); // normalizeGmContentData backfill
    expect(v.Goal).toBe('');
  });

  it('falls back to "Unknown" for an owner with no profile', async () => {
    rows.push(row({ id: 'gvil-orphan', ownerUserId: 'u-gone', scope: 'SiteWide', data: { Name: 'Orphan' } }));
    const res = await request(appAs(mike)).get('/gm-content');
    expect((res.body as GmContentList).villains[0].Custom?.OwnerName).toBe('Unknown');
  });
});

describe('POST /gm-content', () => {
  it('creates a Villain with a real seeded stat block, a gvil- Id, and Custom from the row', async () => {
    const res = await request(appAs(mike))
      .post('/gm-content')
      .send({
        kind: 'villain',
        scope: 'SiteWide',
        data: { Name: 'Grizza’s Cousin', Aspects: ['Tall'], Stats: grizzaStats, Id: 'vil-spoof', Custom: { OwnerUserId: 'u-ryan', OwnerName: 'Ryan', Scope: 'Mine' }, Bogus: 1 },
      });

    expect(res.status).toBe(201);
    const entry = res.body.entry as Villain;
    expect(entry.Id).toMatch(/^gvil-/);
    expect(entry.Name).toBe('Grizza’s Cousin');
    expect(entry.Stats).toEqual(grizzaStats);
    expect(entry.Custom).toEqual({ OwnerUserId: 'u-mike', OwnerName: 'Mike', Scope: 'SiteWide' });
    // The stored blob carries neither Id, Custom, nor a non-schema key.
    const stored = vi.mocked(repo.insertGmContent).mock.calls[0][0];
    expect(stored.ownerUserId).toBe('u-mike');
    expect(stored.scope).toBe('SiteWide');
    expect(stored.data).not.toHaveProperty('Id');
    expect(stored.data).not.toHaveProperty('Custom');
    expect(stored.data).not.toHaveProperty('Bogus');
  });

  it('creates an NPC with a gnpc- Id, including a write-in Type (informational, not an error)', async () => {
    const res = await request(appAs(mike))
      .post('/gm-content')
      .send({ kind: 'npc', scope: 'Mine', data: { Name: 'Skreel Jr.', Type: 'Rival Cook', IsCombatant: true, Stats: skreelStats } });

    expect(res.status).toBe(201);
    const entry = res.body.entry as NPC;
    expect(entry.Id).toMatch(/^gnpc-/);
    expect(entry.Type).toBe('Rival Cook');
    expect(entry.Custom).toEqual({ OwnerUserId: 'u-mike', OwnerName: 'Mike', Scope: 'Mine' });
  });

  it('lets a Villain be saved with no stat block at all', async () => {
    const res = await request(appAs(mike)).post('/gm-content').send({ kind: 'villain', scope: 'Mine', data: { Name: 'Plain' } });
    expect(res.status).toBe(201);
  });

  it('400s a missing Name', async () => {
    const res = await request(appAs(mike)).post('/gm-content').send({ kind: 'villain', scope: 'Mine', data: { Goal: 'No name' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Name/);
    expect(repo.insertGmContent).not.toHaveBeenCalled();
  });

  it('400s a wrongly typed field', async () => {
    const res = await request(appAs(mike)).post('/gm-content').send({ kind: 'villain', scope: 'Mine', data: { Name: 'X', Aspects: 'not a list' } });
    expect(res.status).toBe(400);
    expect(repo.insertGmContent).not.toHaveBeenCalled();
  });

  it('400s a bad stat block, and does not store it', async () => {
    const bad = { ...grizzaStats, Profile: 'Mythic', Threat: -1 };
    const res = await request(appAs(mike)).post('/gm-content').send({ kind: 'villain', scope: 'Mine', data: { Name: 'Bad', Stats: bad } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Profile must be one of/);
    expect(res.body.error).toMatch(/Threat must be a number/);
    expect(repo.insertGmContent).not.toHaveBeenCalled();
  });

  it('400s a stat block with an unknown Virtue', async () => {
    const bad = { ...grizzaStats, Virtues: [{ VirtueId: 'v-nonsense', Rating: 0 }] };
    const res = await request(appAs(mike)).post('/gm-content').send({ kind: 'villain', scope: 'Mine', data: { Name: 'Bad', Stats: bad } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown VirtueId/);
  });

  it('400s a non-object Stats value', async () => {
    const res = await request(appAs(mike)).post('/gm-content').send({ kind: 'villain', scope: 'Mine', data: { Name: 'Bad', Stats: 'strong' } });
    expect(res.status).toBe(400);
  });

  it('400s a bad kind, a bad scope, and a non-object data', async () => {
    const app = appAs(mike);
    expect((await request(app).post('/gm-content').send({ kind: 'location', scope: 'Mine', data: { Name: 'X' } })).status).toBe(400);
    expect((await request(app).post('/gm-content').send({ kind: 'npc', scope: 'Everyone', data: { Name: 'X' } })).status).toBe(400);
    expect((await request(app).post('/gm-content').send({ kind: 'npc', scope: 'Mine', data: ['Name'] })).status).toBe(400);
    expect((await request(app).post('/gm-content').send({ kind: 'npc', scope: 'Mine' })).status).toBe(400);
    expect(repo.insertGmContent).not.toHaveBeenCalled();
  });

  it('409s at the per-owner cap', async () => {
    vi.mocked(repo.countGmContentByOwner).mockResolvedValue(GM_CONTENT_OWNER_LIMIT);
    const res = await request(appAs(mike)).post('/gm-content').send({ kind: 'npc', scope: 'Mine', data: { Name: 'One too many' } });
    expect(res.status).toBe(409);
    expect(repo.insertGmContent).not.toHaveBeenCalled();
  });

  it('accepts the entry just under the cap', async () => {
    vi.mocked(repo.countGmContentByOwner).mockResolvedValue(GM_CONTENT_OWNER_LIMIT - 1);
    const res = await request(appAs(mike)).post('/gm-content').send({ kind: 'npc', scope: 'Mine', data: { Name: 'Last one' } });
    expect(res.status).toBe(201);
  });
});

describe('PUT /gm-content/:id', () => {
  it('lets the owner flip scope Mine to SiteWide and back', async () => {
    rows.push(row({ id: 'gvil-1', data: { Name: 'Keeper', Goal: 'Win' } }));
    const app = appAs(mike);

    const up = await request(app).put('/gm-content/gvil-1').send({ scope: 'SiteWide' });
    expect(up.status).toBe(200);
    expect(up.body.entry.Custom.Scope).toBe('SiteWide');
    expect(rows[0].scope).toBe('SiteWide');

    const down = await request(app).put('/gm-content/gvil-1').send({ scope: 'Mine' });
    expect(down.status).toBe(200);
    expect(down.body.entry.Custom.Scope).toBe('Mine');
  });

  it('merges a partial data patch over the stored data and drops non-schema keys', async () => {
    rows.push(row({ id: 'gvil-1', data: { Name: 'Keeper', Goal: 'Win', Aspects: ['Old'] } }));

    const res = await request(appAs(mike))
      .put('/gm-content/gvil-1')
      .send({ data: { Goal: 'Win harder', Id: 'vil-spoof', Custom: { OwnerUserId: 'u-ryan' }, Bogus: true } });

    expect(res.status).toBe(200);
    expect(res.body.entry.Name).toBe('Keeper');
    expect(res.body.entry.Goal).toBe('Win harder');
    expect(res.body.entry.Aspects).toEqual(['Old']);
    expect(res.body.entry.Id).toBe('gvil-1');
    expect(res.body.entry.Custom.OwnerUserId).toBe('u-mike');
    expect(rows[0].data).toEqual({ Name: 'Keeper', Goal: 'Win harder', Aspects: ['Old'] });
    expect(rows[0].updatedAt).not.toBe(NOW);
  });

  it('400s a patch that blanks Name, and one that makes the merged stat block invalid', async () => {
    rows.push(row({ id: 'gvil-1', data: { Name: 'Keeper', Stats: grizzaStats } }));
    const app = appAs(mike);

    const blank = await request(app).put('/gm-content/gvil-1').send({ data: { Name: '  ' } });
    expect(blank.status).toBe(400);

    const badBlock = await request(app).put('/gm-content/gvil-1').send({ data: { Stats: { ...grizzaStats, StrainBoxes: 0 } } });
    expect(badBlock.status).toBe(400);
    expect(badBlock.body.error).toMatch(/StrainBoxes/);
    expect(rows[0].data).toEqual({ Name: 'Keeper', Stats: grizzaStats });
  });

  it('400s a bad scope and an empty body', async () => {
    rows.push(row({ id: 'gvil-1', data: { Name: 'Keeper' } }));
    const app = appAs(mike);
    expect((await request(app).put('/gm-content/gvil-1').send({ scope: 'Everyone' })).status).toBe(400);
    expect((await request(app).put('/gm-content/gvil-1').send({})).status).toBe(400);
    expect(repo.updateGmContent).not.toHaveBeenCalled();
  });

  it('never changes kind or owner', async () => {
    rows.push(row({ id: 'gvil-1', data: { Name: 'Keeper' } }));
    const res = await request(appAs(mike)).put('/gm-content/gvil-1').send({ scope: 'SiteWide', kind: 'npc', ownerUserId: 'u-ryan' });
    expect(res.status).toBe(200);
    expect(rows[0].kind).toBe('villain');
    expect(rows[0].ownerUserId).toBe('u-mike');
  });

  it('403s another GM editing a site-wide row, with nothing changed', async () => {
    rows.push(row({ id: 'gvil-1', ownerUserId: 'u-ryan', scope: 'SiteWide', data: { Name: 'Shared' } }));
    const res = await request(appAs(mike)).put('/gm-content/gvil-1').send({ scope: 'Mine', data: { Name: 'Hijacked' } });
    expect(res.status).toBe(403);
    expect(repo.updateGmContent).not.toHaveBeenCalled();
    expect(rows[0].scope).toBe('SiteWide');
  });

  it('404s another GM’s Mine row, indistinguishable from a missing one', async () => {
    rows.push(row({ id: 'gvil-1', ownerUserId: 'u-ryan', scope: 'Mine', data: { Name: 'Private' } }));
    const app = appAs(mike);
    const theirs = await request(app).put('/gm-content/gvil-1').send({ scope: 'SiteWide' });
    const missing = await request(app).put('/gm-content/gvil-nope').send({ scope: 'SiteWide' });
    expect(theirs.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(theirs.body).toEqual(missing.body);
    expect(repo.updateGmContent).not.toHaveBeenCalled();
  });

  it('lets a Content Admin edit a site-wide row, but still not see another GM’s Mine row', async () => {
    rows.push(
      row({ id: 'gvil-site', ownerUserId: 'u-ryan', scope: 'SiteWide', data: { Name: 'Shared' } }),
      row({ id: 'gvil-priv', ownerUserId: 'u-ryan', scope: 'Mine', data: { Name: 'Private' } }),
    );
    const app = appAs(admin);

    const ok = await request(app).put('/gm-content/gvil-site').send({ data: { Name: 'Moderated' } });
    expect(ok.status).toBe(200);
    expect(ok.body.entry.Name).toBe('Moderated');
    expect(ok.body.entry.Custom.OwnerUserId).toBe('u-ryan'); // ownership does not transfer
    expect(ok.body.entry.Custom.OwnerName).toBe('Ryan');

    expect((await request(app).put('/gm-content/gvil-priv').send({ scope: 'SiteWide' })).status).toBe(404);
  });
});

describe('DELETE /gm-content/:id', () => {
  it('lets the owner delete their own row', async () => {
    rows.push(row({ id: 'gvil-1', data: { Name: 'Keeper' } }));
    const res = await request(appAs(mike)).delete('/gm-content/gvil-1');
    expect(res.status).toBe(204);
    expect(repo.deleteGmContent).toHaveBeenCalledWith('gvil-1');
  });

  it('403s another GM on a site-wide row', async () => {
    rows.push(row({ id: 'gvil-1', ownerUserId: 'u-ryan', scope: 'SiteWide', data: { Name: 'Shared' } }));
    const res = await request(appAs(mike)).delete('/gm-content/gvil-1');
    expect(res.status).toBe(403);
    expect(repo.deleteGmContent).not.toHaveBeenCalled();
  });

  it('404s another GM’s Mine row and a missing row', async () => {
    rows.push(row({ id: 'gvil-1', ownerUserId: 'u-ryan', scope: 'Mine', data: { Name: 'Private' } }));
    const app = appAs(mike);
    expect((await request(app).delete('/gm-content/gvil-1')).status).toBe(404);
    expect((await request(app).delete('/gm-content/gvil-nope')).status).toBe(404);
    expect(repo.deleteGmContent).not.toHaveBeenCalled();
  });

  it('lets a Content Admin delete a site-wide row', async () => {
    rows.push(row({ id: 'gvil-1', ownerUserId: 'u-ryan', scope: 'SiteWide', data: { Name: 'Shared' } }));
    const res = await request(appAs(admin)).delete('/gm-content/gvil-1');
    expect(res.status).toBe(204);
    expect(rows).toHaveLength(0);
  });
});

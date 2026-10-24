import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { normalizeParty, type Campaign, type Membership, type Party } from '@asohav/shared';

vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  listMemberships: vi.fn(),
  getSheet: vi.fn(),
  getParty: vi.fn(),
  saveParty: vi.fn(),
  // The Party PUT (also exercised below) reads these.
  getLibrary: vi.fn(),
}));

import * as repo from '../repo.js';
import { replacementHeroRouter } from './replacementHero.js';
import { partyRouter } from './party.js';
import { errorMiddleware } from '../errorMiddleware.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'U', email: 'u@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/replacement-hero', replacementHeroRouter);
  app.use('/campaigns/:campaignId/party', partyRouter);
  app.use(errorMiddleware);
  return app;
}

const campaign: Campaign = { Id: 'cm-1', Name: 'C', GmUserId: 'u-gm', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', Phase: 'Playing' };
const gm: Membership = { Id: 'mb-gm', UserId: 'u-gm', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const mike: Membership = { Id: 'mb-1', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-old' };
const ann: Membership = { Id: 'mb-2', UserId: 'u-ann', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ann' };
const makeParty = (ReplacementHeroFor?: string | null): Party => ({ Id: 'pt-1', CampaignId: 'cm-1', Rapport: 0, Drama: 1, RapportImprovementsTaken: [], History: [], PartyLevel: 0, Motif: '', Quest: '', SkillTags: [], WeaknessTags: [], MotifId: null, FlawTags: [], UsedTags: [], QuestKind: null, ActBreaks: 0, Forsakes: 0, Path: '', Goal: '', CampAssets: [], ReplacementHeroFor, UpdatedAt: '2026-01-01T00:00:00Z', UpdatedBy: null });
const sheetWith = (LifeState: 'Alive' | 'Dead' | 'Retired') => ({ CharacterId: 'x', LifeState }) as never;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.getCampaign).mockResolvedValue(campaign);
  vi.mocked(repo.membershipFor).mockResolvedValue(gm);
  vi.mocked(repo.listMemberships).mockResolvedValue([gm, mike, ann]);
  vi.mocked(repo.getParty).mockResolvedValue(makeParty(null));
  vi.mocked(repo.getSheet).mockImplementation(async (id: string) => sheetWith(id === 'ch-old' ? 'Dead' : 'Alive'));
});

describe('POST /campaigns/:id/replacement-hero', () => {
  it('opens the slot for a player whose Hero is Dead', async () => {
    const res = await request(appAs('u-gm')).post('/campaigns/cm-1/replacement-hero').send({ UserId: 'u-mike' });
    expect(res.status).toBe(200);
    expect(res.body.party.ReplacementHeroFor).toBe('u-mike');
    expect(repo.saveParty).toHaveBeenCalledWith(expect.objectContaining({ ReplacementHeroFor: 'u-mike' }));
  });

  it('opens it for a Retired Hero too', async () => {
    vi.mocked(repo.getSheet).mockResolvedValue(sheetWith('Retired'));
    const res = await request(appAs('u-gm')).post('/campaigns/cm-1/replacement-hero').send({ UserId: 'u-ann' });
    expect(res.status).toBe(200);
  });

  it('is GM-only', async () => {
    vi.mocked(repo.membershipFor).mockResolvedValue(mike);
    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/replacement-hero').send({ UserId: 'u-mike' });
    expect(res.status).toBe(403);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('refuses a player whose Hero is Alive', async () => {
    const res = await request(appAs('u-gm')).post('/campaigns/cm-1/replacement-hero').send({ UserId: 'u-ann' });
    expect(res.status).toBe(409);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('refuses a player with no Hero, the GM membership and an unknown user', async () => {
    vi.mocked(repo.listMemberships).mockResolvedValue([gm, { ...mike, CharacterId: null }]);
    expect((await request(appAs('u-gm')).post('/campaigns/cm-1/replacement-hero').send({ UserId: 'u-mike' })).status).toBe(409);
    expect((await request(appAs('u-gm')).post('/campaigns/cm-1/replacement-hero').send({ UserId: 'u-gm' })).status).toBe(404);
    expect((await request(appAs('u-gm')).post('/campaigns/cm-1/replacement-hero').send({ UserId: 'u-nobody' })).status).toBe(404);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('refuses on an archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue({ ...campaign, Status: 'Archived' });
    const res = await request(appAs('u-gm')).post('/campaigns/cm-1/replacement-hero').send({ UserId: 'u-mike' });
    expect(res.status).toBe(409);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('refuses a second open slot for another player, but re-opening the same player is fine', async () => {
    vi.mocked(repo.getParty).mockResolvedValue(makeParty('u-ann'));
    expect((await request(appAs('u-gm')).post('/campaigns/cm-1/replacement-hero').send({ UserId: 'u-mike' })).status).toBe(409);
    vi.mocked(repo.getParty).mockResolvedValue(makeParty('u-mike'));
    expect((await request(appAs('u-gm')).post('/campaigns/cm-1/replacement-hero').send({ UserId: 'u-mike' })).status).toBe(200);
  });
});

describe('DELETE /campaigns/:id/replacement-hero', () => {
  it('cancels an open slot', async () => {
    vi.mocked(repo.getParty).mockResolvedValue(makeParty('u-mike'));
    const res = await request(appAs('u-gm')).delete('/campaigns/cm-1/replacement-hero');
    expect(res.status).toBe(200);
    expect(repo.saveParty).toHaveBeenCalledWith(expect.objectContaining({ ReplacementHeroFor: null }));
  });

  it('is GM-only and refused on an archived campaign', async () => {
    vi.mocked(repo.membershipFor).mockResolvedValue(mike);
    expect((await request(appAs('u-mike')).delete('/campaigns/cm-1/replacement-hero')).status).toBe(403);
    vi.mocked(repo.membershipFor).mockResolvedValue(gm);
    vi.mocked(repo.getCampaign).mockResolvedValue({ ...campaign, Status: 'Archived' });
    expect((await request(appAs('u-gm')).delete('/campaigns/cm-1/replacement-hero')).status).toBe(409);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });
});

describe('Party PUT cannot open a replacement slot', () => {
  it('keeps the stored value', async () => {
    vi.mocked(repo.membershipFor).mockResolvedValue(mike);
    vi.mocked(repo.getParty).mockResolvedValue(makeParty(null));
    vi.mocked(repo.getLibrary).mockResolvedValue({ settings: { RapportTrackLength: 5 } } as never);
    const res = await request(appAs('u-mike')).put('/campaigns/cm-1/party').send({ ReplacementHeroFor: 'u-mike' });
    expect(res.status).toBe(200);
    expect(repo.saveParty).toHaveBeenCalledWith(expect.objectContaining({ ReplacementHeroFor: null }));
  });
});

describe('normalizeParty', () => {
  it('defaults ReplacementHeroFor to null on a row saved before it existed', () => {
    const old = makeParty();
    delete (old as { ReplacementHeroFor?: unknown }).ReplacementHeroFor;
    expect(normalizeParty(old).ReplacementHeroFor).toBeNull();
    expect(normalizeParty(makeParty('u-mike')).ReplacementHeroFor).toBe('u-mike');
  });
});

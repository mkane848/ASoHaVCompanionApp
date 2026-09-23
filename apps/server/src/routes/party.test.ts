import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { seedLibrary } from '@asohav/shared';
import type { Campaign, Membership, Party } from '@asohav/shared';

// Scoped to the archive-freeze check added to PUT — the rest of party.ts predates this PR.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  getParty: vi.fn(),
  saveParty: vi.fn(),
  // The Misfortune route names who changed it on Party History.
  getCharacter: vi.fn(),
  // Added `0.28.0`: PUT reads the library to bound Rapport, now that Aid makes it a live spend
  // surface rather than a display-only counter.
  getLibrary: vi.fn(),
}));

import * as repo from '../repo.js';
import { partyRouter } from './party.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Ryan', email: 'ryan@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/party', partyRouter);
  return app;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', ...overrides };
}

const membership: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };
const party: Party = { Id: 'pt-1', CampaignId: 'cm-1', Rapport: 2, Misfortune: 1, RapportImprovementsTaken: [], History: [], PartyLevel: 0, Motif: '', Quest: '', SkillTags: [], WeaknessTags: [], Path: '', Goal: '', CampAssets: [], UpdatedAt: '2026-01-01T00:00:00Z', UpdatedBy: null };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.membershipFor).mockResolvedValue(membership);
  vi.mocked(repo.getParty).mockResolvedValue(party);
  vi.mocked(repo.getCharacter).mockResolvedValue({ Id: 'ch-ember', Name: 'Ember' } as never);
  vi.mocked(repo.getLibrary).mockResolvedValue({ ...seedLibrary(), settings: { ...seedLibrary().settings, RapportTrackLength: 5 } });
});

describe('PUT /campaigns/:campaignId/party', () => {
  it('saves the party on an Active campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ Rapport: 3 });

    expect(res.status).toBe(200);
    expect(repo.saveParty).toHaveBeenCalled();
  });

  it('refuses to save the party on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ Rapport: 3 });

    expect(res.status).toBe(409);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });
});

describe('PUT /campaigns/:campaignId/party — Rapport bounds', () => {
  // Before `0.28.0` this route validated nothing at all: a client could persist Rapport: 9999 or
  // a negative and it stuck. Harmless while Rapport was a counter; not once Aid spends it. The floor
  // (0) still applies. The ceiling does not: V0.6 slice 7 lets overflow bank until Make Camp, and
  // the cap this route kept silently discarded it on every save (HANDOFF open issue 24).
  it('keeps Rapport above the track length (overflow banks until Make Camp)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Rapport: 13 });

    expect(res.status).toBe(200);
    expect(res.body.party.Rapport).toBe(13);
    expect(vi.mocked(repo.saveParty).mock.calls[0][0].Rapport).toBe(13);
  });

  it('clamps a negative Rapport up to 0', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Rapport: -4 });

    expect(res.status).toBe(200);
    expect(res.body.party.Rapport).toBe(0);
  });

  it('leaves an in-range value alone', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Rapport: 3 });

    expect(res.status).toBe(200);
    expect(res.body.party.Rapport).toBe(3);
  });

  it('preserves the stored Misfortune value when client sends a different one', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Misfortune: 99 });

    expect(res.status).toBe(200);
    expect(res.body.party.Misfortune).toBe(1); // stored value, not client's 99
    expect(vi.mocked(repo.saveParty).mock.calls[0][0].Misfortune).toBe(1);
  });
});

describe('POST /campaigns/:campaignId/party/misfortune', () => {
  it('lets a player Gain Misfortune with a note', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const testParty = { ...party, Misfortune: 2, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Gain', Note: 'Rolled a 6-.' });

    expect(res.status).toBe(200);
    expect(res.body.party.Misfortune).toBe(3); // 2 + 1
    expect(res.body.party.History[0].Effect).toContain('Rolled a 6-.');
    expect(res.body.party.History[0].By).toBe('Ember'); // the player's Hero, not their user id
    expect(vi.mocked(repo.saveParty).mock.calls[0][0].Misfortune).toBe(3);
  });

  it('rejects a player Gain without a note', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.getParty).mockResolvedValue({ ...party, History: [] });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Gain', Note: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Say what earned/);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('rejects a player trying to Spend (GM only)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(membership); // Player role

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Spend' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only the GM/);
  });

  it('lets the GM Spend Misfortune with default note', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Misfortune: 3, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Spend' });

    expect(res.status).toBe(200);
    expect(res.body.party.Misfortune).toBe(2); // 3 - 1
    expect(res.body.party.History[0].Effect).toContain('A Hard Move');
    expect(res.body.party.History[0].By).toBe('The GM');
  });

  it('lets the GM Spend with a custom note', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Misfortune: 4, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Spend', Note: 'Ambush!' });

    expect(res.status).toBe(200);
    expect(res.body.party.Misfortune).toBe(3); // 4 - 1
    expect(res.body.party.History[0].Effect).toContain('Ambush!');
  });

  it('returns 409 when the GM tries to Spend at 0', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Misfortune: 0, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Spend' });

    expect(res.status).toBe(409);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('lets the GM Reset Misfortune from 5 to 1', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Misfortune: 5, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Reset' });

    expect(res.status).toBe(200);
    expect(res.body.party.Misfortune).toBe(1);
  });

  it('lets the GM call BeginSession from 0 to 1', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Misfortune: 0, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'BeginSession' });

    expect(res.status).toBe(200);
    expect(res.body.party.Misfortune).toBe(1);
  });

  it('lets the GM call BeginSession without changing Misfortune if already above 0', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Misfortune: 3, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'BeginSession' });

    expect(res.status).toBe(200);
    expect(res.body.party.Misfortune).toBe(3);
  });

  it('rejects an invalid Action', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'InvalidAction' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid/);
  });

  it('404s for an unknown campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(null);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Gain', Note: 'test' });

    expect(res.status).toBe(404);
  });

  it('403s for a non-member', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(null);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Gain', Note: 'test' });

    expect(res.status).toBe(403);
  });

  it('404s if no party exists', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.getParty).mockResolvedValue(null);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Gain', Note: 'test' });

    expect(res.status).toBe(404);
  });

  it('409s on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(membership);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Gain', Note: 'test' });

    expect(res.status).toBe(409);
  });
});

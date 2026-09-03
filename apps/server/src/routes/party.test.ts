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
const party: Party = { Id: 'pt-1', CampaignId: 'cm-1', Rapport: 2, RapportImprovementsTaken: [], History: [], PartyLevel: 0, Motif: '', Quest: '', SkillTags: [], WeaknessTags: [], Path: '', Goal: '', CampAssets: [], UpdatedAt: '2026-01-01T00:00:00Z', UpdatedBy: null };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.membershipFor).mockResolvedValue(membership);
  vi.mocked(repo.getParty).mockResolvedValue(party);
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
  // a negative and it stuck. Harmless while Rapport was a counter; not once Aid spends it.
  it('clamps Rapport down to the track length', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Rapport: 9999 });

    expect(res.status).toBe(200);
    expect(res.body.party.Rapport).toBe(5);
    expect(vi.mocked(repo.saveParty).mock.calls[0][0].Rapport).toBe(5);
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
});

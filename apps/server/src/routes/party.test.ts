import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign, Membership, Party } from '@asohav/shared';

// Scoped to the archive-freeze check added to PUT — the rest of party.ts predates this PR.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  getParty: vi.fn(),
  saveParty: vi.fn(),
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
const party: Party = { Id: 'pt-1', CampaignId: 'cm-1', Rapport: 2, RapportAdvancementsTaken: [], History: [], UpdatedAt: '2026-01-01T00:00:00Z', UpdatedBy: null };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.membershipFor).mockResolvedValue(membership);
  vi.mocked(repo.getParty).mockResolvedValue(party);
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

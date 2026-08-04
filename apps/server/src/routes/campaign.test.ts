import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign, Membership } from '@asohav/shared';

// Covers the routes added/changed in the admin-delete and archive-campaign PRs — the rest of
// campaign.ts (create, bootstrap, invite send/revoke's happy path) predates these changes and
// isn't the subject of this test file.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  membershipFor: vi.fn(),
  updateCampaignStatus: vi.fn(),
  insertInvite: vi.fn(),
}));

import * as repo from '../repo.js';
import { campaignRouter } from './campaign.js';

function appAs(isAdmin: boolean) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'u-mike', name: 'Mike', email: 'mike@asohav.dev', isAdmin };
    next();
  });
  app.use('/campaigns', campaignRouter);
  return app;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', ...overrides };
}

const gmMembership: Membership = { Id: 'mb-1', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const playerMembership: Membership = { Id: 'mb-2', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-1' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('DELETE /campaigns/:id', () => {
  it('deletes the campaign for a content admin', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());

    const res = await request(appAs(true)).delete('/campaigns/cm-1');

    expect(res.status).toBe(200);
    expect(repo.deleteCampaign).toHaveBeenCalledWith('cm-1');
  });

  it('403s a non-admin, even the campaign\'s own GM', async () => {
    const res = await request(appAs(false)).delete('/campaigns/cm-1');

    expect(res.status).toBe(403);
    expect(repo.deleteCampaign).not.toHaveBeenCalled();
  });

  it('404s an unknown campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(null);

    const res = await request(appAs(true)).delete('/campaigns/nope');

    expect(res.status).toBe(404);
    expect(repo.deleteCampaign).not.toHaveBeenCalled();
  });
});

describe('PATCH /campaigns/:id/status', () => {
  it('lets the GM archive their campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/status').send({ status: 'Archived' });

    expect(res.status).toBe(200);
    expect(repo.updateCampaignStatus).toHaveBeenCalledWith('cm-1', 'Archived');
    expect(res.body.campaign.Status).toBe('Archived');
  });

  it('lets the GM unarchive their campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/status').send({ status: 'Active' });

    expect(res.status).toBe(200);
    expect(repo.updateCampaignStatus).toHaveBeenCalledWith('cm-1', 'Active');
  });

  it('refuses a Player membership', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/status').send({ status: 'Archived' });

    expect(res.status).toBe(403);
    expect(repo.updateCampaignStatus).not.toHaveBeenCalled();
  });

  it('rejects an invalid status value', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/status').send({ status: 'Deleted' });

    expect(res.status).toBe(400);
    expect(repo.updateCampaignStatus).not.toHaveBeenCalled();
  });
});

describe('POST /campaigns/:id/invites archive freeze', () => {
  it('refuses to send a new invite on an archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs(false)).post('/campaigns/cm-1/invites').send({ email: 'new@asohav.dev' });

    expect(res.status).toBe(409);
    expect(repo.insertInvite).not.toHaveBeenCalled();
  });

  it('still allows sending an invite on an Active campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs(false)).post('/campaigns/cm-1/invites').send({ email: 'new@asohav.dev' });

    expect(res.status).toBe(200);
    expect(repo.insertInvite).toHaveBeenCalled();
  });
});

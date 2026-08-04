import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign } from '@asohav/shared';

// Only the admin-delete route added in this PR is covered here — the rest of campaign.ts
// predates this change and isn't the subject of this test file.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
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

const campaign: Campaign = { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('DELETE /campaigns/:id', () => {
  it('deletes the campaign for a content admin', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(campaign);

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

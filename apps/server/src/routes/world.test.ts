import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { newWorld } from '@asohav/shared';
import type { Campaign, Membership, World } from '@asohav/shared';

vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  getWorld: vi.fn(),
  saveWorld: vi.fn(),
}));

import * as repo from '../repo.js';
import { worldRouter } from './world.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Ryan', email: 'ryan@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/world', worldRouter);
  return app;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', ...overrides };
}

const membership: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };
const world: World = newWorld('cm-1');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.membershipFor).mockResolvedValue(membership);
  vi.mocked(repo.getWorld).mockResolvedValue(world);
});

describe('PUT /campaigns/:campaignId/world', () => {
  it('saves the world for a Player member (fully collaborative, no role gate)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/world').send({ Concept: 'A crew of sky pirates.' });

    expect(res.status).toBe(200);
    expect(res.body.world.Concept).toBe('A crew of sky pirates.');
    expect(repo.saveWorld).toHaveBeenCalled();
  });

  it('refuses a non-member', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(null);

    const res = await request(appAs('u-stranger')).put('/campaigns/cm-1/world').send({ Concept: 'x' });

    expect(res.status).toBe(403);
    expect(repo.saveWorld).not.toHaveBeenCalled();
  });

  it('refuses to save on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/world').send({ Concept: 'x' });

    expect(res.status).toBe(409);
    expect(repo.saveWorld).not.toHaveBeenCalled();
  });

  it('creates a fresh World when none exists yet (self-heal, same shape as bootstrap)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.getWorld).mockResolvedValue(null);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/world').send({ Concept: 'A fresh start.' });

    expect(res.status).toBe(200);
    expect(res.body.world.Concept).toBe('A fresh start.');
    expect(res.body.world.Id).toBe('wd-cm-1');
  });

  it('preserves the existing Id and CampaignId regardless of what the client sends', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/world').send({ ...world, Id: 'wd-hacked', CampaignId: 'cm-hacked' });

    expect(res.status).toBe(200);
    expect(res.body.world.Id).toBe(world.Id);
    expect(res.body.world.CampaignId).toBe('cm-1');
  });
});

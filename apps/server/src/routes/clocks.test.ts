import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign, Clock, Membership } from '@asohav/shared';

vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  listClocksForCampaign: vi.fn(),
  saveClock: vi.fn(),
  deleteClock: vi.fn(),
}));

import * as repo from '../repo.js';
import { clocksRouter } from './clocks.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Mike', email: 'mike@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/clocks', clocksRouter);
  return app;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', ...overrides };
}

const gmMembership: Membership = { Id: 'mb-gm', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const playerMembership: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };

function makeClock(overrides: Partial<Clock> = {}): Clock {
  return {
    Id: 'clk-1',
    CampaignId: 'cm-1',
    Title: 'Castle',
    Kind: 'Opposition',
    Segments: 4,
    SuccessMarks: 0,
    FailureMarks: 0,
    Goal: '',
    SkillTags: [],
    Developments: [],
    PromotedToBoard: false,
    Status: 'Open',
    History: [],
    CreatedAt: '2026-01-01T00:00:00Z',
    UpdatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /campaigns/:campaignId/clocks', () => {
  it('lets the GM make a Clock', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/clocks').send({ title: 'Castle', kind: 'Opposition' });

    expect(res.status).toBe(201);
    expect(res.body.clock.Title).toBe('Castle');
    expect(res.body.clock.Kind).toBe('Opposition');
    expect(res.body.clock.Segments).toBe(4);
    expect(repo.saveClock).toHaveBeenCalled();
  });

  it('accepts a custom Segments count', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/clocks').send({ title: 'Long War', kind: 'Threat', segments: 8 });

    expect(res.status).toBe(201);
    expect(res.body.clock.Segments).toBe(8);
  });

  it('refuses a non-GM', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/clocks').send({ title: 'Castle', kind: 'Opposition' });

    expect(res.status).toBe(403);
    expect(repo.saveClock).not.toHaveBeenCalled();
  });

  it('rejects a missing title', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/clocks').send({ title: '  ', kind: 'Opposition' });

    expect(res.status).toBe(400);
    expect(repo.saveClock).not.toHaveBeenCalled();
  });

  it('rejects an invalid Kind', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/clocks').send({ title: 'Castle', kind: 'Nonsense' });

    expect(res.status).toBe(400);
    expect(repo.saveClock).not.toHaveBeenCalled();
  });

  it('refuses on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/clocks').send({ title: 'Castle', kind: 'Opposition' });

    expect(res.status).toBe(409);
    expect(repo.saveClock).not.toHaveBeenCalled();
  });
});

describe('PUT /campaigns/:campaignId/clocks/:clockId', () => {
  it('lets any campaign member progress a Clock (any Hero may roll against an Opposition Clock)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);
    vi.mocked(repo.listClocksForCampaign).mockResolvedValue([makeClock()]);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/clocks/clk-1').send({ SuccessMarks: 2 });

    expect(res.status).toBe(200);
    expect(res.body.clock.SuccessMarks).toBe(2);
    expect(repo.saveClock).toHaveBeenCalled();
  });

  it("can't be redirected to a different campaign through the body", async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);
    vi.mocked(repo.listClocksForCampaign).mockResolvedValue([makeClock()]);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/clocks/clk-1').send({ CampaignId: 'cm-evil' });

    expect(res.status).toBe(200);
    expect(res.body.clock.CampaignId).toBe('cm-1');
  });

  it('404s for an unknown Clock', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);
    vi.mocked(repo.listClocksForCampaign).mockResolvedValue([]);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/clocks/clk-nope').send({});

    expect(res.status).toBe(404);
  });

  it('refuses a non-member', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(null);

    const res = await request(appAs('u-stranger')).put('/campaigns/cm-1/clocks/clk-1').send({});

    expect(res.status).toBe(403);
  });

  it('refuses on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/clocks/clk-1').send({});

    expect(res.status).toBe(409);
    expect(repo.saveClock).not.toHaveBeenCalled();
  });
});

describe('DELETE /campaigns/:campaignId/clocks/:clockId', () => {
  it('lets the GM remove a Clock', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.listClocksForCampaign).mockResolvedValue([makeClock()]);

    const res = await request(appAs('u-mike')).delete('/campaigns/cm-1/clocks/clk-1');

    expect(res.status).toBe(204);
    expect(repo.deleteClock).toHaveBeenCalledWith('clk-1');
  });

  it('refuses a non-GM', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs('u-ryan')).delete('/campaigns/cm-1/clocks/clk-1');

    expect(res.status).toBe(403);
    expect(repo.deleteClock).not.toHaveBeenCalled();
  });

  it('404s for an unknown Clock', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.listClocksForCampaign).mockResolvedValue([]);

    const res = await request(appAs('u-mike')).delete('/campaigns/cm-1/clocks/clk-nope');

    expect(res.status).toBe(404);
  });

  it('refuses on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).delete('/campaigns/cm-1/clocks/clk-1');

    expect(res.status).toBe(409);
    expect(repo.deleteClock).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Adventure, Campaign, Membership } from '@asohav/shared';

vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  listAdventuresForCampaign: vi.fn(),
  saveAdventure: vi.fn(),
  deleteAdventure: vi.fn(),
}));

import * as repo from '../repo.js';
import { adventuresRouter } from './adventures.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Mike', email: 'mike@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/adventures', adventuresRouter);
  return app;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', ...overrides };
}

const gmMembership: Membership = { Id: 'mb-gm', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const playerMembership: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };

function makeAdventure(overrides: Partial<Adventure> = {}): Adventure {
  return {
    Id: 'adv-1',
    CampaignId: 'cm-1',
    Concept: 'Goblins steal the blacksmith’s daughter.',
    Type: 'Mystery',
    Hook: 'Rosa barges in, pleading for help.',
    VillainId: null,
    NpcIds: [],
    LocationIds: [],
    Secrets: [],
    CountdownSteps: [
      { Name: 'Seed', Text: '' },
      { Name: 'Bloom', Text: '' },
      { Name: 'Wilt', Text: '' },
      { Name: 'Wither', Text: '' },
      { Name: 'Rot', Text: '' },
    ],
    CountdownMarks: 0,
    Status: 'Active',
    CreatedAt: '2026-01-01T00:00:00Z',
    UpdatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /campaigns/:campaignId/adventures', () => {
  it('lets the GM start an Adventure with all five Countdown steps pre-seeded', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike'))
      .post('/campaigns/cm-1/adventures')
      .send({ concept: 'Goblins steal the blacksmith’s daughter.', type: 'Mystery', hook: 'Rosa barges in.' });

    expect(res.status).toBe(201);
    expect(res.body.adventure.Concept).toBe('Goblins steal the blacksmith’s daughter.');
    expect(res.body.adventure.Type).toBe('Mystery');
    expect(res.body.adventure.CountdownSteps).toHaveLength(5);
    expect(res.body.adventure.CountdownMarks).toBe(0);
    expect(repo.saveAdventure).toHaveBeenCalled();
  });

  it('refuses a non-GM', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/adventures').send({ concept: 'Goblins.' });

    expect(res.status).toBe(403);
    expect(repo.saveAdventure).not.toHaveBeenCalled();
  });

  it('rejects a missing Concept', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/adventures').send({ concept: '  ' });

    expect(res.status).toBe(400);
    expect(repo.saveAdventure).not.toHaveBeenCalled();
  });

  it('rejects an invalid Type', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/adventures').send({ concept: 'Goblins.', type: 'Nonsense' });

    expect(res.status).toBe(400);
    expect(repo.saveAdventure).not.toHaveBeenCalled();
  });

  it('refuses on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/adventures').send({ concept: 'Goblins.' });

    expect(res.status).toBe(409);
    expect(repo.saveAdventure).not.toHaveBeenCalled();
  });
});

describe('PUT /campaigns/:campaignId/adventures/:adventureId', () => {
  it('lets the GM edit an Adventure', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.listAdventuresForCampaign).mockResolvedValue([makeAdventure()]);

    const res = await request(appAs('u-mike')).put('/campaigns/cm-1/adventures/adv-1').send({ VillainId: 'vil-grizza' });

    expect(res.status).toBe(200);
    expect(res.body.adventure.VillainId).toBe('vil-grizza');
    expect(repo.saveAdventure).toHaveBeenCalled();
  });

  it('refuses a non-GM (Adventures are GM-only, unlike Clocks)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);
    vi.mocked(repo.listAdventuresForCampaign).mockResolvedValue([makeAdventure()]);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/adventures/adv-1').send({ VillainId: 'vil-grizza' });

    expect(res.status).toBe(403);
    expect(repo.saveAdventure).not.toHaveBeenCalled();
  });

  it("can't be redirected to a different campaign through the body", async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.listAdventuresForCampaign).mockResolvedValue([makeAdventure()]);

    const res = await request(appAs('u-mike')).put('/campaigns/cm-1/adventures/adv-1').send({ CampaignId: 'cm-evil' });

    expect(res.status).toBe(200);
    expect(res.body.adventure.CampaignId).toBe('cm-1');
  });

  it('404s for an unknown Adventure', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.listAdventuresForCampaign).mockResolvedValue([]);

    const res = await request(appAs('u-mike')).put('/campaigns/cm-1/adventures/adv-nope').send({});

    expect(res.status).toBe(404);
  });

  it('refuses on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).put('/campaigns/cm-1/adventures/adv-1').send({});

    expect(res.status).toBe(409);
    expect(repo.saveAdventure).not.toHaveBeenCalled();
  });
});

describe('DELETE /campaigns/:campaignId/adventures/:adventureId', () => {
  it('lets the GM remove an Adventure', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.listAdventuresForCampaign).mockResolvedValue([makeAdventure()]);

    const res = await request(appAs('u-mike')).delete('/campaigns/cm-1/adventures/adv-1');

    expect(res.status).toBe(204);
    expect(repo.deleteAdventure).toHaveBeenCalledWith('adv-1');
  });

  it('refuses a non-GM', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs('u-ryan')).delete('/campaigns/cm-1/adventures/adv-1');

    expect(res.status).toBe(403);
    expect(repo.deleteAdventure).not.toHaveBeenCalled();
  });

  it('404s for an unknown Adventure', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.listAdventuresForCampaign).mockResolvedValue([]);

    const res = await request(appAs('u-mike')).delete('/campaigns/cm-1/adventures/adv-nope');

    expect(res.status).toBe(404);
  });

  it('refuses on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).delete('/campaigns/cm-1/adventures/adv-1');

    expect(res.status).toBe(409);
    expect(repo.deleteAdventure).not.toHaveBeenCalled();
  });
});

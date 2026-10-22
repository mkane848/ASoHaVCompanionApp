import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign, Character, Membership } from '@asohav/shared';

// Scoped to the archive-freeze check added to PUT — the rest of sheet.ts predates this PR.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  getSheet: vi.fn(),
  saveSheet: vi.fn(),
  getCharacter: vi.fn(),
}));

import * as repo from '../repo.js';
import { sheetRouter } from './sheet.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Ryan', email: 'ryan@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/sheets', sheetRouter);
  return app;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', ...overrides };
}

const character: Character = { Id: 'ch-ember', Name: 'Ember', Pronouns: 'she/her', PlayerName: 'Ryan', UserId: 'u-ryan', CampaignId: 'cm-1' };
const membership: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.membershipFor).mockResolvedValue(membership);
  vi.mocked(repo.getCharacter).mockResolvedValue(character);
});

describe('PUT /campaigns/:campaignId/sheets/:characterId', () => {
  it('refuses to overwrite a Dead or Retired Hero (read-only)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.getSheet).mockResolvedValue({ LifeState: 'Dead' } as unknown as Awaited<ReturnType<typeof repo.getSheet>>);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/sheets/ch-ember').send({ Looks: 'Back from the dead' });

    expect(res.status).toBe(409);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('saves the sheet on an Active campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/sheets/ch-ember').send({ Looks: 'Updated' });

    expect(res.status).toBe(200);
    expect(repo.saveSheet).toHaveBeenCalled();
  });

  it('refuses to save the sheet on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/sheets/ch-ember').send({ Looks: 'Updated' });

    expect(res.status).toBe(409);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });
});

describe('POST /campaigns/:campaignId/sheets/:characterId/clear-dying', () => {
  const gm: Membership = { Id: 'mb-gm', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
  const dyingSheet = () => ({ Id: 'sh-ch-ember', CharacterId: 'ch-ember', Dying: true, Strain: [false, false, false, false, false] }) as unknown as Awaited<ReturnType<typeof repo.getSheet>>;
  const url = '/campaigns/cm-1/sheets/ch-ember/clear-dying';

  it('lets the GM clear Dying and saves the sheet', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gm);
    vi.mocked(repo.getSheet).mockResolvedValue(dyingSheet());

    const res = await request(appAs('u-mike')).post(url);

    expect(res.status).toBe(200);
    expect(res.body.sheet.Dying).toBe(false);
    expect(repo.saveSheet).toHaveBeenCalledTimes(1);
  });

  it('does not write when the Hero is not Dying', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gm);
    vi.mocked(repo.getSheet).mockResolvedValue({ ...dyingSheet()!, Dying: false });

    const res = await request(appAs('u-mike')).post(url);

    expect(res.status).toBe(200);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('refuses a player (the owner clears their own through PUT)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.getSheet).mockResolvedValue(dyingSheet());

    const res = await request(appAs('u-ryan')).post(url);

    expect(res.status).toBe(403);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('refuses a non-member', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(null);

    const res = await request(appAs('u-stranger')).post(url);

    expect(res.status).toBe(403);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('is frozen on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gm);
    vi.mocked(repo.getSheet).mockResolvedValue(dyingSheet());

    const res = await request(appAs('u-mike')).post(url);

    expect(res.status).toBe(409);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it("404s for a character in another campaign", async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gm);
    vi.mocked(repo.getCharacter).mockResolvedValue({ ...character, CampaignId: 'cm-other' });

    const res = await request(appAs('u-mike')).post(url);

    expect(res.status).toBe(404);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });
});

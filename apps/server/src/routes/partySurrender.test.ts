import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign, Encounter, Membership, Party } from '@asohav/shared';

// V0.7 slice 8c: GM-only "Record Surrender" (`party.ts`). It only logs; Drama is a separate call.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  getParty: vi.fn(),
  saveParty: vi.fn(),
  getCharacter: vi.fn(),
  getLibrary: vi.fn(),
  getActiveEncounter: vi.fn(),
  saveEncounter: vi.fn(),
}));

import * as repo from '../repo.js';
import { partyRouter } from './party.js';
import { errorMiddleware } from '../errorMiddleware.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Mike', email: 'm@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/party', partyRouter);
  app.use(errorMiddleware);
  return app;
}

const campaign: Campaign = { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', Phase: 'Playing' };
const gm: Membership = { Id: 'mb-gm', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const player: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };
const makeParty = () => ({ Id: 'pt-1', CampaignId: 'cm-1', Drama: 2, History: [] }) as unknown as Party;
const makeEncounter = () => ({ Id: 'enc-1', CampaignId: 'cm-1', Status: 'Active', History: [{ Id: 'ch-0', At: 'a', Text: 'Combat began.' }] }) as unknown as Encounter;
const url = '/campaigns/cm-1/party/surrender';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.getCampaign).mockResolvedValue(campaign);
  vi.mocked(repo.membershipFor).mockResolvedValue(gm);
  vi.mocked(repo.getParty).mockResolvedValue(makeParty());
  vi.mocked(repo.getActiveEncounter).mockResolvedValue(null);
});

describe('POST /campaigns/:campaignId/party/surrender', () => {
  it('logs to the Party history when no Encounter is active, and leaves Drama alone', async () => {
    const res = await request(appAs('u-mike')).post(url).send({ Note: 'cornered in the vault' });
    expect(res.status).toBe(200);
    const saved = vi.mocked(repo.saveParty).mock.calls[0][0];
    expect(saved.History[0]).toMatchObject({ Name: 'Surrender', By: 'The GM' });
    expect(saved.History[0].Effect).toContain('cornered in the vault');
    expect(saved.Drama).toBe(2);
    expect(repo.saveEncounter).not.toHaveBeenCalled();
  });

  it('logs to the Combat log when an Encounter is active', async () => {
    vi.mocked(repo.getActiveEncounter).mockResolvedValue(makeEncounter());
    const res = await request(appAs('u-mike')).post(url).send({});
    expect(res.status).toBe(200);
    const saved = vi.mocked(repo.saveEncounter).mock.calls[0][0];
    expect(saved.History).toHaveLength(2);
    expect(saved.History[0].Text).toContain('surrendered');
    expect(saved.History[1].Text).toBe('Combat began.');
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('is GM only: a player and a non-member are refused', async () => {
    vi.mocked(repo.membershipFor).mockResolvedValue(player);
    expect((await request(appAs('u-ryan')).post(url).send({})).status).toBe(403);
    vi.mocked(repo.membershipFor).mockResolvedValue(null);
    expect((await request(appAs('u-eve')).post(url).send({})).status).toBe(403);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('is refused on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue({ ...campaign, Status: 'Archived' });
    const res = await request(appAs('u-mike')).post(url).send({});
    expect(res.status).toBe(409);
    expect(repo.saveParty).not.toHaveBeenCalled();
    expect(repo.saveEncounter).not.toHaveBeenCalled();
  });

  it('404s for an unknown campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(null);
    expect((await request(appAs('u-mike')).post(url).send({})).status).toBe(404);
  });
});

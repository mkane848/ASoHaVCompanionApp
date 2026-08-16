import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign, Membership, Party } from '@asohav/shared';

// Covers the routes added/changed in the admin-delete and archive-campaign PRs, plus (as of
// TechStackAudit.md G6) the /bootstrap route's listUsersByIds scoping — the rest of campaign.ts
// (create, invite send/revoke's happy path) predates these changes and isn't the subject of
// this test file.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  membershipFor: vi.fn(),
  updateCampaignStatus: vi.fn(),
  updateCampaignPhase: vi.fn(),
  updateMembershipReady: vi.fn(),
  insertInvite: vi.fn(),
  listMemberships: vi.fn(),
  listCharacters: vi.fn(),
  getParty: vi.fn(),
  saveParty: vi.fn(),
  listBondsForCampaign: vi.fn(),
  listUsersByIds: vi.fn(),
  listInvites: vi.fn(),
  getSheet: vi.fn(),
  getActiveEncounter: vi.fn(),
  getLibrary: vi.fn(),
  listSheetsForCampaign: vi.fn(),
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
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', Phase: 'Signup', ...overrides };
}

const gmMembership: Membership = { Id: 'mb-1', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const playerMembership: Membership = { Id: 'mb-2', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-1' };
const otherPlayerMembership: Membership = { Id: 'mb-3', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };

function makeParty(overrides: Partial<Party> = {}): Party {
  return { Id: 'pt-1', CampaignId: 'cm-1', Rapport: 0, RapportAdvancementsTaken: [], History: [], UpdatedAt: '2026-01-01T00:00:00Z', UpdatedBy: null, ...overrides };
}

describe('GET /campaigns/:id/bootstrap', () => {
  it('scopes users to this campaign\'s own membership list, not every registered account', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.listMemberships).mockResolvedValue([gmMembership, otherPlayerMembership]);
    vi.mocked(repo.listCharacters).mockResolvedValue([]);
    vi.mocked(repo.getParty).mockResolvedValue(makeParty());
    vi.mocked(repo.listBondsForCampaign).mockResolvedValue([]);
    vi.mocked(repo.listUsersByIds).mockResolvedValue([{ Id: 'u-mike', Name: 'Mike' }, { Id: 'u-ryan', Name: 'Ryan' }]);
    vi.mocked(repo.listInvites).mockResolvedValue([]);
    vi.mocked(repo.getActiveEncounter).mockResolvedValue(null);
    vi.mocked(repo.getLibrary).mockResolvedValue({} as any);
    vi.mocked(repo.listSheetsForCampaign).mockResolvedValue([]);

    const res = await request(appAs(false)).get('/campaigns/cm-1/bootstrap');

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([{ Id: 'u-mike', Name: 'Mike' }, { Id: 'u-ryan', Name: 'Ryan' }]);
    // The over-fetch fix this test guards (TechStackAudit.md B3/D2): scoped to this campaign's
    // member ids, not the unscoped listUsers() that used to ship every registered account.
    expect(repo.listUsersByIds).toHaveBeenCalledWith(['u-mike', 'u-ryan']);
  });

  it('404s for a campaign that does not exist', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(null);

    const res = await request(appAs(false)).get('/campaigns/cm-nope/bootstrap');

    expect(res.status).toBe(404);
  });
});

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

describe('PATCH /campaigns/:id/phase', () => {
  it('lets the GM close signup and start Party Creation', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'Signup' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/phase').send({ phase: 'PartyCreation' });

    expect(res.status).toBe(200);
    expect(repo.updateCampaignPhase).toHaveBeenCalledWith('cm-1', 'PartyCreation');
    expect(res.body.campaign.Phase).toBe('PartyCreation');
  });

  it('lets the GM start playing once the party is set up', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'PartyCreation' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/phase').send({ phase: 'Playing' });

    expect(res.status).toBe(200);
    expect(repo.updateCampaignPhase).toHaveBeenCalledWith('cm-1', 'Playing');
  });

  it('refuses to skip straight from Signup to Playing', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'Signup' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/phase').send({ phase: 'Playing' });

    expect(res.status).toBe(409);
    expect(repo.updateCampaignPhase).not.toHaveBeenCalled();
  });

  it('refuses a Player membership', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'Signup' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/phase').send({ phase: 'PartyCreation' });

    expect(res.status).toBe(403);
    expect(repo.updateCampaignPhase).not.toHaveBeenCalled();
  });

  it('rejects an invalid phase value', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'Signup' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/phase').send({ phase: 'Finished' });

    expect(res.status).toBe(400);
    expect(repo.updateCampaignPhase).not.toHaveBeenCalled();
  });
});

describe('PATCH /campaigns/:id/ready', () => {
  it('lets a player with a character mark themselves ready', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'PartyCreation' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/ready').send({ ready: true });

    expect(res.status).toBe(200);
    expect(repo.updateMembershipReady).toHaveBeenCalledWith('mb-2', true);
    expect(res.body.membership.Ready).toBe(true);
  });

  it('refuses a player with no character yet', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'PartyCreation' }));
    vi.mocked(repo.membershipFor).mockResolvedValue({ ...playerMembership, CharacterId: null });

    const res = await request(appAs(false)).patch('/campaigns/cm-1/ready').send({ ready: true });

    expect(res.status).toBe(409);
    expect(repo.updateMembershipReady).not.toHaveBeenCalled();
  });

  it('refuses the GM', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'PartyCreation' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs(false)).patch('/campaigns/cm-1/ready').send({ ready: true });

    expect(res.status).toBe(403);
    expect(repo.updateMembershipReady).not.toHaveBeenCalled();
  });
});

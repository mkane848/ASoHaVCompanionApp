import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign, Invite, Membership } from '@asohav/shared';

vi.mock('../repo.js', () => ({
  getInvite: vi.fn(),
  getInviteByCode: vi.fn(),
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  updateInviteStatus: vi.fn(),
  insertMembership: vi.fn(),
  listPendingInvitesForEmail: vi.fn(),
}));

import * as repo from '../repo.js';
import { invitesRouter } from './invites.js';

function appAs(email: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'u-mike', name: 'Mike', email, isAdmin: false };
    next();
  });
  app.use('/invites', invitesRouter);
  return app;
}

function pendingInvite(overrides: Partial<Invite> = {}): Invite {
  return {
    Id: 'inv-1',
    CampaignId: 'cm-2',
    Email: 'mike@asohav.dev',
    Code: 'ROAD-4242',
    SentAt: new Date().toISOString(),
    Status: 'Pending',
    ...overrides,
  };
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-2', Name: 'Seelie', GmUserId: 'u-ryan', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', ...overrides };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
});

describe('GET /invites/mine', () => {
  it('joins pending invites with their campaign name', async () => {
    vi.mocked(repo.listPendingInvitesForEmail).mockResolvedValue([pendingInvite()]);
    vi.mocked(repo.getCampaign).mockResolvedValue({ Id: 'cm-2', Name: 'Seelie', GmUserId: 'u-ryan', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active' });

    const res = await request(appAs('mike@asohav.dev')).get('/invites/mine');

    expect(res.status).toBe(200);
    expect(res.body.invites).toHaveLength(1);
    expect(res.body.invites[0].CampaignName).toBe('Seelie');
  });
});

describe('POST /invites/:id/redeem', () => {
  it('creates a Player membership and marks the invite Accepted', async () => {
    vi.mocked(repo.getInvite).mockResolvedValue(pendingInvite());
    vi.mocked(repo.membershipFor).mockResolvedValue(null);

    const res = await request(appAs('mike@asohav.dev')).post('/invites/inv-1/redeem');

    expect(res.status).toBe(200);
    expect(res.body.membership).toMatchObject({ CampaignId: 'cm-2', Role: 'Player', CharacterId: null });
    expect(repo.insertMembership).toHaveBeenCalledWith(expect.objectContaining({ UserId: 'u-mike', CampaignId: 'cm-2', Role: 'Player' }));
    expect(repo.updateInviteStatus).toHaveBeenCalledWith('inv-1', 'Accepted');
  });

  it('rejects when the signed-in email does not match the invite', async () => {
    vi.mocked(repo.getInvite).mockResolvedValue(pendingInvite({ Email: 'someone-else@asohav.dev' }));

    const res = await request(appAs('mike@asohav.dev')).post('/invites/inv-1/redeem');

    expect(res.status).toBe(403);
    expect(repo.insertMembership).not.toHaveBeenCalled();
  });

  it('rejects an already-accepted invite', async () => {
    vi.mocked(repo.getInvite).mockResolvedValue(pendingInvite({ Status: 'Accepted' }));

    const res = await request(appAs('mike@asohav.dev')).post('/invites/inv-1/redeem');

    expect(res.status).toBe(403);
  });

  it('refuses to double-join a campaign the user is already a member of', async () => {
    vi.mocked(repo.getInvite).mockResolvedValue(pendingInvite());
    const existing: Membership = { Id: 'mb-1', UserId: 'u-mike', CampaignId: 'cm-2', Role: 'Player', CharacterId: null };
    vi.mocked(repo.membershipFor).mockResolvedValue(existing);

    const res = await request(appAs('mike@asohav.dev')).post('/invites/inv-1/redeem');

    expect(res.status).toBe(409);
    expect(repo.insertMembership).not.toHaveBeenCalled();
  });

  it('404s for an unknown invite id', async () => {
    vi.mocked(repo.getInvite).mockResolvedValue(null);

    const res = await request(appAs('mike@asohav.dev')).post('/invites/nope/redeem');

    expect(res.status).toBe(404);
  });

  it('refuses to join an archived campaign', async () => {
    vi.mocked(repo.getInvite).mockResolvedValue(pendingInvite());
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));

    const res = await request(appAs('mike@asohav.dev')).post('/invites/inv-1/redeem');

    expect(res.status).toBe(409);
    expect(repo.insertMembership).not.toHaveBeenCalled();
  });
});

describe('POST /invites/redeem-by-code', () => {
  it('resolves the invite by code and redeems it', async () => {
    vi.mocked(repo.getInviteByCode).mockResolvedValue(pendingInvite());
    vi.mocked(repo.membershipFor).mockResolvedValue(null);

    const res = await request(appAs('mike@asohav.dev')).post('/invites/redeem-by-code').send({ code: 'road-4242' });

    expect(res.status).toBe(200);
    expect(repo.getInviteByCode).toHaveBeenCalledWith('road-4242');
    expect(repo.updateInviteStatus).toHaveBeenCalledWith('inv-1', 'Accepted');
  });

  it('400s on an empty code', async () => {
    const res = await request(appAs('mike@asohav.dev')).post('/invites/redeem-by-code').send({ code: '  ' });
    expect(res.status).toBe(400);
  });
});

describe('POST /invites/:id/decline', () => {
  it('marks a matching Pending invite Declined', async () => {
    vi.mocked(repo.getInvite).mockResolvedValue(pendingInvite());

    const res = await request(appAs('mike@asohav.dev')).post('/invites/inv-1/decline');

    expect(res.status).toBe(200);
    expect(repo.updateInviteStatus).toHaveBeenCalledWith('inv-1', 'Declined');
  });

  it('rejects declining an invite addressed to someone else', async () => {
    vi.mocked(repo.getInvite).mockResolvedValue(pendingInvite({ Email: 'someone-else@asohav.dev' }));

    const res = await request(appAs('mike@asohav.dev')).post('/invites/inv-1/decline');

    expect(res.status).toBe(403);
    expect(repo.updateInviteStatus).not.toHaveBeenCalled();
  });
});

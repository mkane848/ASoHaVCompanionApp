import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign, Character, Membership, PublicUser } from '@asohav/shared';

vi.mock('../repo.js', () => ({
  listAuthUsers: vi.fn(),
  generatePasswordResetLink: vi.fn(),
  listAllCampaigns: vi.fn(),
  listMemberships: vi.fn(),
  listUsers: vi.fn(),
  listAllCharacters: vi.fn(),
}));

import * as repo from '../repo.js';
import { adminRouter } from './admin.js';

function appAs(isAdmin: boolean) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'u-mike', name: 'Mike', email: 'mike@asohav.dev', isAdmin };
    next();
  });
  app.use('/admin', adminRouter);
  return app;
}

const campaign: Campaign = { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active' };
const gmMembership: Membership = { Id: 'mb-1', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const playerMembership: Membership = { Id: 'mb-2', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };
const users: PublicUser[] = [{ Id: 'u-mike', Name: 'Mike' }, { Id: 'u-ryan', Name: 'Ryan' }];
const character: Character = { Id: 'ch-ember', Name: 'Ember', PlayerName: 'Ryan', UserId: 'u-ryan', CampaignId: 'cm-1' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('admin routes require IsAdmin', () => {
  it('403s a non-admin on every route', async () => {
    const app = appAs(false);
    const getUsers = await request(app).get('/admin/users');
    const getCampaigns = await request(app).get('/admin/campaigns');
    const getCharacters = await request(app).get('/admin/characters');
    const resetPassword = await request(app).post('/admin/users/u-ryan/reset-password');

    expect(getUsers.status).toBe(403);
    expect(getCampaigns.status).toBe(403);
    expect(getCharacters.status).toBe(403);
    expect(resetPassword.status).toBe(403);
    expect(repo.listAuthUsers).not.toHaveBeenCalled();
  });
});

describe('GET /admin/users', () => {
  it('returns the joined Auth + profile rows', async () => {
    vi.mocked(repo.listAuthUsers).mockResolvedValue([
      { Id: 'u-mike', Email: 'mike@asohav.dev', Name: 'Mike', IsAdmin: true, CreatedAt: '2026-01-01T00:00:00Z', LastSignInAt: null },
    ]);

    const res = await request(appAs(true)).get('/admin/users');

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].Email).toBe('mike@asohav.dev');
  });
});

describe('POST /admin/users/:id/reset-password', () => {
  it('returns the generated recovery link', async () => {
    vi.mocked(repo.generatePasswordResetLink).mockResolvedValue('https://example.supabase.co/recover?token=abc');

    const res = await request(appAs(true)).post('/admin/users/u-ryan/reset-password');

    expect(res.status).toBe(200);
    expect(res.body.actionLink).toContain('token=abc');
    expect(repo.generatePasswordResetLink).toHaveBeenCalledWith('u-ryan');
  });

  it('404s for a user id that does not resolve to an email', async () => {
    vi.mocked(repo.generatePasswordResetLink).mockResolvedValue(null);

    const res = await request(appAs(true)).post('/admin/users/nope/reset-password');

    expect(res.status).toBe(404);
  });
});

describe('GET /admin/campaigns', () => {
  it('joins each campaign with its GM name and member count', async () => {
    vi.mocked(repo.listAllCampaigns).mockResolvedValue([campaign]);
    vi.mocked(repo.listUsers).mockResolvedValue(users);
    vi.mocked(repo.listMemberships).mockResolvedValue([gmMembership, playerMembership]);

    const res = await request(appAs(true)).get('/admin/campaigns');

    expect(res.status).toBe(200);
    expect(res.body.campaigns[0]).toMatchObject({ Id: 'cm-1', GmName: 'Mike', MemberCount: 2 });
  });
});

describe('GET /admin/characters', () => {
  it('joins each character with its campaign name', async () => {
    vi.mocked(repo.listAllCharacters).mockResolvedValue([character]);
    vi.mocked(repo.listAllCampaigns).mockResolvedValue([campaign]);

    const res = await request(appAs(true)).get('/admin/characters');

    expect(res.status).toBe(200);
    expect(res.body.characters[0]).toMatchObject({ Id: 'ch-ember', CampaignName: 'The Long Road South' });
  });
});

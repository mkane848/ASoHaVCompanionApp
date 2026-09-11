import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Bond, Campaign, Membership } from '@asohav/shared';

// Scoped to the archive-freeze check added to requireCampaignPlayer (shared by propose/accept/
// reject) — the Bond handshake logic itself predates this PR and isn't the subject here.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  getLibrary: vi.fn(),
  membershipFor: vi.fn(),
  withBondLock: vi.fn(),
}));

import * as repo from '../repo.js';
import { bondRouter } from './bond.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Ryan', email: 'ryan@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/bonds', bondRouter);
  return app;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', ...overrides };
}

const membership: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };

const bond: Bond = {
  Id: 'bd-1',
  CampaignId: 'cm-1',
  CharacterAId: 'ch-ember',
  CharacterBId: 'ch-matryoshka',
  BondTrack: 0,
  BondLevel: 0,
  BondMoves: [],
  PendingChange: null,
  History: [],
  UpdatedAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.membershipFor).mockResolvedValue(membership);
  // The Bond cap comes from GameSettings.BondTrackLength rather than a literal 5 as of 0.50.0,
  // so the propose/accept routes read the library. 5 keeps every case below at its original
  // boundary — these tests are about the lock and the archive freeze, not the cap's value.
  vi.mocked(repo.getLibrary).mockResolvedValue({ settings: { BondTrackLength: 5 } } as never);
});

describe('archive freeze (propose/accept/reject)', () => {
  it('refuses to propose on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'MarkBond', payload: { Delta: 1 } });

    expect(res.status).toBe(409);
    expect(repo.withBondLock).not.toHaveBeenCalled();
  });

  it('refuses to accept on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/accept');

    expect(res.status).toBe(409);
    expect(repo.withBondLock).not.toHaveBeenCalled();
  });

  it('refuses to reject on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/reject').send({ withdrawn: false });

    expect(res.status).toBe(409);
    expect(repo.withBondLock).not.toHaveBeenCalled();
  });

  it('still allows proposing on an Active campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone(bond);
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'MarkBond', payload: { Delta: 1 }, note: 'x' });

    expect(res.status).toBe(200);
    expect(repo.withBondLock).toHaveBeenCalled();
  });
});

// Advancements.md: a Bond maxed at Level 5 with a full Bond Track locks — see isBondLocked() and
// applySpendBond() in packages/shared/src/logic.ts, which carry the actual behavior/unit coverage.
// These two just confirm the route wires that check up correctly.
describe('Bond lock at max Level with a full Bond Track', () => {
  beforeEach(() => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
  });

  it('refuses to propose ForgeBond on an already-locked Bond', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone({ ...bond, BondLevel: 5, BondTrack: 5 });
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'ForgeBond', payload: {} });

    expect(res.status).toBe(400);
  });

  it('refuses to Spend Bond on an already-locked Bond, with a 409 (BondHandshakeError)', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone({ ...bond, BondLevel: 5, BondTrack: 5 });
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'SpendBond', payload: { Delta: 1 } });

    expect(res.status).toBe(409);
  });
});

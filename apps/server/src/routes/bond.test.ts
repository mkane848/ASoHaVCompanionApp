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
  ConnectionTag: '',
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
  // boundary — these tests are about the Forge threshold and the archive freeze, not the cap's value.
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

describe('Forge a Bond (revised)', () => {
  beforeEach(() => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
  });

  it('accepts proposing ForgeBond on a Level-5 Bond with full track', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone({ ...bond, BondLevel: 5, BondTrack: 5 });
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'ForgeBond', payload: { Text: 'Improvement text', ConnectionTag: 'New Tag' } });

    expect(res.status).toBe(200);
  });

  it('stores only the validated ForgeBond fields, trimmed', async () => {
    let stored: Bond | undefined;
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone({ ...bond, BondTrack: 5 });
      await mutate(draft);
      stored = draft;
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan'))
      .post('/campaigns/cm-1/bonds/bd-1/propose')
      .send({ type: 'ForgeBond', payload: { Text: '  We cover each other  ', ConnectionTag: ' Old Friends ', Delta: 99, Extra: 'x' } });

    expect(res.status).toBe(200);
    expect(stored?.PendingChange?.Payload).toEqual({ Text: 'We cover each other', ConnectionTag: 'Old Friends' });
  });

  it('rejects ForgeBond with empty Connection Improvement text', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone({ ...bond, BondTrack: 5 });
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'ForgeBond', payload: { Text: '   ' } });

    expect(res.status).toBe(400);
  });

  it('rejects ForgeBond with Connection Improvement text over 500 characters', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone({ ...bond, BondTrack: 5 });
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'ForgeBond', payload: { Text: 'x'.repeat(501) } });

    expect(res.status).toBe(400);
  });

  it('rejects ForgeBond with ConnectionTag over 80 characters', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone({ ...bond, BondTrack: 5 });
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'ForgeBond', payload: { Text: 'Good', ConnectionTag: 'x'.repeat(81) } });

    expect(res.status).toBe(400);
  });
});

describe('SetConnectionTag (revised)', () => {
  beforeEach(() => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
  });

  it('proposes SetConnectionTag with tag and Delta', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone(bond);
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'SetConnectionTag', payload: { Text: 'Tenuous Trust', Delta: 1 } });

    expect(res.status).toBe(200);
  });

  it('stores Delta 0 when a SetConnectionTag proposal omits it', async () => {
    let stored: Bond | undefined;
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone(bond);
      await mutate(draft);
      stored = draft;
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'SetConnectionTag', payload: { Text: 'Tenuous Trust' } });

    expect(res.status).toBe(200);
    expect(stored?.PendingChange?.Payload).toEqual({ Text: 'Tenuous Trust', Delta: 0 });
  });

  it('rejects SetConnectionTag with empty tag', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone(bond);
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'SetConnectionTag', payload: { Text: '   ' } });

    expect(res.status).toBe(400);
  });

  it('rejects SetConnectionTag with tag over 80 characters', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone(bond);
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'SetConnectionTag', payload: { Text: 'x'.repeat(81) } });

    expect(res.status).toBe(400);
  });

  it('rejects SetConnectionTag with Delta of 2', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone(bond);
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'SetConnectionTag', payload: { Text: 'Valid', Delta: 2 } });

    expect(res.status).toBe(400);
  });
});

describe('Spending Bond (revised)', () => {
  beforeEach(() => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
  });

  it('refuses to Spend Bond with 0 Bond, with a 409 (BondHandshakeError)', async () => {
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone({ ...bond, BondLevel: 2, BondTrack: 0 });
      await mutate(draft);
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'SpendBond', payload: { Delta: 1 } });

    expect(res.status).toBe(409);
  });

  it('spends 1 Bond when the requested Delta is negative, rather than adding Bond', async () => {
    let stored: Bond | undefined;
    vi.mocked(repo.withBondLock).mockImplementation(async (_id, mutate) => {
      const draft = structuredClone({ ...bond, BondTrack: 3 });
      await mutate(draft);
      stored = draft;
      return { bond: draft, result: undefined };
    });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/bonds/bd-1/propose').send({ type: 'SpendBond', payload: { Delta: -4 } });

    expect(res.status).toBe(200);
    expect(stored?.BondTrack).toBe(2);
  });
});

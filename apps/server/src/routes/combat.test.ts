import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign, Encounter, Membership, Party } from '@asohav/shared';

vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  getActiveEncounter: vi.fn(),
  listEncountersForCampaign: vi.fn(),
  saveEncounter: vi.fn(),
  getParty: vi.fn(),
  saveParty: vi.fn(),
}));

import * as repo from '../repo.js';
import { combatRouter } from './combat.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Mike', email: 'mike@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/combat', combatRouter);
  return app;
}

// Phase defaults to 'Playing' — most of this file's cases are about Combat mechanics, not the
// 0.38.0 Playing-phase gate, so only the cases that specifically exercise that gate override it.
function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', Phase: 'Playing', ...overrides };
}

const gmMembership: Membership = { Id: 'mb-gm', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const playerMembership: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };

function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    Id: 'enc-1',
    CampaignId: 'cm-1',
    Status: 'Active',
    CombatGoal: 'Hold the bridge',
    CombatGoalAchieved: false,
    DefiantGoals: [],
    Round: 1,
    ActingSide: null,
    ActingParticipantId: null,
    PairedParticipantId: null,
    Participants: [],
    PendingStrainOffers: [],
    History: [],
    CreatedAt: '2026-01-01T00:00:00Z',
    UpdatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeParty(overrides: Partial<Party> = {}): Party {
  return { Id: 'pt-1', CampaignId: 'cm-1', Rapport: 2, RapportImprovementsTaken: [], History: [], PartyLevel: 0, Motif: '', Quest: '', SkillTags: [], WeaknessTags: [], Path: '', Goal: '', CampAssets: [], UpdatedAt: '2026-01-01T00:00:00Z', UpdatedBy: null, ...overrides };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.getParty).mockResolvedValue(makeParty());
});

describe('POST /campaigns/:campaignId/combat/start', () => {
  it('lets the GM start an Encounter when none is active', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.getActiveEncounter).mockResolvedValue(null);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/start').send({ combatGoal: 'Hold the bridge' });

    expect(res.status).toBe(201);
    expect(res.body.encounter.CombatGoal).toBe('Hold the bridge');
    expect(res.body.encounter.Status).toBe('Active');
    expect(repo.saveEncounter).toHaveBeenCalled();
  });

  it('refuses a non-GM', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/combat/start').send({});

    expect(res.status).toBe(403);
    expect(repo.saveEncounter).not.toHaveBeenCalled();
  });

  it('refuses to start a second Encounter while one is active', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.getActiveEncounter).mockResolvedValue(makeEncounter());

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/start').send({});

    expect(res.status).toBe(409);
    expect(repo.saveEncounter).not.toHaveBeenCalled();
  });

  it('refuses on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/start').send({});

    expect(res.status).toBe(409);
    expect(repo.saveEncounter).not.toHaveBeenCalled();
  });

  it('refuses on a campaign that is not yet Playing (0.38.0 item 7)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'PartyCreation' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/start').send({});

    expect(res.status).toBe(409);
    expect(repo.saveEncounter).not.toHaveBeenCalled();
  });

  it('grants the party +1 Rapport when the Heroes initiated, atomically with the Encounter, and logs it to History', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.getActiveEncounter).mockResolvedValue(null);
    vi.mocked(repo.getParty).mockResolvedValue(makeParty({ Rapport: 2 }));

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/start').send({ combatGoal: 'Hold the bridge', initiatedByHeroes: true });

    expect(res.status).toBe(201);
    expect(repo.saveParty).toHaveBeenCalledWith(expect.objectContaining({ Rapport: 3 }));
    expect(res.body.encounter.History).toHaveLength(1);
    expect(res.body.encounter.History[0].Text).toMatch(/\+1 rapport/i);
  });

  it('grants +2 Rapport when the Heroes initiated and share the same goal', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.getActiveEncounter).mockResolvedValue(null);
    vi.mocked(repo.getParty).mockResolvedValue(makeParty({ Rapport: 2 }));

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/start').send({ initiatedByHeroes: true, sharedGoal: true });

    expect(res.status).toBe(201);
    expect(repo.saveParty).toHaveBeenCalledWith(expect.objectContaining({ Rapport: 4 }));
    expect(res.body.encounter.History[0].Text).toMatch(/\+2 rapport/i);
  });

  it('removes 1 Rapport when the Heroes did not initiate and are ill-prepared or off-balance', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.getActiveEncounter).mockResolvedValue(null);
    vi.mocked(repo.getParty).mockResolvedValue(makeParty({ Rapport: 2 }));

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/start').send({ illPreparedOrOffBalance: true });

    expect(res.status).toBe(201);
    expect(repo.saveParty).toHaveBeenCalledWith(expect.objectContaining({ Rapport: 1 }));
    expect(res.body.encounter.History[0].Text).toMatch(/-1 rapport/i);
  });

  it('leaves Rapport unchanged when the Heroes did not initiate and are not ill-prepared', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.getActiveEncounter).mockResolvedValue(null);
    vi.mocked(repo.getParty).mockResolvedValue(makeParty({ Rapport: 2 }));

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/start').send({});

    expect(res.status).toBe(201);
    expect(repo.saveParty).not.toHaveBeenCalled();
    expect(res.body.encounter.History[0].Text).toMatch(/no rapport change/i);
  });

  it('no longer caps the Rapport bump at 5 (V0.6 slice 7 — overflow banks until Camp)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.getActiveEncounter).mockResolvedValue(null);
    vi.mocked(repo.getParty).mockResolvedValue(makeParty({ Rapport: 5 }));

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/start').send({ initiatedByHeroes: true });

    expect(res.status).toBe(201);
    expect(repo.saveParty).toHaveBeenCalledWith(expect.objectContaining({ Rapport: 6 }));
  });

  it('floors the Rapport drop at 0', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.getActiveEncounter).mockResolvedValue(null);
    vi.mocked(repo.getParty).mockResolvedValue(makeParty({ Rapport: 0 }));

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/start').send({ illPreparedOrOffBalance: true });

    expect(res.status).toBe(201);
    expect(repo.saveParty).toHaveBeenCalledWith(expect.objectContaining({ Rapport: 0 }));
  });
});

describe('PUT /campaigns/:campaignId/combat/:encounterId', () => {
  it('lets any campaign member update the Encounter', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);
    vi.mocked(repo.listEncountersForCampaign).mockResolvedValue([makeEncounter()]);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/combat/enc-1').send({ Round: 2 });

    expect(res.status).toBe(200);
    expect(res.body.encounter.Round).toBe(2);
    expect(repo.saveEncounter).toHaveBeenCalled();
  });

  it('ignores an attempt to change Status through this route', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);
    vi.mocked(repo.listEncountersForCampaign).mockResolvedValue([makeEncounter()]);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/combat/enc-1').send({ Status: 'Ended' });

    expect(res.status).toBe(200);
    expect(res.body.encounter.Status).toBe('Active');
  });

  it('404s for an unknown Encounter', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);
    vi.mocked(repo.listEncountersForCampaign).mockResolvedValue([]);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/combat/enc-nope').send({});

    expect(res.status).toBe(404);
  });

  it('refuses on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/combat/enc-1').send({});

    expect(res.status).toBe(409);
    expect(repo.saveEncounter).not.toHaveBeenCalled();
  });
});

describe('POST /campaigns/:campaignId/combat/:encounterId/end', () => {
  it('lets the GM end the Encounter', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.listEncountersForCampaign).mockResolvedValue([makeEncounter()]);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/combat/enc-1/end');

    expect(res.status).toBe(200);
    expect(res.body.encounter.Status).toBe('Ended');
  });

  it('refuses a non-GM', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(playerMembership);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/combat/enc-1/end');

    expect(res.status).toBe(403);
    expect(repo.saveEncounter).not.toHaveBeenCalled();
  });
});

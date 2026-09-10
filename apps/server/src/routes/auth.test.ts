import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Bond, Character, Membership, Party } from '@asohav/shared';

// Covers the widened /me route added in 0.23.0 (WorkPlan-0.23.0.md item A) — the batched
// CampaignOverview assembly (roster, GM name, Rapport, Kin, last-played). The plain
// user/memberships passthrough predates this and isn't the subject of this file.
vi.mock('../repo.js', () => ({
  listMembershipsWithCampaignForUser: vi.fn(),
  listMembershipsForCampaigns: vi.fn(),
  listCharactersForCampaigns: vi.fn(),
  listPartiesForCampaigns: vi.fn(),
  listBondsForCampaigns: vi.fn(),
  listSheetTimestampsForCampaigns: vi.fn(),
  listEncounterTimestampsForCampaigns: vi.fn(),
  listUsers: vi.fn(),
}));

import * as repo from '../repo.js';
import { authRouter } from './auth.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Ryan', email: 'ryan@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/auth', authRouter);
  return app;
}

const gmMembership: Membership = { Id: 'mb-gm', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const myMembership: Membership = { Id: 'mb-ryan', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };
const otherMembership: Membership = { Id: 'mb-sam', UserId: 'u-sam', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-matryoshka' };

const myCharacter: Character = { Id: 'ch-ember', Name: 'Ember', Pronouns: 'she/her', PlayerName: 'Ryan', UserId: 'u-ryan', CampaignId: 'cm-1' };
const otherCharacter: Character = { Id: 'ch-matryoshka', Name: 'Matryoshka', Pronouns: 'they/them', PlayerName: 'Sam', UserId: 'u-sam', CampaignId: 'cm-1' };

const party: Party = { Id: 'pt-1', CampaignId: 'cm-1', Rapport: 3, RapportImprovementsTaken: [], History: [], PartyLevel: 0, Motif: '', Quest: '', SkillTags: [], WeaknessTags: [], Path: '', Goal: '', CampAssets: [], UpdatedAt: '2026-08-01T00:00:00Z', UpdatedBy: null };

function makeBond(overrides: Partial<Bond> = {}): Bond {
  return {
    Id: 'bd-1',
    CampaignId: 'cm-1',
    CharacterAId: 'ch-ember',
    CharacterBId: 'ch-matryoshka',
    BondTrack: 0,
    BondLevel: 0,
    BondMoves: [],
    PendingChange: null,
    History: [],
    UpdatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.listMembershipsForCampaigns).mockResolvedValue([gmMembership, myMembership, otherMembership]);
  vi.mocked(repo.listCharactersForCampaigns).mockResolvedValue([myCharacter, otherCharacter]);
  vi.mocked(repo.listPartiesForCampaigns).mockResolvedValue([party]);
  vi.mocked(repo.listBondsForCampaigns).mockResolvedValue([]);
  vi.mocked(repo.listSheetTimestampsForCampaigns).mockResolvedValue([]);
  vi.mocked(repo.listEncounterTimestampsForCampaigns).mockResolvedValue([]);
  vi.mocked(repo.listUsers).mockResolvedValue([
    { Id: 'u-mike', Name: 'Mike' },
    { Id: 'u-ryan', Name: 'Ryan' },
    { Id: 'u-sam', Name: 'Sam' },
  ]);
});

describe('GET /auth/me', () => {
  it('attaches a CampaignOverview with GM name, roster, and Rapport per membership', async () => {
    vi.mocked(repo.listMembershipsWithCampaignForUser).mockResolvedValue([
      { ...myMembership, CampaignName: 'The Long Road South', CampaignStatus: 'Active', CampaignPhase: 'Playing' },
    ]);

    const res = await request(appAs('u-ryan')).get('/auth/me');

    expect(res.status).toBe(200);
    const overview = res.body.memberships[0].Overview;
    expect(overview.GmName).toBe('Mike');
    expect(overview.Rapport).toBe(3);
    expect(overview.Roster).toEqual([
      { CharacterId: 'ch-ember', CharacterName: 'Ember', PlayerName: 'Ryan', IsYou: true },
      { CharacterId: 'ch-matryoshka', CharacterName: 'Matryoshka', PlayerName: 'Sam', IsYou: false },
    ]);
  });

  it('includes Bonds only for Bonds involving the caller\'s own character, with BondTrack > 0', async () => {
    vi.mocked(repo.listMembershipsWithCampaignForUser).mockResolvedValue([
      { ...myMembership, CampaignName: 'The Long Road South', CampaignStatus: 'Active', CampaignPhase: 'Playing' },
    ]);
    vi.mocked(repo.listBondsForCampaigns).mockResolvedValue([
      makeBond({ Id: 'bd-1', CharacterAId: 'ch-ember', CharacterBId: 'ch-matryoshka', BondTrack: 3 }),
      makeBond({ Id: 'bd-2', CharacterAId: 'ch-ember', CharacterBId: 'ch-oleander', BondTrack: 0 }), // no Kin marked yet
      makeBond({ Id: 'bd-3', CharacterAId: 'ch-matryoshka', CharacterBId: 'ch-oleander', BondTrack: 5 }), // not my character at all
    ]);

    const res = await request(appAs('u-ryan')).get('/auth/me');

    expect(res.body.memberships[0].Overview.Bonds).toEqual([{ CharacterName: 'Matryoshka', BondTrack: 3 }]);
  });

  it('gives a GM membership an empty roster contribution for itself and no Bonds, without special-casing', async () => {
    vi.mocked(repo.listMembershipsWithCampaignForUser).mockResolvedValue([
      { ...gmMembership, CampaignName: 'The Long Road South', CampaignStatus: 'Active', CampaignPhase: 'Playing' },
    ]);
    vi.mocked(repo.listBondsForCampaigns).mockResolvedValue([makeBond({ BondTrack: 3 })]);

    const res = await request(appAs('u-mike')).get('/auth/me');

    const overview = res.body.memberships[0].Overview;
    expect(overview.Bonds).toEqual([]);
    expect(overview.Roster.every((r: { CharacterId: string }) => r.CharacterId !== null)).toBe(true);
  });

  it('derives LastPlayedAt as the max UpdatedAt across party/bonds/sheets/encounters', async () => {
    vi.mocked(repo.listMembershipsWithCampaignForUser).mockResolvedValue([
      { ...myMembership, CampaignName: 'The Long Road South', CampaignStatus: 'Active', CampaignPhase: 'Playing' },
    ]);
    vi.mocked(repo.listBondsForCampaigns).mockResolvedValue([makeBond({ UpdatedAt: '2026-08-05T00:00:00Z' })]);
    vi.mocked(repo.listSheetTimestampsForCampaigns).mockResolvedValue([{ CampaignId: 'cm-1', UpdatedAt: '2026-08-10T00:00:00Z' }]);
    vi.mocked(repo.listEncounterTimestampsForCampaigns).mockResolvedValue([{ CampaignId: 'cm-1', UpdatedAt: '2026-08-02T00:00:00Z' }]);

    const res = await request(appAs('u-ryan')).get('/auth/me');

    expect(res.body.memberships[0].Overview.LastPlayedAt).toBe('2026-08-10T00:00:00Z');
  });

  it('skips the batched reads entirely when the user has no memberships', async () => {
    vi.mocked(repo.listMembershipsWithCampaignForUser).mockResolvedValue([]);

    const res = await request(appAs('u-nobody')).get('/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.memberships).toEqual([]);
    expect(repo.listCharactersForCampaigns).toHaveBeenCalledWith([]);
  });
});

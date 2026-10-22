import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { seedLibrary } from '@asohav/shared';
import type { Campaign, Membership, Party } from '@asohav/shared';

// Scoped to the archive-freeze check added to PUT — the rest of party.ts predates this PR.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  getParty: vi.fn(),
  saveParty: vi.fn(),
  // The Drama route names who changed it on Party History.
  getCharacter: vi.fn(),
  // Added `0.28.0`: PUT reads the library to bound Rapport, now that Aid makes it a live spend
  // surface rather than a display-only counter.
  getLibrary: vi.fn(),
}));

import * as repo from '../repo.js';
import { partyRouter } from './party.js';
import { errorMiddleware } from '../errorMiddleware.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Ryan', email: 'ryan@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/party', partyRouter);
  // The real production error middleware — the Drama route's Playing gate throws rather than
  // answering inline, so its 409 and body come from here.
  app.use(errorMiddleware);
  return app;
}

// Playing by default: every Drama action is refused before then (see the phase-gate block at
// the bottom). PUT doesn't read Phase at all.
function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', Phase: 'Playing', ...overrides };
}

const membership: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };
const party: Party = { Id: 'pt-1', CampaignId: 'cm-1', Rapport: 2, Drama: 1, RapportImprovementsTaken: [], History: [], PartyLevel: 0, Motif: '', Quest: '', SkillTags: [], WeaknessTags: [], MotifId: null, FlawTags: [], UsedTags: [], QuestKind: null, ActBreaks: 0, Forsakes: 0, Path: '', Goal: '', CampAssets: [], UpdatedAt: '2026-01-01T00:00:00Z', UpdatedBy: null };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.membershipFor).mockResolvedValue(membership);
  vi.mocked(repo.getParty).mockResolvedValue(party);
  vi.mocked(repo.getCharacter).mockResolvedValue({ Id: 'ch-ember', Name: 'Ember' } as never);
  vi.mocked(repo.getLibrary).mockResolvedValue({ ...seedLibrary(), settings: { ...seedLibrary().settings, RapportTrackLength: 5 } });
});

describe('PUT /campaigns/:campaignId/party', () => {
  it('saves the party on an Active campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ Rapport: 3 });

    expect(res.status).toBe(200);
    expect(repo.saveParty).toHaveBeenCalled();
  });

  it('refuses to save the party on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));

    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ Rapport: 3 });

    expect(res.status).toBe(409);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });
});

describe('PUT /campaigns/:campaignId/party — Rapport bounds', () => {
  // Before `0.28.0` this route validated nothing at all: a client could persist Rapport: 9999 or
  // a negative and it stuck. V0.6 slice 7 then dropped the ceiling so overflow banked until Make
  // Camp; V0.7 L2034 caps Rapport at 5 and advancing clears the track, so the ceiling is back (0.71.0).
  it('clamps Rapport above the track length down to the cap (no banked overflow, V0.7 L2034)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Rapport: 13 });

    expect(res.status).toBe(200);
    expect(res.body.party.Rapport).toBe(5);
    expect(vi.mocked(repo.saveParty).mock.calls[0][0].Rapport).toBe(5);
  });

  it('honours an admin-edited RapportTrackLength as the ceiling', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.getLibrary).mockResolvedValue({ ...seedLibrary(), settings: { ...seedLibrary().settings, RapportTrackLength: 7 } });
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Rapport: 13 });

    expect(res.body.party.Rapport).toBe(7);
  });

  it('clamps a negative Rapport up to 0', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Rapport: -4 });

    expect(res.status).toBe(200);
    expect(res.body.party.Rapport).toBe(0);
  });

  it('leaves an in-range value alone', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Rapport: 3 });

    expect(res.status).toBe(200);
    expect(res.body.party.Rapport).toBe(3);
  });

  it('preserves the stored Drama value when client sends a different one', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Drama: 99 });

    expect(res.status).toBe(200);
    expect(res.body.party.Drama).toBe(1); // stored value, not client's 99
    expect(vi.mocked(repo.saveParty).mock.calls[0][0].Drama).toBe(1);
  });
});

describe('PUT /campaigns/:campaignId/party — pre-V0.7 Misfortune key', () => {
  it('keeps a stale Misfortune key from a tab opened before the rename out of the saved row', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, Misfortune: 7 });

    expect(res.status).toBe(200);
    expect(res.body.party).not.toHaveProperty('Misfortune');
    expect(vi.mocked(repo.saveParty).mock.calls[0][0]).not.toHaveProperty('Misfortune');
    expect(vi.mocked(repo.saveParty).mock.calls[0][0].Drama).toBe(1);
  });
});

// Before 0.65.0 the client's TagList saved an empty chip the moment "+ Tag" was pressed, and live
// rows still carry those "" entries. normalizeParty strips them on read; this is the write side, so
// a tab still running the old client can't put one back.
describe('PUT /campaigns/:campaignId/party — blank tags', () => {
  it('strips blank and whitespace-only Skill and Flaw tags before saving', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const res = await request(appAs('u-ryan')).put('/campaigns/cm-1/party').send({ ...party, SkillTags: ['Scouts', '', '  '], FlawTags: ['', 'Reckless', '\t'] });

    expect(res.status).toBe(200);
    expect(res.body.party.SkillTags).toEqual(['Scouts']);
    expect(res.body.party.FlawTags).toEqual(['Reckless']);
    const saved = vi.mocked(repo.saveParty).mock.calls[0][0];
    expect(saved.SkillTags).toEqual(['Scouts']);
    expect(saved.FlawTags).toEqual(['Reckless']);
  });
});

describe('POST /campaigns/:campaignId/party/drama', () => {
  it('lets a player Gain Drama with a note', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    const testParty = { ...party, Drama: 2, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/drama').send({ Action: 'Gain', Note: 'Rolled a 6-.' });

    expect(res.status).toBe(200);
    expect(res.body.party.Drama).toBe(3); // 2 + 1
    expect(res.body.party.History[0].Effect).toContain('Rolled a 6-.');
    expect(res.body.party.History[0].By).toBe('Ember'); // the player's Hero, not their user id
    expect(vi.mocked(repo.saveParty).mock.calls[0][0].Drama).toBe(3);
  });

  it('still answers on the pre-V0.7 /misfortune path, in the old shape too, for a tab opened before the rename', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.getParty).mockResolvedValue({ ...party, Drama: 2, History: [] });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/misfortune').send({ Action: 'Gain', Note: 'Rolled a 6-.' });

    expect(res.status).toBe(200);
    expect(res.body.party.Drama).toBe(3);
    expect(res.body.party.Misfortune).toBe(3);
    expect(vi.mocked(repo.saveParty).mock.calls[0][0].Drama).toBe(3);
    expect(vi.mocked(repo.saveParty).mock.calls[0][0]).not.toHaveProperty('Misfortune');
  });

  it('keeps the new /drama response free of the old key', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.getParty).mockResolvedValue({ ...party, Drama: 2, History: [] });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/drama').send({ Action: 'Gain', Note: 'Rolled a 6-.' });

    expect(res.body.party).not.toHaveProperty('Misfortune');
  });

  it('rejects a player Gain without a note', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.getParty).mockResolvedValue({ ...party, History: [] });

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/drama').send({ Action: 'Gain', Note: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Say what earned/);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('rejects a player trying to Spend (GM only)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(membership); // Player role

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/drama').send({ Action: 'Spend' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only the GM/);
  });

  it('lets the GM Spend Drama with default note', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Drama: 3, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/drama').send({ Action: 'Spend' });

    expect(res.status).toBe(200);
    expect(res.body.party.Drama).toBe(2); // 3 - 1
    expect(res.body.party.History[0].Effect).toContain('A Hard Move');
    expect(res.body.party.History[0].By).toBe('The GM');
  });

  it('lets the GM Spend with a custom note', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Drama: 4, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/drama').send({ Action: 'Spend', Note: 'Ambush!' });

    expect(res.status).toBe(200);
    expect(res.body.party.Drama).toBe(3); // 4 - 1
    expect(res.body.party.History[0].Effect).toContain('Ambush!');
  });

  it('returns 409 when the GM tries to Spend at 0', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Drama: 0, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/drama').send({ Action: 'Spend' });

    expect(res.status).toBe(409);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('lets the GM Reset Drama from 5 to 1', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Drama: 5, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/drama').send({ Action: 'Reset' });

    expect(res.status).toBe(200);
    expect(res.body.party.Drama).toBe(1);
  });

  it('lets the GM call BeginSession from 0 to 1', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Drama: 0, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/drama').send({ Action: 'BeginSession' });

    expect(res.status).toBe(200);
    expect(res.body.party.Drama).toBe(1);
  });

  it('lets the GM call BeginSession without changing Drama if already above 0', async () => {
    const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike' };
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const testParty = { ...party, Drama: 3, History: [] };
    vi.mocked(repo.getParty).mockResolvedValue(testParty);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/drama').send({ Action: 'BeginSession' });

    expect(res.status).toBe(200);
    expect(res.body.party.Drama).toBe(3);
  });

  it('rejects an invalid Action', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/drama').send({ Action: 'InvalidAction' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid/);
  });

  it('404s for an unknown campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(null);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/drama').send({ Action: 'Gain', Note: 'test' });

    expect(res.status).toBe(404);
  });

  it('403s for a non-member', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.membershipFor).mockResolvedValue(null);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/drama').send({ Action: 'Gain', Note: 'test' });

    expect(res.status).toBe(403);
  });

  it('404s if no party exists', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
    vi.mocked(repo.getParty).mockResolvedValue(null);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/drama').send({ Action: 'Gain', Note: 'test' });

    expect(res.status).toBe(404);
  });

  it('409s on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(membership);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/drama').send({ Action: 'Gain', Note: 'test' });

    expect(res.status).toBe(409);
  });
});

/* The GM's Drama controls used to work before play had started. Drama is a play-time
   resource, so every action — Gain, Spend, Reset, BeginSession — is refused until the campaign is
   Playing, including a legacy campaign with no stored Phase (which reads as PartyCreation). */
describe('POST /campaigns/:campaignId/party/drama — Playing phase gate', () => {
  const gmMembership: typeof membership = { ...membership, Role: 'GM', UserId: 'u-mike', CharacterId: null };

  it.each(['Gain', 'Spend', 'Reset', 'BeginSession'])('409s a GM %s during Party Creation', async (action) => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'PartyCreation' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/drama').send({ Action: action, Note: 'A 6-.' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Drama is only tracked once the campaign is Playing.');
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('409s a player reporting a Gain during Party Creation', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'PartyCreation' }));

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-1/party/drama').send({ Action: 'Gain', Note: 'Rolled a 6-.' });

    expect(res.status).toBe(409);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('409s during Signup', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'Signup' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/drama').send({ Action: 'Spend' });

    expect(res.status).toBe(409);
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('409s a legacy campaign with no stored Phase until the GM starts playing', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: undefined }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/drama').send({ Action: 'Spend' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Drama is only tracked once the campaign is Playing.');
    expect(repo.saveParty).not.toHaveBeenCalled();
  });

  it('allows it once the campaign is Playing', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Phase: 'Playing' }));
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.getParty).mockResolvedValue({ ...party, Drama: 2, History: [] });

    const res = await request(appAs('u-mike')).post('/campaigns/cm-1/party/drama').send({ Action: 'Spend' });

    expect(res.status).toBe(200);
    expect(res.body.party.Drama).toBe(1);
    expect(repo.saveParty).toHaveBeenCalled();
  });
});

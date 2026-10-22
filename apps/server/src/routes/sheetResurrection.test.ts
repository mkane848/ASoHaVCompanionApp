import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { newClock, type Campaign, type Character, type CharacterSheet, type Clock, type Membership } from '@asohav/shared';

// V0.7 slice 8c: the Resurrection routes (`sheet.ts`). The GM links a Clock to a Dead Hero; once it is
// complete the Hero's player (or the GM for the table) chooses Return or Stay dead.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  getSheet: vi.fn(),
  saveSheet: vi.fn(),
  getCharacter: vi.fn(),
  listClocksForCampaign: vi.fn(),
  saveClock: vi.fn(),
}));

import * as repo from '../repo.js';
import { sheetRouter } from './sheet.js';

function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Someone', email: 'x@asohav.dev', isAdmin: false };
    next();
  });
  app.use('/campaigns/:campaignId/sheets', sheetRouter);
  return app;
}

const campaign: Campaign = { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active' };
const character: Character = { Id: 'ch-ember', Name: 'Ember', Pronouns: 'she/her', PlayerName: 'Ryan', UserId: 'u-ryan', CampaignId: 'cm-1' };
const ownMembership: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };
const gmMembership: Membership = { Id: 'mb-gm', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const otherPlayer: Membership = { Id: 'mb-2', UserId: 'u-sam', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-other' };

type SheetResult = Awaited<ReturnType<typeof repo.getSheet>>;

function dead(overrides: Partial<CharacterSheet> = {}): SheetResult {
  return {
    Id: 'sh-ch-ember', CharacterId: 'ch-ember',
    Strain: [true, true, false, false, true], StrainSecond: [false, true, false, false, false], TempStrain: 0,
    Statuses: [{ Id: 's1', Severity: 'Major', Name: 'Broken leg' }], Scars: [{ Id: 'sc1', Text: 'A scar', At: 'a' }],
    Dying: true, DyingChoice: 'Scar', LifeState: 'Dead',
    Ending: { Kind: 'BlazeOfGlory', Text: 'Held the bridge', At: 't' }, ResurrectionClockId: 'clk-1',
    ...overrides,
  } as unknown as SheetResult;
}

function clock(over: Partial<Clock> = {}): Clock {
  return { ...newClock({ CampaignId: 'cm-1', Title: 'The Rite', Kind: 'Project', Segments: 4 }), Id: 'clk-1', ...over };
}

function saved(): CharacterSheet {
  return vi.mocked(repo.saveSheet).mock.calls[0][0] as CharacterSheet;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.getCampaign).mockResolvedValue(campaign);
  vi.mocked(repo.membershipFor).mockResolvedValue(ownMembership);
  vi.mocked(repo.getCharacter).mockResolvedValue(character);
  vi.mocked(repo.getSheet).mockResolvedValue(dead());
  vi.mocked(repo.listClocksForCampaign).mockResolvedValue([clock({ SuccessMarks: 4 })]);
});

describe('POST /campaigns/:campaignId/sheets/:characterId/resurrection', () => {
  const url = '/campaigns/cm-1/sheets/ch-ember/resurrection';

  it('Return: the Hero’s player brings them back, changing only LifeState and Ending', async () => {
    const before = structuredClone(dead() as CharacterSheet);
    const res = await request(appAs('u-ryan')).post(url).send({ Choice: 'Return' });
    expect(res.status).toBe(200);
    const s = saved();
    expect(s.LifeState).toBe('Alive');
    expect(s.Ending).toBeNull();
    expect({ ...s, LifeState: before.LifeState, Ending: before.Ending, ResurrectionClockId: before.ResurrectionClockId }).toEqual(before);
  });

  it('Stay dead: leaves them Dead and unlinks the Clock', async () => {
    const res = await request(appAs('u-ryan')).post(url).send({ Choice: 'StayDead' });
    expect(res.status).toBe(200);
    expect(saved().LifeState).toBe('Dead');
    expect(saved().ResurrectionClockId).toBeNull();
  });

  it('lets the GM record the choice for the table', async () => {
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    const res = await request(appAs('u-mike')).post(url).send({ Choice: 'Return' });
    expect(res.status).toBe(200);
  });

  it('refuses another player’s Hero, a non-member, an Archived campaign and another campaign’s Hero', async () => {
    vi.mocked(repo.membershipFor).mockResolvedValue(otherPlayer);
    expect((await request(appAs('u-sam')).post(url).send({ Choice: 'Return' })).status).toBe(403);
    vi.mocked(repo.membershipFor).mockResolvedValue(null);
    expect((await request(appAs('u-eve')).post(url).send({ Choice: 'Return' })).status).toBe(403);
    vi.mocked(repo.membershipFor).mockResolvedValue(ownMembership);
    vi.mocked(repo.getCampaign).mockResolvedValue({ ...campaign, Status: 'Archived' });
    expect((await request(appAs('u-ryan')).post(url).send({ Choice: 'Return' })).status).toBe(409);
    vi.mocked(repo.getCampaign).mockResolvedValue(campaign);
    vi.mocked(repo.getCharacter).mockResolvedValue({ ...character, CampaignId: 'cm-2' });
    expect((await request(appAs('u-ryan')).post(url).send({ Choice: 'Return' })).status).toBe(404);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('refuses a Retired or living Hero, no link, a missing Clock, an unfinished Clock and a bad choice', async () => {
    vi.mocked(repo.getSheet).mockResolvedValue(dead({ LifeState: 'Retired' }));
    expect((await request(appAs('u-ryan')).post(url).send({ Choice: 'Return' })).status).toBe(409);
    vi.mocked(repo.getSheet).mockResolvedValue(dead({ LifeState: 'Alive' }));
    expect((await request(appAs('u-ryan')).post(url).send({ Choice: 'Return' })).status).toBe(409);
    vi.mocked(repo.getSheet).mockResolvedValue(dead({ ResurrectionClockId: null }));
    expect((await request(appAs('u-ryan')).post(url).send({ Choice: 'Return' })).status).toBe(409);
    vi.mocked(repo.getSheet).mockResolvedValue(dead());
    vi.mocked(repo.listClocksForCampaign).mockResolvedValue([]);
    expect((await request(appAs('u-ryan')).post(url).send({ Choice: 'Return' })).status).toBe(409);
    vi.mocked(repo.listClocksForCampaign).mockResolvedValue([clock({ SuccessMarks: 3 })]);
    expect((await request(appAs('u-ryan')).post(url).send({ Choice: 'Return' })).status).toBe(409);
    vi.mocked(repo.listClocksForCampaign).mockResolvedValue([clock({ SuccessMarks: 4 })]);
    expect((await request(appAs('u-ryan')).post(url).send({ Choice: 'Maybe' })).status).toBe(400);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });
});

describe('PUT /campaigns/:campaignId/sheets/:characterId/resurrection-clock', () => {
  const url = '/campaigns/cm-1/sheets/ch-ember/resurrection-clock';

  beforeEach(() => {
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    vi.mocked(repo.getSheet).mockResolvedValue(dead({ ResurrectionClockId: null }));
  });

  it('links an existing Clock of this campaign', async () => {
    const res = await request(appAs('u-mike')).put(url).send({ ClockId: 'clk-1' });
    expect(res.status).toBe(200);
    expect(saved().ResurrectionClockId).toBe('clk-1');
    expect(repo.saveClock).not.toHaveBeenCalled();
  });

  it('refuses a Clock that is not in this campaign', async () => {
    const res = await request(appAs('u-mike')).put(url).send({ ClockId: 'clk-elsewhere' });
    expect(res.status).toBe(404);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('makes a new Project Clock and links it', async () => {
    const res = await request(appAs('u-mike')).put(url).send({ NewClock: { Title: 'The Rite of Return', Segments: 6 } });
    expect(res.status).toBe(200);
    const made = vi.mocked(repo.saveClock).mock.calls[0][0];
    expect(made).toMatchObject({ Title: 'The Rite of Return', Kind: 'Project', Segments: 6, CampaignId: 'cm-1' });
    expect(saved().ResurrectionClockId).toBe(made.Id);
    expect(res.body.clock.Id).toBe(made.Id);
  });

  it('unlinks with ClockId null, and needs a title for a new Clock', async () => {
    expect((await request(appAs('u-mike')).put(url).send({ ClockId: null })).status).toBe(200);
    expect((await request(appAs('u-mike')).put(url).send({ NewClock: { Title: '  ' } })).status).toBe(400);
    expect((await request(appAs('u-mike')).put(url).send({})).status).toBe(400);
  });

  it('is GM only', async () => {
    vi.mocked(repo.membershipFor).mockResolvedValue(ownMembership);
    expect((await request(appAs('u-ryan')).put(url).send({ ClockId: 'clk-1' })).status).toBe(403);
    vi.mocked(repo.membershipFor).mockResolvedValue(otherPlayer);
    expect((await request(appAs('u-sam')).put(url).send({ ClockId: 'clk-1' })).status).toBe(403);
    vi.mocked(repo.membershipFor).mockResolvedValue(null);
    expect((await request(appAs('u-eve')).put(url).send({ ClockId: 'clk-1' })).status).toBe(403);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('refuses an Archived campaign, another campaign’s Hero, and a Retired or living Hero (saving no Clock)', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue({ ...campaign, Status: 'Archived' });
    expect((await request(appAs('u-mike')).put(url).send({ ClockId: 'clk-1' })).status).toBe(409);
    vi.mocked(repo.getCampaign).mockResolvedValue(campaign);
    vi.mocked(repo.getCharacter).mockResolvedValue({ ...character, CampaignId: 'cm-2' });
    expect((await request(appAs('u-mike')).put(url).send({ ClockId: 'clk-1' })).status).toBe(404);
    vi.mocked(repo.getCharacter).mockResolvedValue(character);
    vi.mocked(repo.getSheet).mockResolvedValue(dead({ LifeState: 'Retired' }));
    expect((await request(appAs('u-mike')).put(url).send({ NewClock: { Title: 'x' } })).status).toBe(409);
    vi.mocked(repo.getSheet).mockResolvedValue(dead({ LifeState: 'Alive' }));
    expect((await request(appAs('u-mike')).put(url).send({ ClockId: 'clk-1' })).status).toBe(409);
    expect(repo.saveSheet).not.toHaveBeenCalled();
    expect(repo.saveClock).not.toHaveBeenCalled();
  });
});

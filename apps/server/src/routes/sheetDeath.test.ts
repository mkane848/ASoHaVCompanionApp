import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { emptyMarks, type Campaign, type Character, type CharacterSheet, type Membership } from '@asohav/shared';

// V0.7 slice 8b: the Dying choice and Scar reversal routes (`sheet.ts`). Authorization is the
// point of most of these: the Hero's own player or the GM, never another player or a stranger,
// never on an Archived campaign, never across campaigns.
vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  getSheet: vi.fn(),
  saveSheet: vi.fn(),
  getCharacter: vi.fn(),
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

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', ...overrides };
}

const character: Character = { Id: 'ch-ember', Name: 'Ember', Pronouns: 'she/her', PlayerName: 'Ryan', UserId: 'u-ryan', CampaignId: 'cm-1' };
const ownMembership: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-ember' };
const gmMembership: Membership = { Id: 'mb-gm', UserId: 'u-mike', CampaignId: 'cm-1', Role: 'GM', CharacterId: null };
const otherPlayer: Membership = { Id: 'mb-2', UserId: 'u-sam', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-other' };

type SheetResult = Awaited<ReturnType<typeof repo.getSheet>>;

function hero(overrides: Partial<CharacterSheet> = {}): SheetResult {
  return {
    Id: 'sh-ch-ember', CharacterId: 'ch-ember',
    Strain: [true, true, false, false, true], StrainSecond: emptyMarks(5), TempStrain: 0,
    Dying: true, DyingChoice: null, LifeState: 'Alive', Ending: null, ResurrectionClockId: null, Scars: [],
    ...overrides,
  } as unknown as SheetResult;
}

function saved(): CharacterSheet {
  return vi.mocked(repo.saveSheet).mock.calls[0][0] as CharacterSheet;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign());
  vi.mocked(repo.membershipFor).mockResolvedValue(ownMembership);
  vi.mocked(repo.getCharacter).mockResolvedValue(character);
  vi.mocked(repo.getSheet).mockResolvedValue(hero());
});

describe('POST /campaigns/:campaignId/sheets/:characterId/dying-choice', () => {
  const url = '/campaigns/cm-1/sheets/ch-ember/dying-choice';
  const scarBody = { Choice: 'Scar', ScarText: 'A shattered hand' };

  describe('authorization', () => {
    it("lets the Hero's own player record a choice", async () => {
      const res = await request(appAs('u-ryan')).post(url).send(scarBody);
      expect(res.status).toBe(200);
      expect(repo.saveSheet).toHaveBeenCalledTimes(1);
    });

    it('lets the GM record a choice for any Hero', async () => {
      vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
      const res = await request(appAs('u-mike')).post(url).send({ Choice: 'BlazeOfGlory', Text: 'Holds the bridge' });
      expect(res.status).toBe(200);
      expect(res.body.outcome).toBe('Died');
    });

    it("refuses a player acting on another player's Hero", async () => {
      vi.mocked(repo.membershipFor).mockResolvedValue(otherPlayer);
      const res = await request(appAs('u-sam')).post(url).send(scarBody);
      expect(res.status).toBe(403);
      expect(repo.saveSheet).not.toHaveBeenCalled();
    });

    it('refuses a non-member', async () => {
      vi.mocked(repo.membershipFor).mockResolvedValue(null);
      const res = await request(appAs('u-stranger')).post(url).send(scarBody);
      expect(res.status).toBe(403);
      expect(repo.saveSheet).not.toHaveBeenCalled();
    });

    it('is frozen on an Archived campaign', async () => {
      vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
      const res = await request(appAs('u-ryan')).post(url).send(scarBody);
      expect(res.status).toBe(409);
      expect(repo.saveSheet).not.toHaveBeenCalled();
    });

    it('404s for a character in another campaign', async () => {
      vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
      vi.mocked(repo.getCharacter).mockResolvedValue({ ...character, CampaignId: 'cm-other' });
      const res = await request(appAs('u-mike')).post(url).send(scarBody);
      expect(res.status).toBe(404);
      expect(repo.saveSheet).not.toHaveBeenCalled();
    });
  });

  describe('outcomes', () => {
    it('Take a Scar records it, keeps the Hero Dying and unlocks the second marks', async () => {
      const res = await request(appAs('u-ryan')).post(url).send(scarBody);
      expect(res.body.outcome).toBe('ScarTaken');
      expect(saved().Dying).toBe(true);
      expect(saved().DyingChoice).toBe('Scar');
      expect(saved().Scars.map((s) => s.Text)).toEqual(['A shattered hand']);
    });

    it('Risk Death 10+ removes the highest Strain and clears Dying', async () => {
      const res = await request(appAs('u-ryan')).post(url).send({ Choice: 'RiskDeath', Tier: 'Tier3' });
      expect(res.body.outcome).toBe('Survived');
      expect(saved().Dying).toBe(false);
      expect(saved().DyingChoice).toBeNull();
      expect(saved().Strain).toEqual([true, true, false, false, false]);
    });

    it("Risk Death 7-9 accepted records the GM's Scar and stays Dying", async () => {
      const res = await request(appAs('u-ryan')).post(url).send({ Choice: 'RiskDeath', Tier: 'Tier2', ScarText: 'Blinded in one eye', Accept: true });
      expect(res.body.outcome).toBe('ScarTaken');
      expect(saved().Dying).toBe(true);
      expect(saved().DyingChoice).toBe('RiskDeath');
      expect(saved().LifeState).toBe('Alive');
    });

    it('Risk Death 7-9 refused is a death', async () => {
      const res = await request(appAs('u-ryan')).post(url).send({ Choice: 'RiskDeath', Tier: 'Tier2', Accept: false });
      expect(res.body.outcome).toBe('Died');
      expect(saved().LifeState).toBe('Dead');
      expect(saved().Ending?.Kind).toBe('ScarRefused');
    });

    it('Risk Death 6- is a death with last words recorded', async () => {
      const res = await request(appAs('u-ryan')).post(url).send({ Choice: 'RiskDeath', Tier: 'Tier1', Text: 'Tell them I tried.' });
      expect(res.body.outcome).toBe('Died');
      expect(saved().Ending).toMatchObject({ Kind: 'RiskDeathFailed', Text: 'Tell them I tried.' });
    });

    it('a fourth Scar retires the Hero', async () => {
      const scars = [1, 2, 3].map((n) => ({ Id: `s${n}`, Text: `Scar ${n}`, At: 't' }));
      vi.mocked(repo.getSheet).mockResolvedValue(hero({ Scars: scars }));
      const res = await request(appAs('u-ryan')).post(url).send({ ...scarBody, Note: 'Goes home to the farm.' });
      expect(res.body.outcome).toBe('Retired');
      expect(saved().LifeState).toBe('Retired');
      expect(saved().Scars).toHaveLength(4);
      expect(saved().Ending).toMatchObject({ Kind: 'FourthScar', Text: 'Goes home to the farm.' });
    });

    it('Blaze of Glory needs the final achievement', async () => {
      const res = await request(appAs('u-ryan')).post(url).send({ Choice: 'BlazeOfGlory', Text: '  ' });
      expect(res.status).toBe(400);
      expect(repo.saveSheet).not.toHaveBeenCalled();
    });

    it('refuses a Hero who is not Dying', async () => {
      vi.mocked(repo.getSheet).mockResolvedValue(hero({ Dying: false }));
      const res = await request(appAs('u-ryan')).post(url).send(scarBody);
      expect(res.status).toBe(409);
      expect(repo.saveSheet).not.toHaveBeenCalled();
    });

    it('refuses a second choice in the same bout of Dying', async () => {
      vi.mocked(repo.getSheet).mockResolvedValue(hero({ DyingChoice: 'Scar' }));
      const res = await request(appAs('u-ryan')).post(url).send({ Choice: 'RiskDeath', Tier: 'Tier3' });
      expect(res.status).toBe(409);
      expect(repo.saveSheet).not.toHaveBeenCalled();
    });

    it('refuses a Dead Hero', async () => {
      vi.mocked(repo.getSheet).mockResolvedValue(hero({ LifeState: 'Dead' }));
      const res = await request(appAs('u-ryan')).post(url).send(scarBody);
      expect(res.status).toBe(409);
    });
  });
});

describe('DELETE /campaigns/:campaignId/sheets/:characterId/scars/:scarId', () => {
  const url = '/campaigns/cm-1/sheets/ch-ember/scars/s1';
  const withScar = (o: Partial<CharacterSheet> = {}) => hero({ Scars: [{ Id: 's1', Text: 'A scar', At: 't' }], ...o });
  beforeEach(() => {
    vi.mocked(repo.getSheet).mockResolvedValue(withScar());
  });

  it("lets the Hero's player remove a Scar", async () => {
    const res = await request(appAs('u-ryan')).delete(url);
    expect(res.status).toBe(200);
    expect(saved().Scars).toEqual([]);
  });

  it('lets the GM remove a Scar from any Hero', async () => {
    vi.mocked(repo.membershipFor).mockResolvedValue(gmMembership);
    expect((await request(appAs('u-mike')).delete(url)).status).toBe(200);
  });

  it('refuses another player', async () => {
    vi.mocked(repo.membershipFor).mockResolvedValue(otherPlayer);
    expect((await request(appAs('u-sam')).delete(url)).status).toBe(403);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('refuses a non-member', async () => {
    vi.mocked(repo.membershipFor).mockResolvedValue(null);
    expect((await request(appAs('u-stranger')).delete(url)).status).toBe(403);
  });

  it('is frozen on an Archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue(makeCampaign({ Status: 'Archived' }));
    expect((await request(appAs('u-ryan')).delete(url)).status).toBe(409);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('404s for a character in another campaign', async () => {
    vi.mocked(repo.getCharacter).mockResolvedValue({ ...character, CampaignId: 'cm-other' });
    expect((await request(appAs('u-ryan')).delete(url)).status).toBe(404);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('404s for an unknown Scar', async () => {
    expect((await request(appAs('u-ryan')).delete('/campaigns/cm-1/sheets/ch-ember/scars/nope')).status).toBe(404);
    expect(repo.saveSheet).not.toHaveBeenCalled();
  });

  it('is refused for a Retired Hero (read-only)', async () => {
    vi.mocked(repo.getSheet).mockResolvedValue(withScar({ LifeState: 'Retired' }));
    expect((await request(appAs('u-ryan')).delete(url)).status).toBe(409);
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Campaign, Character, Library, Membership } from '@asohav/shared';

vi.mock('../repo.js', () => ({
  getCampaign: vi.fn(),
  membershipFor: vi.fn(),
  insertCharacter: vi.fn(),
  saveSheet: vi.fn(),
  updateMembershipCharacter: vi.fn(),
  getLibrary: vi.fn(),
  getCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
}));

import * as repo from '../repo.js';
import { charactersRouter } from './characters.js';

function appAs(userId: string, isAdmin = false) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, name: 'Mike', email: 'mike@asohav.dev', isAdmin };
    next();
  });
  app.use('/campaigns/:campaignId/characters', charactersRouter);
  return app;
}

const campaign: Campaign = { Id: 'cm-2', Name: 'Seelie', GmUserId: 'u-ryan', CreatedAt: '2026-01-01T00:00:00Z', Status: 'Active', Phase: 'PartyCreation' };

const library = {
  virtues: [
    { Id: 'v-might', Name: 'Might', Tagline: '', Essence: '', UsageHelperText: '' },
    { Id: 'v-mettle', Name: 'Mettle', Tagline: '', Essence: '', UsageHelperText: '' },
    { Id: 'v-heart', Name: 'Heart', Tagline: '', Essence: '', UsageHelperText: '' },
    { Id: 'v-wit', Name: 'Wit', Tagline: '', Essence: '', UsageHelperText: '' },
    { Id: 'v-guile', Name: 'Guile', Tagline: '', Essence: '', UsageHelperText: '' },
  ],
  motifs: [{ Id: 'mo-sworn', Name: 'Sworn', Description: '', SkillTagExamples: [], FlawTagExamples: [] }],
  settings: { Id: 'set-1', PotentialTrackLength: 5, RapportTrackLength: 5, BondTrackLength: 5, StrainTrackLength: 5, ConditionFloor: -3, HealingTrackLength: 5, MinorStatusSlots: 3, MajorStatusSlots: 2, SevereStatusSlots: 1, GlossaryAutoLink: true },
} as unknown as Library;

const validVirtues = [
  { virtueId: 'v-might', score: 2 },
  { virtueId: 'v-mettle', score: 1 },
  { virtueId: 'v-heart', score: 1 },
  { virtueId: 'v-wit', score: 0 },
  { virtueId: 'v-guile', score: -1 },
];

const validMotifs = [
  { motifId: 'mo-sworn', name: 'Sworn', skillTag: 'Tracker', flawTag: 'Stripped of Honor', quest: 'Capture the Chosen One' },
  { motifId: null, name: 'Mystic', skillTag: 'Fire Sorcerer', flawTag: 'Hot-Headed', quest: 'Defeat my sister' },
  { motifId: null, name: 'Inheritor', skillTag: 'Royal Family', flawTag: 'Exiled', quest: 'Prove my worth' },
];
const validExtras = { looks: ['A scar above one eye.'], motifs: validMotifs };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.getCampaign).mockResolvedValue(campaign);
  vi.mocked(repo.getLibrary).mockResolvedValue(library);
});

describe('POST /campaigns/:campaignId/characters', () => {
  it('creates a character, sheet, and links the membership', async () => {
    const membership: Membership = { Id: 'mb-9', UserId: 'u-mike', CampaignId: 'cm-2', Role: 'Player', CharacterId: null };
    vi.mocked(repo.membershipFor).mockResolvedValue(membership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-2/characters').send({
      name: 'Wren',
      playerName: 'Mike',
      virtues: validVirtues,
      ...validExtras,
    });

    expect(res.status).toBe(201);
    expect(res.body.character).toMatchObject({ Name: 'Wren', PlayerName: 'Mike', CampaignId: 'cm-2' });
    expect(res.body.sheet.Motifs).toHaveLength(3);
    expect(repo.insertCharacter).toHaveBeenCalled();
    expect(repo.saveSheet).toHaveBeenCalled();
    expect(repo.updateMembershipCharacter).toHaveBeenCalledWith('mb-9', res.body.character.Id);
  });

  it('rejects a non-standard Virtue array', async () => {
    const membership: Membership = { Id: 'mb-9', UserId: 'u-mike', CampaignId: 'cm-2', Role: 'Player', CharacterId: null };
    vi.mocked(repo.membershipFor).mockResolvedValue(membership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-2/characters').send({
      name: 'Wren',
      playerName: 'Mike',
      virtues: validVirtues.map((v) => ({ ...v, score: 0 })),
      ...validExtras,
    });

    expect(res.status).toBe(400);
    expect(repo.insertCharacter).not.toHaveBeenCalled();
  });

  it('rejects an unknown Motif', async () => {
    const membership: Membership = { Id: 'mb-9', UserId: 'u-mike', CampaignId: 'cm-2', Role: 'Player', CharacterId: null };
    vi.mocked(repo.membershipFor).mockResolvedValue(membership);

    const badMotifs = [validMotifs[0], { ...validMotifs[1], motifId: 'mo-nonexistent' }, validMotifs[2]];
    const res = await request(appAs('u-mike')).post('/campaigns/cm-2/characters').send({
      name: 'Wren',
      playerName: 'Mike',
      virtues: validVirtues,
      ...validExtras,
      motifs: badMotifs,
    });

    expect(res.status).toBe(400);
  });

  it('refuses a GM membership', async () => {
    const gm: Membership = { Id: 'mb-1', UserId: 'u-ryan', CampaignId: 'cm-2', Role: 'GM', CharacterId: null };
    vi.mocked(repo.membershipFor).mockResolvedValue(gm);

    const res = await request(appAs('u-ryan')).post('/campaigns/cm-2/characters').send({
      name: 'Wren',
      playerName: 'Ryan',
      virtues: validVirtues,
      ...validExtras,
    });

    expect(res.status).toBe(403);
  });

  it('refuses when the membership already has a character', async () => {
    const membership: Membership = { Id: 'mb-9', UserId: 'u-mike', CampaignId: 'cm-2', Role: 'Player', CharacterId: 'ch-existing' };
    vi.mocked(repo.membershipFor).mockResolvedValue(membership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-2/characters').send({
      name: 'Wren',
      playerName: 'Mike',
      virtues: validVirtues,
      ...validExtras,
    });

    expect(res.status).toBe(409);
    expect(repo.insertCharacter).not.toHaveBeenCalled();
  });

  it('refuses to create a character on an archived campaign', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue({ ...campaign, Status: 'Archived' });
    const membership: Membership = { Id: 'mb-9', UserId: 'u-mike', CampaignId: 'cm-2', Role: 'Player', CharacterId: null };
    vi.mocked(repo.membershipFor).mockResolvedValue(membership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-2/characters').send({
      name: 'Wren',
      playerName: 'Mike',
      virtues: validVirtues,
      ...validExtras,
    });

    expect(res.status).toBe(409);
    expect(repo.insertCharacter).not.toHaveBeenCalled();
  });

  it('refuses to create a character outside the Party Creation phase', async () => {
    vi.mocked(repo.getCampaign).mockResolvedValue({ ...campaign, Phase: 'Signup' });
    const membership: Membership = { Id: 'mb-9', UserId: 'u-mike', CampaignId: 'cm-2', Role: 'Player', CharacterId: null };
    vi.mocked(repo.membershipFor).mockResolvedValue(membership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-2/characters').send({
      name: 'Wren',
      playerName: 'Mike',
      virtues: validVirtues,
      ...validExtras,
    });

    expect(res.status).toBe(409);
    expect(repo.insertCharacter).not.toHaveBeenCalled();
  });

  it('rejects an empty Looks list', async () => {
    const membership: Membership = { Id: 'mb-9', UserId: 'u-mike', CampaignId: 'cm-2', Role: 'Player', CharacterId: null };
    vi.mocked(repo.membershipFor).mockResolvedValue(membership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-2/characters').send({
      name: 'Wren',
      playerName: 'Mike',
      virtues: validVirtues,
      ...validExtras,
      looks: [],
    });

    expect(res.status).toBe(400);
    expect(repo.insertCharacter).not.toHaveBeenCalled();
  });

  it('rejects fewer than three Motifs', async () => {
    const membership: Membership = { Id: 'mb-9', UserId: 'u-mike', CampaignId: 'cm-2', Role: 'Player', CharacterId: null };
    vi.mocked(repo.membershipFor).mockResolvedValue(membership);

    const res = await request(appAs('u-mike')).post('/campaigns/cm-2/characters').send({
      name: 'Wren',
      playerName: 'Mike',
      virtues: validVirtues,
      ...validExtras,
      motifs: validMotifs.slice(0, 2),
    });

    expect(res.status).toBe(400);
    expect(repo.insertCharacter).not.toHaveBeenCalled();
  });
});

describe('DELETE /campaigns/:campaignId/characters/:id', () => {
  const wren: Character = { Id: 'ch-wren', Name: 'Wren', PlayerName: 'Mike', UserId: 'u-mike', CampaignId: 'cm-2' };

  it('deletes the character for a content admin', async () => {
    vi.mocked(repo.getCharacter).mockResolvedValue(wren);

    const res = await request(appAs('u-mike', true)).delete('/campaigns/cm-2/characters/ch-wren');

    expect(res.status).toBe(200);
    expect(repo.deleteCharacter).toHaveBeenCalledWith('ch-wren');
  });

  it('403s a non-admin', async () => {
    const res = await request(appAs('u-mike', false)).delete('/campaigns/cm-2/characters/ch-wren');

    expect(res.status).toBe(403);
    expect(repo.deleteCharacter).not.toHaveBeenCalled();
  });

  it("404s a character that belongs to a different campaign than the URL says", async () => {
    vi.mocked(repo.getCharacter).mockResolvedValue({ ...wren, CampaignId: 'cm-1' });

    const res = await request(appAs('u-mike', true)).delete('/campaigns/cm-2/characters/ch-wren');

    expect(res.status).toBe(404);
    expect(repo.deleteCharacter).not.toHaveBeenCalled();
  });
});

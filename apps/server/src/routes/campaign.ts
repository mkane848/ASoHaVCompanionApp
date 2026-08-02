import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  getCampaign,
  listMemberships,
  membershipFor,
  listCharacters,
  getParty,
  listBondsForCampaign,
  listInvites,
  insertInvite,
  deleteInvite,
  getSheet,
  listSheetsForCampaign,
  getLibrary,
  listUsers,
} from '../repo.js';
import { newId, nowIso, summaryFor, type CampaignBootstrap } from '@asohav/shared';

export const campaignRouter = Router();

campaignRouter.use(requireAuth);

campaignRouter.get('/:id/bootstrap', (req, res) => {
  const campaign = getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }

  const members = listMemberships(campaign.Id);
  const characters = listCharacters(campaign.Id);
  const party = getParty(campaign.Id);
  const bonds = listBondsForCampaign(campaign.Id);
  const isGM = membership.Role === 'GM';

  const body: CampaignBootstrap = {
    campaign,
    membership,
    members,
    users: listUsers(),
    characters,
    party: party!,
    bonds,
    invites: isGM ? listInvites(campaign.Id) : [],
    mySheet: !isGM && membership.CharacterId ? getSheet(membership.CharacterId) : null,
    peekSheets: {},
    peekSummaries: {},
  };

  if (isGM) {
    const lib = getLibrary();
    const sheets = listSheetsForCampaign(campaign.Id);
    for (const sheet of sheets) {
      body.peekSheets[sheet.CharacterId] = sheet;
      const character = characters.find((c) => c.Id === sheet.CharacterId);
      if (character) body.peekSummaries[sheet.CharacterId] = summaryFor(character, sheet, lib);
    }
  }

  res.json(body);
});

campaignRouter.post('/:id/invites', (req, res) => {
  const campaign = getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can send invites.' }); return; }
  const email = String(req.body?.email ?? '').trim();
  if (!email) { res.status(400).json({ error: 'Email is required.' }); return; }
  const invite = {
    Id: newId('inv'),
    CampaignId: campaign.Id,
    Email: email,
    Code: 'ROAD-' + Math.floor(1000 + Math.random() * 8999),
    SentAt: nowIso(),
    Status: 'Pending' as const,
  };
  insertInvite(invite);
  res.json({ invite });
});

campaignRouter.delete('/:id/invites/:inviteId', (req, res) => {
  const campaign = getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can revoke invites.' }); return; }
  deleteInvite(req.params.inviteId);
  res.json({ ok: true });
});

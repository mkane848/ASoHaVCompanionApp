import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  getCampaign,
  listMemberships,
  membershipFor,
  listCharacters,
  getParty,
  saveParty,
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

campaignRouter.get('/:id/bootstrap', async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }

  const members = await listMemberships(campaign.Id);
  const characters = await listCharacters(campaign.Id);
  let party = await getParty(campaign.Id);
  if (!party) {
    // A campaign should always have a party row once seeded/created; self-heal rather than
    // shipping a null the client isn't guarded against (CampaignBootstrap.party is non-nullable).
    party = { Id: newId('pt'), CampaignId: campaign.Id, Rapport: 0, RapportAdvancementsTaken: [], History: [], UpdatedAt: nowIso(), UpdatedBy: null };
    await saveParty(party);
  }
  const bonds = await listBondsForCampaign(campaign.Id);
  const isGM = membership.Role === 'GM';

  const body: CampaignBootstrap = {
    campaign,
    membership,
    members,
    users: await listUsers(),
    characters,
    party,
    bonds,
    invites: isGM ? await listInvites(campaign.Id) : [],
    mySheet: !isGM && membership.CharacterId ? await getSheet(membership.CharacterId) : null,
    peekSheets: {},
    peekSummaries: {},
  };

  if (isGM) {
    const lib = await getLibrary();
    const sheets = await listSheetsForCampaign(campaign.Id);
    for (const sheet of sheets) {
      body.peekSheets[sheet.CharacterId] = sheet;
      const character = characters.find((c) => c.Id === sheet.CharacterId);
      if (character) body.peekSummaries[sheet.CharacterId] = summaryFor(character, sheet, lib);
    }
  }

  res.json(body);
});

campaignRouter.post('/:id/invites', async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
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
  await insertInvite(invite);
  res.json({ invite });
});

campaignRouter.delete('/:id/invites/:inviteId', async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can revoke invites.' }); return; }
  await deleteInvite(req.params.inviteId);
  res.json({ ok: true });
});

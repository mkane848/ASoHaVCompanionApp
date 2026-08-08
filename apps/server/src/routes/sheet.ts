import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, membershipFor, getSheet, saveSheet, getCharacter } from '../repo.js';
import { assertCampaignActive, CampaignArchivedError, type CharacterSheet } from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

export const sheetRouter = Router({ mergeParams: true });

sheetRouter.use(requireAuth);

interface SheetParams {
  campaignId: string;
  characterId: string;
}

sheetRouter.get('/:characterId', wrap<SheetParams>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }
  const isOwner = membership.CharacterId === req.params.characterId;
  const isGM = membership.Role === 'GM';
  if (!isOwner && !isGM) { res.status(403).json({ error: 'You may only view your own sheet.' }); return; }
  const sheet = await getSheet(req.params.characterId);
  if (!sheet) { res.status(404).json({ error: 'No sheet for that character.' }); return; }
  res.json({ sheet });
}));

sheetRouter.put('/:characterId', wrap<SheetParams>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }
  if (membership.CharacterId !== req.params.characterId) {
    res.status(403).json({ error: 'You may only edit your own sheet.' });
    return;
  }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }
  const character = await getCharacter(req.params.characterId);
  if (!character) { res.status(404).json({ error: 'No such character.' }); return; }

  const incoming = req.body as CharacterSheet;
  incoming.Id = incoming.Id || `sh-${req.params.characterId}`;
  incoming.CharacterId = req.params.characterId;
  await saveSheet(incoming, campaign.Id);
  res.json({ sheet: incoming });
}));

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

/** GM-only manual clear of a Hero's Dying (V0.7 slice 8a). V0.7 gives no rule that ends Dying other
 *  than Risk Death's 10+ (slice 8b, not built), so until Ryan says otherwise the GM — like the Hero's
 *  own player, who edits their sheet through the PUT above — can lift it by hand. This route exists
 *  because `PUT` is owner-only. It touches only `Dying`; it is a read-modify-write on the sheet, so
 *  a concurrent save from the player's own client can still win the race, in which case the GM clears
 *  it again. */
sheetRouter.post('/:characterId/clear-dying', wrap<SheetParams>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }
  if (membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can clear Dying on another Hero.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }
  const character = await getCharacter(req.params.characterId);
  if (!character || character.CampaignId !== campaign.Id) { res.status(404).json({ error: 'No such character in this campaign.' }); return; }
  const sheet = await getSheet(req.params.characterId);
  if (!sheet) { res.status(404).json({ error: 'No sheet for that character.' }); return; }
  if (sheet.Dying) {
    sheet.Dying = false;
    await saveSheet(sheet, campaign.Id);
  }
  res.json({ sheet });
}));

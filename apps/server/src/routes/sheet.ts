import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, membershipFor, getSheet, saveSheet, getCharacter } from '../repo.js';
import {
  applyDyingChoice,
  assertCampaignActive,
  CampaignArchivedError,
  clearDyingState,
  DeathRuleError,
  isHeroOut,
  removeScar,
  type Campaign,
  type CharacterSheet,
  type DyingChoiceInput,
} from '@asohav/shared';
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
  // V0.7 slice 8b: a Dead or Retired Hero's sheet is read-only. Checked against the stored row so a
  // stale client cannot write the Hero back to Alive.
  const stored = await getSheet(req.params.characterId);
  if (stored && isHeroOut(stored)) { res.status(409).json({ error: 'This Hero is Dead or Retired; their sheet is read-only.' }); return; }

  const incoming = req.body as CharacterSheet;
  incoming.Id = incoming.Id || `sh-${req.params.characterId}`;
  incoming.CharacterId = req.params.characterId;
  await saveSheet(incoming, campaign.Id);
  res.json({ sheet: incoming });
}));

/** GM-only manual clear of a Hero's Dying (V0.7 slice 8a). V0.7 gives no rule that ends Dying other
 *  than Risk Death's 10+ (`dying-choice` below), so until Ryan says otherwise the GM — like the Hero's
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
  if (isHeroOut(sheet)) { res.status(409).json({ error: 'This Hero is Dead or Retired; their sheet is read-only.' }); return; }
  if (sheet.Dying) {
    clearDyingState(sheet);
    await saveSheet(sheet, campaign.Id);
  }
  res.json({ sheet });
}));

/** The checks every death-system route shares, in the order `clear-dying` uses: campaign, membership,
 *  who may act (the Hero's own player, or the GM for any Hero), the archive freeze, then that the
 *  character belongs to this campaign. Authorization stays here in Express, not in RLS. Returns null
 *  after sending the refusal. */
async function authorizeDeathRoute(req: Request<SheetParams>, res: Response): Promise<{ campaign: Campaign; sheet: CharacterSheet } | null> {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return null; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return null; }
  const isOwner = membership.CharacterId === req.params.characterId;
  if (!isOwner && membership.Role !== 'GM') { res.status(403).json({ error: 'Only the Hero\u2019s player or the GM can do this.' }); return null; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return null; }
    throw err;
  }
  const character = await getCharacter(req.params.characterId);
  if (!character || character.CampaignId !== campaign.Id) { res.status(404).json({ error: 'No such character in this campaign.' }); return null; }
  const sheet = await getSheet(req.params.characterId);
  if (!sheet) { res.status(404).json({ error: 'No sheet for that character.' }); return null; }
  return { campaign, sheet };
}

/** Records a Dying Hero's choice (V0.7 slice 8b, L615-656): Take a Scar, Risk Death at the tier the
 *  table reported, or a Blaze of Glory. The app never rolls: `Tier` is what the player (or GM)
 *  reports. See `applyDyingChoice` for the rules, and the Dead / Retired states it can leave. */
sheetRouter.post('/:characterId/dying-choice', wrap<SheetParams>(async (req, res) => {
  const ctx = await authorizeDeathRoute(req, res);
  if (!ctx) return;
  try {
    const outcome = applyDyingChoice(ctx.sheet, req.body as DyingChoiceInput);
    await saveSheet(ctx.sheet, ctx.campaign.Id);
    res.json({ sheet: ctx.sheet, outcome });
  } catch (err) {
    if (err instanceof DeathRuleError) { res.status(err.status).json({ error: err.message }); return; }
    throw err;
  }
}));

/** Scar reversal: the Hero's player or the GM removes a Scar by hand. Never un-retires a Hero. */
sheetRouter.delete('/:characterId/scars/:scarId', wrap<SheetParams & { scarId: string }>(async (req, res) => {
  const ctx = await authorizeDeathRoute(req, res);
  if (!ctx) return;
  if (isHeroOut(ctx.sheet)) { res.status(409).json({ error: 'This Hero is Dead or Retired; their sheet is read-only.' }); return; }
  if (!removeScar(ctx.sheet, req.params.scarId)) { res.status(404).json({ error: 'No such Scar on this Hero.' }); return; }
  await saveSheet(ctx.sheet, ctx.campaign.Id);
  res.json({ sheet: ctx.sheet });
}));

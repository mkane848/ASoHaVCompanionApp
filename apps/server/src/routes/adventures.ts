import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { deleteAdventure, getCampaign, listAdventuresForCampaign, membershipFor, saveAdventure } from '../repo.js';
import { assertCampaignActive, CampaignArchivedError, newAdventure, type Adventure, type AdventureType } from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

export const adventuresRouter = Router({ mergeParams: true });

adventuresRouter.use(requireAuth);

const ADVENTURE_TYPE_KEYS: AdventureType[] = ['Offensive', 'Stand', 'Race', 'Mission', 'Mystery', 'Journey'];

// GM-only, all three routes below — Adventure prep is a GM authoring tool (Concept/Villain/
// Secrets/Countdown are all spoiler content), unlike Combat/Clocks where any campaign member may
// act. campaign.ts's bootstrap route only fetches this collection for a GM membership in the
// first place, so a Player never even has the data to attempt one of these against — see
// CLAUDE.md's "Architecture: Adventures" for the full reasoning.

adventuresRouter.post('/', wrap<{ campaignId: string }>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can start an Adventure.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  const concept = String(req.body?.concept ?? '').trim();
  if (!concept) { res.status(400).json({ error: 'Give the Adventure a Concept.' }); return; }
  const type = req.body?.type ?? null;
  if (type !== null && !ADVENTURE_TYPE_KEYS.includes(type)) { res.status(400).json({ error: 'Invalid Adventure Type.' }); return; }
  const hook = String(req.body?.hook ?? '').trim();

  const adventure: Adventure = newAdventure({ CampaignId: campaign.Id, Concept: concept, Type: type, Hook: hook });
  await saveAdventure(adventure);
  res.status(201).json({ adventure });
}));

// Whole-document replace, GM-only — trusted the same way Combat's Encounter PUT and Clocks' PUT
// are, just scoped to the GM rather than any campaign member (see the module comment above).
adventuresRouter.put('/:adventureId', wrap<{ campaignId: string; adventureId: string }>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can edit an Adventure.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  const existing = (await listAdventuresForCampaign(campaign.Id)).find((a) => a.Id === req.params.adventureId);
  if (!existing) { res.status(404).json({ error: 'No such Adventure.' }); return; }

  const incoming: Adventure = {
    ...existing,
    ...(req.body as Partial<Adventure>),
    Id: existing.Id,
    CampaignId: campaign.Id,
  };
  await saveAdventure(incoming);
  res.json({ adventure: incoming });
}));

// GM-only — removes the Adventure entirely, same "no history requirement" trust model Clocks
// already established (unlike an Encounter, never deleted, only Ended).
adventuresRouter.delete('/:adventureId', wrap<{ campaignId: string; adventureId: string }>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can remove an Adventure.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  const existing = (await listAdventuresForCampaign(campaign.Id)).find((a) => a.Id === req.params.adventureId);
  if (!existing) { res.status(404).json({ error: 'No such Adventure.' }); return; }

  await deleteAdventure(existing.Id);
  res.status(204).end();
}));

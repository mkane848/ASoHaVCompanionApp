import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, membershipFor, getWorld, saveWorld } from '../repo.js';
import { assertCampaignActive, CampaignArchivedError, newWorld, nowIso, type World } from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

export const worldRouter = Router({ mergeParams: true });

worldRouter.use(requireAuth);

// Any campaign member — World-building is explicitly collaborative ("everyone is going to add a
// region to the map... including the GM"), same trust model as `party.ts`'s PUT: a trusted
// whole-document replace, not gated to any one role or to the campaign's Signup phase (see
// `World`'s own doc comment for why this stays reachable for the campaign's whole life rather than
// locking after Signup).
worldRouter.put('/', wrap<{ campaignId: string }>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  const existing = (await getWorld(campaign.Id)) ?? newWorld(campaign.Id);
  const incoming: World = {
    ...existing,
    ...(req.body as Partial<World>),
    Id: existing.Id,
    CampaignId: campaign.Id,
    UpdatedAt: nowIso(),
    UpdatedBy: req.user!.id,
  };

  await saveWorld(incoming);
  res.json({ world: incoming });
}));

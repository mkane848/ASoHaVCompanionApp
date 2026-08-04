import express, { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, membershipFor, getParty, saveParty } from '../repo.js';
import { assertCampaignActive, CampaignArchivedError, nowIso, type Party } from '@asohav/shared';

export const partyRouter = Router({ mergeParams: true });

partyRouter.use(requireAuth);

partyRouter.put('/', async (req: express.Request<{ campaignId: string }>, res) => {
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

  const existing = await getParty(campaign.Id);
  const incoming: Party = {
    ...(existing as Party),
    ...(req.body as Partial<Party>),
    Id: existing?.Id ?? `pt-${campaign.Id}`,
    CampaignId: campaign.Id,
    UpdatedAt: nowIso(),
    UpdatedBy: req.user!.id,
  };
  await saveParty(incoming);
  res.json({ party: incoming });
});

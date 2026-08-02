import express, { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, membershipFor, getParty, saveParty } from '../repo.js';
import { broadcastToCampaign } from '../ws.js';
import { nowIso, type Party } from '@asohav/shared';

export const partyRouter = Router({ mergeParams: true });

partyRouter.use(requireAuth);

partyRouter.put('/', (req: express.Request<{ campaignId: string }>, res) => {
  const campaign = getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }

  const existing = getParty(campaign.Id);
  const incoming: Party = {
    ...(existing as Party),
    ...(req.body as Partial<Party>),
    Id: existing?.Id ?? `pt-${campaign.Id}`,
    CampaignId: campaign.Id,
    UpdatedAt: nowIso(),
    UpdatedBy: req.user!.id,
  };
  saveParty(incoming);
  broadcastToCampaign(campaign.Id, { type: 'party:update', campaignId: campaign.Id, party: incoming });
  res.json({ party: incoming });
});

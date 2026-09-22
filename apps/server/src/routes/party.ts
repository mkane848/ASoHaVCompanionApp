import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, membershipFor, getParty, saveParty } from '../repo.js';
import { assertCampaignActive, CampaignArchivedError, nowIso, type Party } from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

export const partyRouter = Router({ mergeParams: true });

partyRouter.use(requireAuth);

partyRouter.put('/', wrap<{ campaignId: string }>(async (req, res) => {
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

  // Rapport is floored at 0 server-side (a client must not push it negative), but it is
  // deliberately NOT capped at RapportTrackLength — V0.6 slice 7 made overflow bank until
  // Make Camp, and capping here silently discarded it on every save (fixed in 0.54.2).
  incoming.Rapport = Math.max(0, incoming.Rapport);

  await saveParty(incoming);
  res.json({ party: incoming });
}));

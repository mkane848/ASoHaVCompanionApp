import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, membershipFor, getParty, saveParty, getLibrary } from '../repo.js';
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

  // Rapport is now a live spend surface (Aid, V0.5) rather than a display-only counter, so an
  // out-of-range value written here isn't just cosmetic — it lets a client bank more Aid than
  // the track allows or push it negative. Clamp server-side rather than trusting the client,
  // same reasoning as every other mutating route in this app (see CLAUDE.md's authorization note).
  const library = await getLibrary();
  incoming.Rapport = Math.max(0, Math.min(incoming.Rapport, library.settings.RapportTrackLength));

  await saveParty(incoming);
  res.json({ party: incoming });
}));

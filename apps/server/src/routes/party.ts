import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, membershipFor, getParty, saveParty } from '../repo.js';
import { assertCampaignActive, CampaignArchivedError, nowIso, type Party, applyMisfortune, type MisfortuneAction, MISFORTUNE_ACTIONS, NoMisfortuneError } from '@asohav/shared';
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

  // Misfortune is a GM resource on a member-writable document: this PUT keeps the stored value, and
  // every change goes through POST /misfortune below.
  incoming.Misfortune = existing?.Misfortune ?? 1;

  // Rapport is floored at 0 server-side (a client must not push it negative), but it is
  // deliberately NOT capped at RapportTrackLength — V0.6 slice 7 made overflow bank until
  // Make Camp, and capping here silently discarded it on every save (fixed in 0.54.2).
  incoming.Rapport = Math.max(0, incoming.Rapport);

  await saveParty(incoming);
  res.json({ party: incoming });
}));

partyRouter.post('/misfortune', wrap<{ campaignId: string }>(async (req, res) => {
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

  const action: MisfortuneAction | null = req.body?.Action ?? null;
  if (!action || !MISFORTUNE_ACTIONS.includes(action)) { res.status(400).json({ error: 'Invalid Misfortune Action.' }); return; }

  const note = String(req.body?.Note ?? '').trim();

  if (action === 'Gain') {
    // Any member may report Misfortune gained from a 6-.
    if (!note) { res.status(400).json({ error: 'Say what earned the Misfortune.' }); return; }
  } else {
    // Spend, Reset, BeginSession: GM only.
    if (membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can spend or reset Misfortune.' }); return; }
  }

  const party = await getParty(campaign.Id);
  if (!party) { res.status(404).json({ error: 'No party exists for this campaign.' }); return; }

  const noteForApply = note || (action === 'Spend' ? 'A Hard Move' : '');

  try {
    applyMisfortune(party, action, noteForApply, req.user!.id);
  } catch (err) {
    if (err instanceof NoMisfortuneError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  party.UpdatedAt = nowIso();
  party.UpdatedBy = req.user!.id;
  await saveParty(party);
  res.json({ party });
}));

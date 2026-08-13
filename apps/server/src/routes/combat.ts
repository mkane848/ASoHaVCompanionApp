import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getActiveEncounter, getCampaign, getParty, listEncountersForCampaign, membershipFor, saveEncounter, saveParty } from '../repo.js';
import { assertCampaignActive, CampaignArchivedError, newId, nowIso, type Encounter } from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

export const combatRouter = Router({ mergeParams: true });

combatRouter.use(requireAuth);

// GM-only — starts a new Encounter. Fails if one is already Active, mirroring the Bond
// handshake's "only one PendingChange at a time" shape rather than allowing overlapping fights.
combatRouter.post('/start', wrap<{ campaignId: string }>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can start Combat.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  const existing = await getActiveEncounter(campaign.Id);
  if (existing) { res.status(409).json({ error: 'An Encounter is already active.' }); return; }

  // Grants +1 Rapport (capped at 5) — not yet a confirmed rule against the Combat Basics draft
  // (see HANDOFF open issue 13), but the repo owner asked to keep the existing bump and make it
  // visible rather than remove a mechanic that might be real. Landing it here, in the same
  // request as the Encounter, replaces the old arrangement of two separate client calls
  // (lifecycle.start() plus its own commitParty()) where a failure on either side could leave
  // one half done and not the other.
  const encounter: Encounter = {
    Id: newId('enc'),
    CampaignId: campaign.Id,
    Status: 'Active',
    CombatGoal: String(req.body?.combatGoal ?? '').trim(),
    DefiantGoals: [],
    Round: 1,
    ActingSide: null,
    Participants: [],
    PendingStatusOffers: [],
    History: [{ Id: newId('ch'), At: nowIso(), Text: 'Combat started (+1 Rapport).' }],
    CreatedAt: nowIso(),
    UpdatedAt: nowIso(),
  };
  await saveEncounter(encounter);

  const party = await getParty(campaign.Id);
  if (party) {
    party.Rapport = Math.min(5, party.Rapport + 1);
    await saveParty(party);
  }

  res.status(201).json({ encounter });
}));

// Any campaign member — Combat is track-and-display, not enforced server-side (see CLAUDE.md's
// Combat architecture note), so this is a trusted whole-document replace, same trust model as
// party.ts's PUT. Status can't be flipped through here; see /end below for that transition.
combatRouter.put('/:encounterId', wrap<{ campaignId: string; encounterId: string }>(async (req, res) => {
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

  const existing = (await listEncountersForCampaign(campaign.Id)).find((e) => e.Id === req.params.encounterId);
  if (!existing) { res.status(404).json({ error: 'No such Encounter.' }); return; }

  const incoming: Encounter = {
    ...existing,
    ...(req.body as Partial<Encounter>),
    Id: existing.Id,
    CampaignId: campaign.Id,
    Status: existing.Status,
  };
  await saveEncounter(incoming);
  res.json({ encounter: incoming });
}));

// GM-only — ends the Encounter. A dedicated route rather than allowing Status through the PUT
// above, matching campaign.ts's pattern of a dedicated route for a meaningful lifecycle
// transition (see its /status and /phase routes).
combatRouter.post('/:encounterId/end', wrap<{ campaignId: string; encounterId: string }>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can end Combat.' }); return; }

  const existing = (await listEncountersForCampaign(campaign.Id)).find((e) => e.Id === req.params.encounterId);
  if (!existing) { res.status(404).json({ error: 'No such Encounter.' }); return; }

  const encounter: Encounter = { ...existing, Status: 'Ended' };
  await saveEncounter(encounter);
  res.json({ encounter });
}));

import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getActiveEncounter, getCampaign, getParty, getSheet, listEncountersForCampaign, membershipFor, saveEncounter, saveParty, saveSheet } from '../repo.js';
import { assertCampaignActive, assertPlayingPhase, CampaignArchivedError, combatStartRapportDelta, newId, nowIso, PlayingRequiredError, type CharacterSheet, type Encounter } from '@asohav/shared';
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
    assertPlayingPhase(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    if (err instanceof PlayingRequiredError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  const existing = await getActiveEncounter(campaign.Id);
  if (existing) { res.status(409).json({ error: 'An Encounter is already active.' }); return; }

  // Combat Loop step 2, "Adjust Rapport" (revised V0.6, slice 4): +1 when the Heroes initiated and
  // all share the Combat Goal; -1 instead when they did not initiate, or begin ill-prepared or
  // off-balance; otherwise no change (`combatStartRapportDelta`). The GM answers the three
  // questions on the start form. Landing the Rapport write in the same request as the Encounter
  // (rather than two separate client calls) means a failure on either side can't leave one half
  // done and not the other.
  const initiatedByHeroes = !!req.body?.initiatedByHeroes;
  const sharedGoal = !!req.body?.sharedGoal;
  const illPreparedOrOffBalance = !!req.body?.illPreparedOrOffBalance;
  const rapportDelta = combatStartRapportDelta({ initiatedByHeroes, sharedGoal, illPreparedOrOffBalance });
  const rapportNote = rapportDelta > 0 ? '+1 Rapport' : rapportDelta < 0 ? '-1 Rapport' : 'no Rapport change';

  const encounter: Encounter = {
    Id: newId('enc'),
    CampaignId: campaign.Id,
    Status: 'Active',
    CombatGoal: String(req.body?.combatGoal ?? '').trim(),
    CombatGoalAchieved: false,
    DefiantGoals: [],
    Round: 1,
    ActingSide: null,
    ActingParticipantId: null,
    PairedParticipantId: null,
    FirstSide: null,
    Participants: [],
    PendingStrainOffers: [],
    History: [{ Id: newId('ch'), At: nowIso(), Text: `Combat started (${rapportNote}).` }],
    CreatedAt: nowIso(),
    UpdatedAt: nowIso(),
  };
  await saveEncounter(encounter);

  if (rapportDelta !== 0) {
    const party = await getParty(campaign.Id);
    if (party) {
      // V0.6 slice 7: no longer capped at 5 — a Rapport overflow beyond the track length is
      // banked until the next Make Camp rather than lost (see logic.ts's
      // applyPartyRapportAdvance/spendRapportForAid doc comments for the full mechanic).
      party.Rapport = Math.max(0, party.Rapport + rapportDelta);
      await saveParty(party);
    }
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
  // Both siblings (/start and the PUT above) assert this; this route was missed until 0.50.0.
  // A campaign archived mid-fight already can't have its Encounter updated, so being able to
  // end it was the odd one out rather than a useful escape hatch — unarchive first.
  assertCampaignActive(campaign);

  const existing = (await listEncountersForCampaign(campaign.Id)).find((e) => e.Id === req.params.encounterId);
  if (!existing) { res.status(404).json({ error: 'No such Encounter.' }); return; }

  // Revised V0.6, "Ending Combat": "When Combat ends: … Clear all Strain." The GM ending it is the
  // trigger, so this writes each Hero's sheet server-side; `character_sheets` is Realtime-synced,
  // so every open sheet picks the change up. Only sheets with Strain marked are saved.
  const sheets = await Promise.all(existing.Participants.filter((p) => p.Kind === 'PC').map((p) => getSheet(p.RefId)));
  await Promise.all(
    sheets
      .filter((s): s is CharacterSheet => !!s && s.Strain.some(Boolean))
      .map((s) => saveSheet({ ...s, Strain: s.Strain.map(() => false) }, campaign.Id)),
  );

  const encounter: Encounter = {
    ...existing,
    Status: 'Ended',
    History: [
      { Id: newId('ch'), At: nowIso(), Text: 'Combat ended — every Hero\'s Strain is cleared.' },
      ...existing.History,
    ],
  };
  await saveEncounter(encounter);
  res.json({ encounter });
}));

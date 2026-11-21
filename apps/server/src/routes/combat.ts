import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getActiveEncounter, getCampaign, getLibrary, getParty, getSheet, listCharacters, listEncountersForCampaign, membershipFor, saveEncounter } from '../repo.js';
import { changeEncounter, changeParty } from '../documentWrites.js';
import { isHeroOut, assertCampaignActive, assertPlayingPhase, CampaignArchivedError, combatStartRapportDelta, DEFAULT_RAPPORT_CAP, markRapport, newId, normalizeEncounter, nowIso, PlayingRequiredError, type CharacterSheet, type Encounter } from '@asohav/shared';
import { wrap } from '../asyncHandler.js';
import { objectBody, takeExpectedUpdatedAt } from '../body.js';
import { changeSheet } from '../sheetWrites.js';

export const combatRouter = Router({ mergeParams: true });

const ENDED_MESSAGE = 'This Combat has already ended.';

/** 409 via errorMiddleware: another request ended the Encounter between this one's read and save. */
class EncounterEndedError extends Error {
  readonly status = 409;
  constructor() {
    super(ENDED_MESSAGE);
  }
}

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
    PendingEnemyHits: [],
    History: [{ Id: newId('ch'), At: nowIso(), Text: `Combat started (${rapportNote}).` }],
    CreatedAt: nowIso(),
    UpdatedAt: nowIso(),
  };
  try {
    await saveEncounter(encounter);
  } catch (err) {
    // The pre-check above is a read-then-write, so two simultaneous Starts can both pass it. The
    // partial unique index idx_combat_encounters_one_active (one Active Encounter per campaign)
    // is the backstop: the loser gets Postgres 23505, surfaced by supabase-js as error.code.
    if ((err as { code?: string } | null)?.code === '23505') {
      res.status(409).json({ error: 'A Combat is already running in this campaign.' });
      return;
    }
    throw err;
  }

  if (rapportDelta !== 0) {
    const party = await getParty(campaign.Id);
    if (party) {
      // V0.7 L2034: Rapport holds at most the track length, so the +1 stops at the cap (the V0.6 slice 7
      // banking was reversed, docs/decisions.md item 66 D1); the -1 floors at 0.
      const cap = (await getLibrary())?.settings?.RapportTrackLength ?? DEFAULT_RAPPORT_CAP;
      await changeParty(party, (p) => { markRapport(p, rapportDelta, cap); });
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
  // An Ended Encounter is history: nothing changes it. A save from a tab that had not yet seen the
  // end used to be stored onto it.
  if (existing.Status !== 'Active') { res.status(409).json({ error: ENDED_MESSAGE }); return; }

  const body = objectBody(req.body, res);
  if (!body) return;
  // Optional stale-save precondition; see repo.ts's updateIfUnchanged.
  const expectedUpdatedAt = takeExpectedUpdatedAt(body);
  const incoming: Encounter = normalizeEncounter({
    ...existing,
    ...(body as Partial<Encounter>),
    Id: existing.Id,
    CampaignId: campaign.Id,
    Status: existing.Status,
  });
  // Defense in depth for "Next Round" (the client PUTs the whole Encounter with Round + 1). The
  // server cannot tell a double-tap from two real rounds, so this only refuses what no flow
  // produces: Round only ever stays the same or goes up by exactly 1 per save (EncounterHeader is
  // the sole writer; nothing else edits Round). Combat is otherwise a trusted whole-document replace.
  if (incoming.Round !== existing.Round) {
    if (!Number.isInteger(incoming.Round) || incoming.Round < existing.Round || incoming.Round > existing.Round + 1) {
      res.status(409).json({ error: 'That Round change is out of step with the saved Combat. Reload and try again.' });
      return;
    }
  }
  await saveEncounter(incoming, expectedUpdatedAt);
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
  // Ending is a one-way step. A second End (a stale tab, a retried request) used to run the Strain
  // clear below again, erasing Strain the Heroes had marked since.
  if (existing.Status !== 'Active') { res.status(409).json({ error: ENDED_MESSAGE }); return; }

  // The end is saved first, and only over the copy just read (re-read once on a conflict, which
  // must still be Active): that save is the one-way step. Two Ends at the same moment both pass the
  // check above, but only one can make this save, so only one goes on to clear Strain below. With
  // the clear first, as before 0.86.1, the loser's clear could land after the Heroes had marked
  // Strain again (state-machine model check). The cost of this order: if a sheet save below fails,
  // the Encounter is already Ended, so that Hero's Strain is cleared by hand.
  const { encounter } = await changeEncounter(existing, (e) => {
    if (e.Status !== 'Active') throw new EncounterEndedError();
    e.Status = 'Ended';
    e.History = [
      { Id: newId('ch'), At: nowIso(), Text: e.CombatGoalAchieved
          ? 'Combat ended — the Combat Goal was achieved; every Hero\'s Strain is cleared.'
          : 'Combat ended — the Combat Goal was not achieved; Strain stays marked.' },
      ...e.History,
    ];
  });

  // V0.7, "Ending Combat" (L5963-5984): Strain clears when the Heroes achieve the Combat Goal. When
  // they fail it they concede and the table (or the GM, spending Drama) decides what follows, so Strain
  // stays marked. The GM ending it is the trigger, so this writes each Hero's sheet server-side;
  // `character_sheets` is Realtime-synced, so every open sheet picks the change up. Only sheets with
  // Strain marked are saved. (V0.7 L525 says "after any Scene or Combat" — Ryan's call; see decisions 69.)
  // Read from the copy that was saved as Ended, not the first read, in case they differ.
  if (encounter.CombatGoalAchieved) {
    // `Participants` arrives through the member-writable PUT above, so a `RefId` is not trusted to be
    // one of this campaign's Heroes: only characters that are get their sheet read and re-saved.
    // Without the filter a foreign character id had its Strain cleared and its sheet row re-homed
    // to this campaign (`saveSheet` writes `campaign_id`).
    const ownCharacterIds = new Set((await listCharacters(campaign.Id)).map((c) => c.Id));
    const sheets = await Promise.all(
      encounter.Participants.filter((p) => p.Kind === 'PC' && ownCharacterIds.has(p.RefId)).map((p) => getSheet(p.RefId)),
    );
    await Promise.all(
      sheets
        // A Dead or Retired Hero's sheet is read-only: their Strain stays as it was.
        .filter((s): s is CharacterSheet => !!s && !isHeroOut(s) && s.Strain.some(Boolean))
        // Checked against the copy just read, with one retry: a player saving their sheet at the
        // moment Combat ends used to have that save erased, or to erase this one.
        .map((s) => changeSheet(s, campaign.Id, (sheet) => { sheet.Strain = sheet.Strain.map(() => false); })),
    );
  }

  res.json({ encounter });
}));

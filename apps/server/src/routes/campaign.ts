import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth.js';
import {
  getCampaign,
  listMemberships,
  membershipFor,
  listCharacters,
  getParty,
  saveParty,
  getActiveEncounter,
  listBondsForCampaign,
  listInvites,
  insertInvite,
  deleteInvite,
  getSheet,
  listSheetsForCampaign,
  getLibrary,
  listUsers,
  insertCampaign,
  insertMembership,
  deleteCampaign,
  updateCampaignStatus,
  updateCampaignPhase,
  updateMembershipReady,
} from '../repo.js';
import {
  assertCampaignActive,
  assertValidPhaseTransition,
  campaignPhase,
  CampaignArchivedError,
  InvalidPhaseTransitionError,
  newId,
  nowIso,
  summaryFor,
  type Campaign,
  type CampaignBootstrap,
  type CampaignPhase,
  type CampaignStatus,
  type Membership,
  type Party,
} from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

export const campaignRouter = Router();

campaignRouter.use(requireAuth);

campaignRouter.post('/', wrap(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) { res.status(400).json({ error: 'Campaign name is required.' }); return; }

  const campaign: Campaign = { Id: newId('cm'), Name: name, GmUserId: req.user!.id, CreatedAt: nowIso(), Status: 'Active', Phase: 'Signup' };
  await insertCampaign(campaign);

  // The creator becomes GM — mirrors seed.ts, which gives the GM a membership with no
  // character (GMs peek at players' sheets rather than keeping their own).
  const membership: Membership = { Id: newId('mb'), UserId: req.user!.id, CampaignId: campaign.Id, Role: 'GM', CharacterId: null };
  await insertMembership(membership);

  const party: Party = { Id: newId('pt'), CampaignId: campaign.Id, Rapport: 0, RapportAdvancementsTaken: [], History: [], UpdatedAt: nowIso(), UpdatedBy: null };
  await saveParty(party);

  res.status(201).json({ campaign, membership });
}));

campaignRouter.get('/:id/bootstrap', wrap(async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }

  const members = await listMemberships(campaign.Id);
  const characters = await listCharacters(campaign.Id);
  let party = await getParty(campaign.Id);
  if (!party) {
    // A campaign should always have a party row once seeded/created; self-heal rather than
    // shipping a null the client isn't guarded against (CampaignBootstrap.party is non-nullable).
    party = { Id: newId('pt'), CampaignId: campaign.Id, Rapport: 0, RapportAdvancementsTaken: [], History: [], UpdatedAt: nowIso(), UpdatedBy: null };
    await saveParty(party);
  }
  const bonds = await listBondsForCampaign(campaign.Id);
  const isGM = membership.Role === 'GM';

  const body: CampaignBootstrap = {
    campaign,
    membership,
    members,
    users: await listUsers(),
    characters,
    party,
    bonds,
    invites: isGM ? await listInvites(campaign.Id) : [],
    mySheet: !isGM && membership.CharacterId ? await getSheet(membership.CharacterId) : null,
    peekSheets: {},
    peekSummaries: {},
    encounter: await getActiveEncounter(campaign.Id),
  };

  // GMs peek at every sheet, full detail. Everyone else additionally gets a read-only summary
  // (Statuses/Load/Potential — the same shape PeekCard already shows) for any PC currently a
  // participant in the Active Encounter, so a live fight is visible to the whole table, not
  // just the GM — sheets otherwise stay owner-only (see sheet.ts's PUT authorization).
  const combatCharacterIds = new Set(
    (body.encounter?.Status === 'Active' ? body.encounter.Participants : [])
      .filter((p) => p.Kind === 'PC')
      .map((p) => p.RefId),
  );
  if (isGM || combatCharacterIds.size > 0) {
    const lib = await getLibrary();
    const sheets = await listSheetsForCampaign(campaign.Id);
    for (const sheet of sheets) {
      const character = characters.find((c) => c.Id === sheet.CharacterId);
      if (!character) continue;
      if (isGM) body.peekSheets[sheet.CharacterId] = sheet;
      if (isGM || combatCharacterIds.has(sheet.CharacterId)) {
        body.peekSummaries[sheet.CharacterId] = summaryFor(character, sheet, lib);
      }
    }
  }

  res.json(body);
}));

campaignRouter.post('/:id/invites', wrap(async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can send invites.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }
  const email = String(req.body?.email ?? '').trim();
  if (!email) { res.status(400).json({ error: 'Email is required.' }); return; }
  const invite = {
    Id: newId('inv'),
    CampaignId: campaign.Id,
    Email: email,
    Code: 'ROAD-' + Math.floor(1000 + Math.random() * 8999),
    SentAt: nowIso(),
    Status: 'Pending' as const,
  };
  await insertInvite(invite);
  res.json({ invite });
}));

campaignRouter.delete('/:id/invites/:inviteId', wrap(async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can revoke invites.' }); return; }
  await deleteInvite(req.params.inviteId);
  res.json({ ok: true });
}));

// GM-only — archiving is a label, not a delete (that's the admin-only route below). Freezes
// further play-state mutations on this campaign (see assertCampaignActive, called from every
// other mutating route this campaign touches: invites, bond propose/accept/reject, sheet/party
// edits, character creation) until unarchived.
campaignRouter.patch('/:id/status', wrap(async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can archive or unarchive this campaign.' }); return; }
  const status = req.body?.status as CampaignStatus;
  if (status !== 'Active' && status !== 'Archived') { res.status(400).json({ error: "Status must be 'Active' or 'Archived'." }); return; }
  await updateCampaignStatus(campaign.Id, status);
  res.json({ campaign: { ...campaign, Status: status } });
}));

// GM-only — advances (or, from PartyCreation, reopens) the campaign-setup workflow. See
// CAMPAIGN_PHASE_TRANSITIONS in packages/shared/src/logic.ts for the allowed moves; this is the
// only route that changes Phase.
campaignRouter.patch('/:id/phase', wrap(async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can change the campaign phase.' }); return; }
  const phase = req.body?.phase as CampaignPhase;
  if (phase !== 'Signup' && phase !== 'PartyCreation' && phase !== 'Playing') {
    res.status(400).json({ error: "Phase must be 'Signup', 'PartyCreation', or 'Playing'." });
    return;
  }
  try {
    assertValidPhaseTransition(campaignPhase(campaign), phase);
  } catch (err) {
    if (err instanceof InvalidPhaseTransitionError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }
  await updateCampaignPhase(campaign.Id, phase);
  res.json({ campaign: { ...campaign, Phase: phase } });
}));

// Player-only — marks (or unmarks) the caller's own readiness during Party Creation. Read by the
// GM's "N / M ready" readout rather than gating anything server-side itself.
campaignRouter.patch('/:id/ready', wrap(async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'Player') { res.status(403).json({ error: 'Only a player can mark themselves ready.' }); return; }
  if (!membership.CharacterId) { res.status(409).json({ error: 'Create your character before marking yourself ready.' }); return; }
  const ready = Boolean(req.body?.ready);
  await updateMembershipReady(membership.Id, ready);
  res.json({ membership: { ...membership, Ready: ready } });
}));

// Content-admin-only, distinct from the GM self-service actions above — a GM can't delete their
// own campaign through this route. See apps/server/src/routes/admin.ts for the list view this
// pairs with.
campaignRouter.delete('/:id', requireAdmin, wrap(async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  await deleteCampaign(campaign.Id);
  res.json({ ok: true });
}));

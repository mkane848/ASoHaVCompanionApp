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
  listClocksForCampaign,
  listAdventuresForCampaign,
  listBondsForCampaign,
  listInvites,
  insertInvite,
  getInvite,
  getInviteByCode,
  deleteInvite,
  getSheet,
  listSheetsForCampaign,
  getLibrary,
  listUsersByIds,
  insertCampaign,
  insertMembership,
  deleteCampaign,
  updateCampaignStatus,
  updateCampaignPhase,
  updateMembershipReady,
} from '../repo.js';
import { sendInviteEmail } from '../email.js';
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

// No 0/O or 1/I — avoids a code that's ambiguous when read aloud or copied by hand. 8 characters
// over this 32-symbol alphabet is ~32^8 (~1.1 trillion) possibilities, wide enough that the retry
// loop below is a formality, not a real mitigation for a code this app now puts in an emailed URL
// (WorkPlan-0.37.0.md Issue 17 — the old 4-digit '1000-9999' range was thin enough that two
// campaigns colliding was concretely reachable).
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_MAX_ATTEMPTS = 5;

function randomInviteCodeSuffix(): string {
  let s = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    s += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return s;
}

/** Existing codes (the old 'ROAD-1234' shape) keep working — `getInviteByCode` is an exact,
 *  format-agnostic match — so this only changes what a *new* invite's code looks like. */
async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt++) {
    const code = 'ROAD-' + randomInviteCodeSuffix();
    if (!(await getInviteByCode(code))) return code;
  }
  throw new Error('Could not generate a unique invite code.');
}

/** `APP_BASE_URL`, not `WEB_ORIGIN` — `WEB_ORIGIN` is the CORS allow-origin (index.ts), which
 *  defaults to `http://localhost:5173` and is wrong in production. Falls back to the same
 *  localhost dev default when unset, so a dev environment with no `APP_BASE_URL` configured still
 *  gets a usable (if locally-scoped) link rather than a broken one. */
function inviteLink(code: string): string {
  const base = process.env.APP_BASE_URL || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}/?invite=${encodeURIComponent(code)}`;
}

campaignRouter.post('/', wrap(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) { res.status(400).json({ error: 'Campaign name is required.' }); return; }

  const campaign: Campaign = { Id: newId('cm'), Name: name, GmUserId: req.user!.id, CreatedAt: nowIso(), Status: 'Active', Phase: 'Signup' };
  await insertCampaign(campaign);

  // The creator becomes GM — mirrors seed.ts, which gives the GM a membership with no
  // character (GMs peek at players' sheets rather than keeping their own).
  const membership: Membership = { Id: newId('mb'), UserId: req.user!.id, CampaignId: campaign.Id, Role: 'GM', CharacterId: null };
  await insertMembership(membership);

  const party: Party = { Id: newId('pt'), CampaignId: campaign.Id, Rapport: 0, RapportImprovementsTaken: [], History: [], PartyLevel: 0, Motif: '', Quest: '', SkillTags: [], WeaknessTags: [], Path: '', Goal: '', CampAssets: [], UpdatedAt: nowIso(), UpdatedBy: null };
  await saveParty(party);

  res.status(201).json({ campaign, membership });
}));

campaignRouter.get('/:id/bootstrap', wrap(async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }

  const isGM = membership.Role === 'GM';

  // None of these four reads depends on another's result — batch them instead of awaiting
  // one at a time.
  const [members, characters, partyRow, bonds, clocks] = await Promise.all([
    listMemberships(campaign.Id),
    listCharacters(campaign.Id),
    getParty(campaign.Id),
    listBondsForCampaign(campaign.Id),
    listClocksForCampaign(campaign.Id),
  ]);
  let party = partyRow;
  if (!party) {
    // A campaign should always have a party row once seeded/created; self-heal rather than
    // shipping a null the client isn't guarded against (CampaignBootstrap.party is non-nullable).
    party = { Id: newId('pt'), CampaignId: campaign.Id, Rapport: 0, RapportImprovementsTaken: [], History: [], PartyLevel: 0, Motif: '', Quest: '', SkillTags: [], WeaknessTags: [], Path: '', Goal: '', CampAssets: [], UpdatedAt: nowIso(), UpdatedBy: null };
    await saveParty(party);
  }

  // Same batching: isGM/membership.CharacterId/members are already known, so these four don't
  // need to wait on each other either. users is scoped to this campaign's own membership list
  // rather than every registered account (TechStackAudit.md B3/D2) — verified the client only
  // ever resolves a user id from `members` (CampaignPage.tsx's GM-name lookup); Bond/Rapport
  // History entries' `.By` field resolves against `characters`, not `users`, so it doesn't need
  // a wider id set.
  const [users, invites, mySheet, encounter, adventures] = await Promise.all([
    listUsersByIds(members.map((m) => m.UserId)),
    isGM ? listInvites(campaign.Id) : Promise.resolve([]),
    !isGM && membership.CharacterId ? getSheet(membership.CharacterId) : Promise.resolve(null),
    getActiveEncounter(campaign.Id),
    // GM-only, same reasoning as invites just above — Adventure prep (Concept/Villain/Secrets/
    // Countdown) is spoiler content this app never surfaces to players; see CLAUDE.md's
    // "Architecture: Adventures" for why this stays a bootstrap-level omission rather than a
    // field-level redaction.
    isGM ? listAdventuresForCampaign(campaign.Id) : Promise.resolve([]),
  ]);

  const body: CampaignBootstrap = {
    campaign,
    membership,
    members,
    users,
    characters,
    party,
    bonds,
    invites,
    mySheet,
    peekSheets: {},
    peekSummaries: {},
    encounter,
    clocks,
    adventures,
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
    const [lib, sheets] = await Promise.all([getLibrary(), listSheetsForCampaign(campaign.Id)]);
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
    Code: await generateUniqueInviteCode(),
    SentAt: nowIso(),
    Status: 'Pending' as const,
  };
  await insertInvite(invite);
  const delivery = await sendInviteEmail({ to: email, campaignName: campaign.Name, code: invite.Code, link: inviteLink(invite.Code) });
  res.json({ invite, delivery });
}));

// GM-only, same guards as the send route above. Re-sends the same code/link — doesn't mint a
// new one, so a GM resending doesn't invalidate a code the invitee may have already copied.
campaignRouter.post('/:id/invites/:inviteId/resend', wrap(async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can resend invites.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }
  const invite = await getInvite(req.params.inviteId);
  if (!invite || invite.CampaignId !== campaign.Id) { res.status(404).json({ error: 'No such invite.' }); return; }
  if (invite.Status !== 'Pending') { res.status(409).json({ error: 'Only a pending invite can be resent.' }); return; }
  const delivery = await sendInviteEmail({ to: invite.Email, campaignName: campaign.Name, code: invite.Code, link: inviteLink(invite.Code) });
  res.json({ delivery });
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

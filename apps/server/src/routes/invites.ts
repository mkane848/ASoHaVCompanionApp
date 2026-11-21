import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  getInvite,
  getInviteByCode,
  getCampaign,
  listCampaignsByIds,
  membershipFor,
  releaseInviteClaim,
  claimPendingInvite,
  insertMembership,
  listPendingInvitesForEmail,
} from '../repo.js';
import {
  assertCampaignActive,
  assertInviteActionable,
  CampaignArchivedError,
  InviteError,
  newId,
  type Invite,
  type Membership,
  type MyInvite,
} from '@asohav/shared';
import { wrap } from '../asyncHandler.js';
import { bestEffort } from '../bestEffort.js';

// Not campaign-scoped like campaignRouter's own /invites routes (send/revoke, GM-only) —
// these act on invites addressed to the signed-in user, across whatever campaign sent them.
export const invitesRouter = Router();

invitesRouter.use(requireAuth);

invitesRouter.get('/mine', wrap(async (req, res) => {
  const pending = await listPendingInvitesForEmail(req.user!.email);
  // One batched query instead of one getCampaign per invite (TechStackAudit.md D2).
  const campaigns = await listCampaignsByIds([...new Set(pending.map((i) => i.CampaignId))]);
  const campaignById = new Map(campaigns.map((c) => [c.Id, c]));
  const withCampaign: MyInvite[] = pending.map((invite) => ({
    ...invite,
    CampaignName: campaignById.get(invite.CampaignId)?.Name ?? 'Unknown campaign',
  }));
  res.json({ invites: withCampaign });
}));

async function redeem(invite: Invite, userId: string, userEmail: string): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    assertInviteActionable(invite, userEmail);
  } catch (err) {
    if (err instanceof InviteError) return { status: 403, body: { error: err.message } };
    throw err;
  }
  const campaign = await getCampaign(invite.CampaignId);
  if (!campaign) return { status: 404, body: { error: 'No such campaign.' } };
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) return { status: 409, body: { error: err.message } };
    throw err;
  }
  const existing = await membershipFor(invite.CampaignId, userId);
  if (existing) return { status: 409, body: { error: 'You are already a member of this campaign.' } };

  // The invite is claimed first, conditionally on its still being Pending, so two redemptions of one
  // code cannot both succeed; if the membership then cannot be made, the claim is released again
  // (docs/Audit-2026-11-12.md finding 10). The order used to be the reverse, unconditionally.
  if (!(await claimPendingInvite(invite.Id, 'Accepted'))) {
    return { status: 409, body: { error: 'This invite has already been used.' } };
  }
  const membership: Membership = { Id: newId('mb'), UserId: userId, CampaignId: invite.CampaignId, Role: 'Player', CharacterId: null };
  try {
    await insertMembership(membership);
  } catch (err) {
    await bestEffort(`could not release claimed invite ${invite.Id}`, () => releaseInviteClaim(invite.Id));
    // memberships has unique (user_id, campaign_id): a concurrent redemption of a second invite
    // to the same campaign got there first.
    if ((err as { code?: string } | null)?.code === '23505') {
      return { status: 409, body: { error: 'You are already a member of this campaign.' } };
    }
    throw err;
  }
  return { status: 200, body: { membership } };
}

invitesRouter.post('/:id/redeem', wrap(async (req, res) => {
  const invite = await getInvite(req.params.id);
  if (!invite) { res.status(404).json({ error: 'No such invite.' }); return; }
  const { status, body } = await redeem(invite, req.user!.id, req.user!.email);
  res.status(status).json(body);
}));

// Manual "join via code" entry point — the player may not have the invite listed on their own
// `/mine` view (a different email casing, a code relayed to them out of band, etc.), but the
// authorization is identical: the code's invite must still be Pending and addressed to them.
invitesRouter.post('/redeem-by-code', wrap(async (req, res) => {
  const code = String(req.body?.code ?? '').trim();
  if (!code) { res.status(400).json({ error: 'Enter an invite code.' }); return; }
  const invite = await getInviteByCode(code);
  if (!invite) { res.status(404).json({ error: 'No invite found for that code.' }); return; }
  const { status, body } = await redeem(invite, req.user!.id, req.user!.email);
  res.status(status).json(body);
}));

// Deliberately does NOT call assertCampaignActive, unlike redeem() above — declining is the
// invitee's own action on their own pending-invite list, and an archive decision made by
// someone else shouldn't strand a dead invite there forever. Stated here as well as in
// CLAUDE.md's archive-freeze section because an unexplained missing guard reads exactly like
// the four genuine omissions 0.50.0 fixed, and this one was flagged as a bug on that basis.
invitesRouter.post('/:id/decline', wrap(async (req, res) => {
  const invite = await getInvite(req.params.id);
  if (!invite) { res.status(404).json({ error: 'No such invite.' }); return; }
  try {
    assertInviteActionable(invite, req.user!.email);
  } catch (err) {
    if (err instanceof InviteError) { res.status(403).json({ error: err.message }); return; }
    throw err;
  }
  // Only from Pending, like a redemption's claim: an unconditional write landing just after a
  // redemption used to leave a member whose invite read Declined.
  if (!(await claimPendingInvite(invite.Id, 'Declined'))) {
    res.status(409).json({ error: 'This invite has already been used.' });
    return;
  }
  res.json({ ok: true });
}));

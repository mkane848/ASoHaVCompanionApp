import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  getInvite,
  getInviteByCode,
  getCampaign,
  listCampaignsByIds,
  membershipFor,
  updateInviteStatus,
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

  const membership: Membership = { Id: newId('mb'), UserId: userId, CampaignId: invite.CampaignId, Role: 'Player', CharacterId: null };
  await insertMembership(membership);
  await updateInviteStatus(invite.Id, 'Accepted');
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

invitesRouter.post('/:id/decline', wrap(async (req, res) => {
  const invite = await getInvite(req.params.id);
  if (!invite) { res.status(404).json({ error: 'No such invite.' }); return; }
  try {
    assertInviteActionable(invite, req.user!.email);
  } catch (err) {
    if (err instanceof InviteError) { res.status(403).json({ error: err.message }); return; }
    throw err;
  }
  await updateInviteStatus(invite.Id, 'Declined');
  res.json({ ok: true });
}));

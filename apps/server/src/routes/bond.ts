import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, membershipFor, withBondLock } from '../repo.js';
import { wrap } from '../asyncHandler.js';
import {
  applySpendKin,
  assertCampaignActive,
  assertCanPropose,
  buildProposal,
  isBondLocked,
  resolveAcceptedBond,
  BondHandshakeError,
  CampaignArchivedError,
  newId,
  nowIso,
  type BondChangeType,
  type Campaign,
  type Membership,
} from '@asohav/shared';

export const bondRouter = Router({ mergeParams: true });

bondRouter.use(requireAuth);

/** Thrown from inside a withBondLock() callback to bail out of the transaction (rolled back)
 *  with a specific HTTP status — validation failures that depend on the locked Bond's state
 *  (wrong campaign, not a participant, no pending proposal, etc.). */
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function requireCampaignPlayer(
  req: Request,
  res: Response,
): Promise<{ campaign: Campaign; membership: Membership } | null> {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return null; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || !membership.CharacterId) { res.status(403).json({ error: 'Not a player in this campaign.' }); return null; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return null; }
    throw err;
  }
  return { campaign, membership };
}

function assertBelongsToBond(bond: { CampaignId: string; CharacterAId: string; CharacterBId: string }, campaign: Campaign, membership: Membership) {
  if (bond.CampaignId !== campaign.Id) throw new HttpError(404, 'No such Bond.');
  if (bond.CharacterAId !== membership.CharacterId && bond.CharacterBId !== membership.CharacterId) {
    throw new HttpError(403, 'You are not part of this Bond.');
  }
}

bondRouter.post('/:bondId/propose', wrap(async (req, res) => {
  const ctx = await requireCampaignPlayer(req, res);
  if (!ctx) return;
  const { campaign, membership } = ctx;
  const type = req.body?.type as BondChangeType;
  if (!['MarkKin', 'SpendKin', 'ForgeBond'].includes(type)) {
    res.status(400).json({ error: 'Unknown proposal type.' });
    return;
  }

  try {
    const locked = await withBondLock(req.params.bondId, (bond) => {
      assertBelongsToBond(bond, campaign, membership);
      if (type === 'ForgeBond' && bond.KinTrack < 5) throw new HttpError(400, 'Kin must be full to Forge this Bond.');
      if (type === 'ForgeBond' && isBondLocked(bond)) throw new HttpError(400, 'This Bond is already at max Level with a full Kin Track.');

      // Spending Kin is unilateral: it applies immediately and never goes through
      // PendingChange, so it doesn't need (or wait on) the other player's approval.
      if (type === 'SpendKin') {
        const delta = (req.body?.payload?.Delta as number) || 1;
        const detail = applySpendKin(bond, delta);
        bond.UpdatedAt = nowIso();
        bond.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'spent', Type: type, By: membership.CharacterId!, Note: req.body?.note || detail });
        return;
      }

      assertCanPropose(bond);
      bond.PendingChange = buildProposal(membership.CharacterId!, type, req.body?.payload ?? {}, req.body?.note ?? '');
      bond.UpdatedAt = nowIso();
      bond.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'proposed', Type: type, By: membership.CharacterId!, Note: req.body?.note ?? '' });
    });
    if (!locked) { res.status(404).json({ error: 'No such Bond.' }); return; }
    res.json({ bond: locked.bond });
  } catch (e) {
    if (e instanceof HttpError) { res.status(e.status).json({ error: e.message }); return; }
    if (e instanceof BondHandshakeError) { res.status(409).json({ error: e.message }); return; }
    throw e;
  }
}));

bondRouter.post('/:bondId/accept', wrap(async (req, res) => {
  const ctx = await requireCampaignPlayer(req, res);
  if (!ctx) return;
  const { campaign, membership } = ctx;

  try {
    const locked = await withBondLock(req.params.bondId, (bond) => {
      assertBelongsToBond(bond, campaign, membership);
      const p = bond.PendingChange;
      if (!p) throw new HttpError(409, 'There is no proposal to accept.');
      if (p.ProposedBy === membership.CharacterId) {
        throw new HttpError(403, 'You proposed this — the other player must accept it.');
      }
      const detail = resolveAcceptedBond(bond);
      bond.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'accepted', Type: p.Type, By: membership.CharacterId!, Note: detail });
    });
    if (!locked) { res.status(404).json({ error: 'No such Bond.' }); return; }
    res.json({ bond: locked.bond });
  } catch (e) {
    if (e instanceof HttpError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
}));

bondRouter.post('/:bondId/reject', wrap(async (req, res) => {
  const ctx = await requireCampaignPlayer(req, res);
  if (!ctx) return;
  const { campaign, membership } = ctx;
  const withdrawn = !!req.body?.withdrawn;

  try {
    const locked = await withBondLock(req.params.bondId, (bond) => {
      assertBelongsToBond(bond, campaign, membership);
      const p = bond.PendingChange;
      if (!p) throw new HttpError(409, 'There is no proposal to resolve.');
      if (withdrawn && p.ProposedBy !== membership.CharacterId) {
        throw new HttpError(403, 'Only the proposer can withdraw this.');
      }
      if (!withdrawn && p.ProposedBy === membership.CharacterId) {
        throw new HttpError(403, 'You proposed this — withdraw it instead of declining.');
      }
      bond.PendingChange = null;
      bond.UpdatedAt = nowIso();
      bond.History.unshift({ Id: newId('h'), At: nowIso(), Action: withdrawn ? 'withdrawn' : 'rejected', Type: p.Type, By: membership.CharacterId!, Note: '' });
    });
    if (!locked) { res.status(404).json({ error: 'No such Bond.' }); return; }
    res.json({ bond: locked.bond });
  } catch (e) {
    if (e instanceof HttpError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
}));

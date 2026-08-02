import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, membershipFor, getBond, saveBond } from '../repo.js';
import { broadcastToCampaign } from '../ws.js';
import { assertCanPropose, buildProposal, resolveAcceptedBond, BondHandshakeError, newId, nowIso, type BondChangeType } from '@asohav/shared';

export const bondRouter = Router({ mergeParams: true });

bondRouter.use(requireAuth);

function loadContext(req: any, res: any) {
  const campaign = getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return null; }
  const membership = membershipFor(campaign.Id, req.user!.id);
  if (!membership || !membership.CharacterId) { res.status(403).json({ error: 'Not a player in this campaign.' }); return null; }
  const bond = getBond(req.params.bondId);
  if (!bond || bond.CampaignId !== campaign.Id) { res.status(404).json({ error: 'No such Bond.' }); return null; }
  if (bond.CharacterAId !== membership.CharacterId && bond.CharacterBId !== membership.CharacterId) {
    res.status(403).json({ error: 'You are not part of this Bond.' });
    return null;
  }
  return { campaign, membership, bond };
}

bondRouter.post('/:bondId/propose', (req, res) => {
  const ctx = loadContext(req, res);
  if (!ctx) return;
  const { campaign, membership, bond } = ctx;
  const type = req.body?.type as BondChangeType;
  if (!['MarkKin', 'SpendKin', 'ForgeBond'].includes(type)) {
    res.status(400).json({ error: 'Unknown proposal type.' });
    return;
  }
  if (type === 'ForgeBond' && bond.KinTrack < 5) {
    res.status(400).json({ error: 'Kin must be full to Forge this Bond.' });
    return;
  }
  try {
    assertCanPropose(bond);
  } catch (e) {
    if (e instanceof BondHandshakeError) { res.status(409).json({ error: e.message }); return; }
    throw e;
  }
  bond.PendingChange = buildProposal(membership.CharacterId!, type, req.body?.payload ?? {}, req.body?.note ?? '');
  bond.UpdatedAt = nowIso();
  bond.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'proposed', Type: type, By: membership.CharacterId!, Note: req.body?.note ?? '' });
  saveBond(bond);
  broadcastToCampaign(campaign.Id, { type: 'bond:update', campaignId: campaign.Id, bond });
  res.json({ bond });
});

bondRouter.post('/:bondId/accept', (req, res) => {
  const ctx = loadContext(req, res);
  if (!ctx) return;
  const { campaign, membership, bond } = ctx;
  const p = bond.PendingChange;
  if (!p) { res.status(409).json({ error: 'There is no proposal to accept.' }); return; }
  if (p.ProposedBy === membership.CharacterId) {
    res.status(403).json({ error: 'You proposed this — the other player must accept it.' });
    return;
  }
  const detail = resolveAcceptedBond(bond);
  bond.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'accepted', Type: p.Type, By: membership.CharacterId!, Note: detail });
  saveBond(bond);
  broadcastToCampaign(campaign.Id, { type: 'bond:update', campaignId: campaign.Id, bond });
  res.json({ bond });
});

bondRouter.post('/:bondId/reject', (req, res) => {
  const ctx = loadContext(req, res);
  if (!ctx) return;
  const { campaign, membership, bond } = ctx;
  const p = bond.PendingChange;
  if (!p) { res.status(409).json({ error: 'There is no proposal to resolve.' }); return; }
  const withdrawn = !!req.body?.withdrawn;
  if (withdrawn && p.ProposedBy !== membership.CharacterId) {
    res.status(403).json({ error: 'Only the proposer can withdraw this.' });
    return;
  }
  if (!withdrawn && p.ProposedBy === membership.CharacterId) {
    res.status(403).json({ error: 'You proposed this — withdraw it instead of declining.' });
    return;
  }
  bond.PendingChange = null;
  bond.UpdatedAt = nowIso();
  bond.History.unshift({ Id: newId('h'), At: nowIso(), Action: withdrawn ? 'withdrawn' : 'rejected', Type: p.Type, By: membership.CharacterId!, Note: '' });
  saveBond(bond);
  broadcastToCampaign(campaign.Id, { type: 'bond:update', campaignId: campaign.Id, bond });
  res.json({ bond });
});

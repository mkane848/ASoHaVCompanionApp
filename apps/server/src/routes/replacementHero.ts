import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getCampaign, getParty, getSheet, listMemberships, membershipFor, saveParty } from '../repo.js';
import { assertCampaignActive, isHeroOut, nowIso } from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

// Replacement Hero (our interpretation, docs/decisions.md; the ruleset is silent). The GM opens
// character creation for ONE Player whose current Hero is Dead or Retired; that Player then uses the
// ordinary POST …/characters (routes/characters.ts), which checks the flag set here. The flag is
// `Party.ReplacementHeroFor` (a UserId): JSONB, so no migration, and the member-writable Party PUT
// keeps the stored value so a Player cannot open their own.
export const replacementHeroRouter = Router({ mergeParams: true });

replacementHeroRouter.use(requireAuth);

interface Params {
  campaignId: string;
}

replacementHeroRouter.post('/', wrap<Params>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }
  if (membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can open a replacement Hero.' }); return; }
  assertCampaignActive(campaign);

  const userId = String(req.body?.UserId ?? '');
  const target = (await listMemberships(campaign.Id)).find((m) => m.UserId === userId);
  if (!target || target.Role !== 'Player') { res.status(404).json({ error: 'No such player on this campaign.' }); return; }
  const sheet = target.CharacterId ? await getSheet(target.CharacterId) : null;
  if (!sheet || !isHeroOut(sheet)) {
    res.status(409).json({ error: 'A replacement Hero can only be opened for a player whose Hero is Dead or Retired.' });
    return;
  }

  const party = await getParty(campaign.Id);
  if (!party) { res.status(404).json({ error: 'No party exists for this campaign.' }); return; }
  if (party.ReplacementHeroFor && party.ReplacementHeroFor !== userId) {
    res.status(409).json({ error: 'A replacement Hero is already open for another player. Cancel it first.' });
    return;
  }
  party.ReplacementHeroFor = userId;
  party.UpdatedAt = nowIso();
  party.UpdatedBy = req.user!.id;
  await saveParty(party);
  res.json({ party });
}));

replacementHeroRouter.delete('/', wrap<Params>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership) { res.status(403).json({ error: 'Not a member of this campaign.' }); return; }
  if (membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can cancel a replacement Hero.' }); return; }
  assertCampaignActive(campaign);

  const party = await getParty(campaign.Id);
  if (!party) { res.status(404).json({ error: 'No party exists for this campaign.' }); return; }
  if (party.ReplacementHeroFor) {
    party.ReplacementHeroFor = null;
    party.UpdatedAt = nowIso();
    party.UpdatedBy = req.user!.id;
    await saveParty(party);
  }
  res.json({ party });
}));

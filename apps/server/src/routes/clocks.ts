import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { deleteClock, getCampaign, listClocksForCampaign, membershipFor, saveClock } from '../repo.js';
import { assertCampaignActive, CampaignArchivedError, newClock, type Clock, type ClockKind } from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

export const clocksRouter = Router({ mergeParams: true });

clocksRouter.use(requireAuth);

const CLOCK_KINDS: ClockKind[] = ['Opposition', 'Threat', 'Project', 'TugOfWar'];

// GM-only — "the GM will make a Clock" (Ruleset-V0.5.md). Any number of Clocks may be open at
// once, unlike Combat's single-Active-Encounter shape.
clocksRouter.post('/', wrap<{ campaignId: string }>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can make a Clock.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  const title = String(req.body?.title ?? '').trim();
  if (!title) { res.status(400).json({ error: 'Give the Clock a title.' }); return; }
  const kind = req.body?.kind;
  if (!CLOCK_KINDS.includes(kind)) { res.status(400).json({ error: 'Invalid Clock kind.' }); return; }
  const segments = Number(req.body?.segments);

  const clock: Clock = newClock({
    CampaignId: campaign.Id,
    Title: title,
    Kind: kind,
    Segments: Number.isFinite(segments) && segments > 0 ? segments : undefined,
  });
  await saveClock(clock);
  res.status(201).json({ clock });
}));

// Any campaign member — Clocks are track-and-display, not enforced server-side (same trust model
// as combat.ts's Encounter PUT): the doc has any Hero rolling to progress a Basic Clock, so this
// isn't a GM-only write. A trusted whole-document replace.
clocksRouter.put('/:clockId', wrap<{ campaignId: string; clockId: string }>(async (req, res) => {
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

  const existing = (await listClocksForCampaign(campaign.Id)).find((c) => c.Id === req.params.clockId);
  if (!existing) { res.status(404).json({ error: 'No such Clock.' }); return; }

  const incoming: Clock = {
    ...existing,
    ...(req.body as Partial<Clock>),
    Id: existing.Id,
    CampaignId: campaign.Id,
  };
  await saveClock(incoming);
  res.json({ clock: incoming });
}));

// GM-only — removes a Clock entirely. Unlike an Encounter (never deleted, only Ended), a Clock
// the GM no longer needs can just go away; there's no "resolved Clocks are history" requirement
// in the doc the way there is for a fight's own log.
clocksRouter.delete('/:clockId', wrap<{ campaignId: string; clockId: string }>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'GM') { res.status(403).json({ error: 'Only the GM can remove a Clock.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  const existing = (await listClocksForCampaign(campaign.Id)).find((c) => c.Id === req.params.clockId);
  if (!existing) { res.status(404).json({ error: 'No such Clock.' }); return; }

  await deleteClock(existing.Id);
  res.status(204).end();
}));

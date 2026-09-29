import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth.js';
import { listAuthUsers, generatePasswordResetLink, setUserAdmin, listAllCampaigns, listMembershipsForCampaigns, listUsers, listAllCharacters } from '../repo.js';
import type { AdminCampaignRow, AdminCharacterRow } from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

// Aggregate, cross-campaign admin views (account management, the Play Data list/delete panels).
// Delete actions themselves live on their resource's own router (campaign.ts, characters.ts) —
// this router is the read side plus the one action (password reset) that doesn't belong to any
// existing resource.
export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/users', wrap(async (_req, res) => {
  const users = await listAuthUsers();
  res.json({ users });
}));

adminRouter.post('/users/:id/reset-password', wrap(async (req, res) => {
  const actionLink = await generatePasswordResetLink(req.params.id);
  if (!actionLink) { res.status(404).json({ error: 'No such user.' }); return; }
  res.json({ actionLink });
}));

// Grant or revoke content-admin. An admin can't change their own flag: it makes "the last admin
// removed themselves" unreachable without needing a count query, and anyone else can still be
// promoted first if the current admin wants out.
adminRouter.patch('/users/:id/admin', wrap(async (req, res) => {
  const { isAdmin } = req.body ?? {};
  if (typeof isAdmin !== 'boolean') { res.status(400).json({ error: 'isAdmin must be true or false.' }); return; }
  if (req.params.id === req.user!.id) { res.status(409).json({ error: "You can't change your own admin status." }); return; }
  const found = await setUserAdmin(req.params.id, isAdmin);
  if (!found) { res.status(404).json({ error: 'No such user.' }); return; }
  res.json({ ok: true, isAdmin });
}));

adminRouter.get('/campaigns', wrap(async (_req, res) => {
  // Batches the per-campaign membership count with the already-existing bulk form instead of
  // one listMemberships call per campaign in a loop (TechStackAudit.md B3/D2).
  const [campaigns, users] = await Promise.all([listAllCampaigns(), listUsers()]);
  const allMembers = await listMembershipsForCampaigns(campaigns.map((c) => c.Id));
  const memberCountByCampaign = new Map<string, number>();
  for (const m of allMembers) memberCountByCampaign.set(m.CampaignId, (memberCountByCampaign.get(m.CampaignId) ?? 0) + 1);
  const rows: AdminCampaignRow[] = campaigns.map((campaign) => {
    const gm = users.find((u) => u.Id === campaign.GmUserId);
    return { ...campaign, GmName: gm?.Name ?? 'Unknown', MemberCount: memberCountByCampaign.get(campaign.Id) ?? 0 };
  });
  res.json({ campaigns: rows });
}));

adminRouter.get('/characters', wrap(async (_req, res) => {
  const [characters, campaigns] = await Promise.all([listAllCharacters(), listAllCampaigns()]);
  const rows: AdminCharacterRow[] = characters.map((character) => ({
    ...character,
    CampaignName: campaigns.find((c) => c.Id === character.CampaignId)?.Name ?? 'Unknown',
  }));
  res.json({ characters: rows });
}));

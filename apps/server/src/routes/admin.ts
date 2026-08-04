import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth.js';
import { listAuthUsers, generatePasswordResetLink, listAllCampaigns, listMemberships, listUsers, listAllCharacters } from '../repo.js';
import type { AdminCampaignRow, AdminCharacterRow } from '@asohav/shared';

// Aggregate, cross-campaign admin views (account management, the Play Data list/delete panels).
// Delete actions themselves live on their resource's own router (campaign.ts, characters.ts) —
// this router is the read side plus the one action (password reset) that doesn't belong to any
// existing resource.
export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/users', async (_req, res) => {
  const users = await listAuthUsers();
  res.json({ users });
});

adminRouter.post('/users/:id/reset-password', async (req, res) => {
  const actionLink = await generatePasswordResetLink(req.params.id);
  if (!actionLink) { res.status(404).json({ error: 'No such user.' }); return; }
  res.json({ actionLink });
});

adminRouter.get('/campaigns', async (_req, res) => {
  const [campaigns, users] = await Promise.all([listAllCampaigns(), listUsers()]);
  const rows: AdminCampaignRow[] = await Promise.all(
    campaigns.map(async (campaign) => {
      const members = await listMemberships(campaign.Id);
      const gm = users.find((u) => u.Id === campaign.GmUserId);
      return { ...campaign, GmName: gm?.Name ?? 'Unknown', MemberCount: members.length };
    }),
  );
  res.json({ campaigns: rows });
});

adminRouter.get('/characters', async (_req, res) => {
  const [characters, campaigns] = await Promise.all([listAllCharacters(), listAllCampaigns()]);
  const rows: AdminCharacterRow[] = characters.map((character) => ({
    ...character,
    CampaignName: campaigns.find((c) => c.Id === character.CampaignId)?.Name ?? 'Unknown',
  }));
  res.json({ characters: rows });
});

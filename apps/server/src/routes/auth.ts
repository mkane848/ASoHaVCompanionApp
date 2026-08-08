import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { supabaseAdmin } from '../supabase.js';
import type { MeResponse } from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

// Sign up / sign in / sign out are no longer proxied through this server — the web client
// calls Supabase Auth directly (supabase-js `signUp` / `signInWithPassword` / `signOut`) and
// sends the resulting access token as a Bearer header on every request here. This route only
// answers "who am I", enriched with the campaign memberships this app's data model needs.
export const authRouter = Router();

authRouter.get('/me', requireAuth, wrap(async (req, res) => {
  const user = req.user!;
  const { data, error } = await supabaseAdmin
    .from('memberships')
    .select('id, user_id, campaign_id, role, character_id, campaigns(name, status)')
    .eq('user_id', user.id);
  if (error) { res.status(500).json({ error: error.message }); return; }

  const body: MeResponse = {
    user: { Id: user.id, Name: user.name, Email: user.email, IsAdmin: user.isAdmin },
    memberships: (data ?? []).map((m: any) => ({
      Id: m.id,
      UserId: m.user_id,
      CampaignId: m.campaign_id,
      Role: m.role,
      CharacterId: m.character_id,
      CampaignName: m.campaigns?.name ?? '',
      CampaignStatus: m.campaigns?.status ?? 'Active',
    })),
  };
  res.json(body);
}));

import { Router } from 'express';
import { requireAuth } from '../auth.js';
import type { CampaignOverview, CampaignOverviewBond, CampaignOverviewMember, MeResponse } from '@asohav/shared';
import {
  listBondsForCampaigns,
  listCharactersForCampaigns,
  listEncounterTimestampsForCampaigns,
  listMembershipsForCampaigns,
  listMembershipsWithCampaignForUser,
  listPartiesForCampaigns,
  listSheetTimestampsForCampaigns,
  listUsers,
} from '../repo.js';
import { wrap } from '../asyncHandler.js';

// Sign up / sign in / sign out are no longer proxied through this server — the web client
// calls Supabase Auth directly (supabase-js `signUp` / `signInWithPassword` / `signOut`) and
// sends the resulting access token as a Bearer header on every request here. This route only
// answers "who am I", enriched with the campaign memberships this app's data model needs.
export const authRouter = Router();

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

authRouter.get('/me', requireAuth, wrap(async (req, res) => {
  const user = req.user!;
  const myMemberships = await listMembershipsWithCampaignForUser(user.id);
  const campaignIds = [...new Set(myMemberships.map((m) => m.CampaignId))];

  // Home-screen tile data (see WorkPlan-0.23.0.md item A) needs every campaign's roster, GM
  // name, Rapport, and last-played timestamp — seven reads, batched, regardless of how many
  // campaigns this user is in, rather than looping a per-campaign call.
  const [allMemberships, allCharacters, allParties, allBonds, sheetTimestamps, encounterTimestamps, users] = await Promise.all([
    listMembershipsForCampaigns(campaignIds),
    listCharactersForCampaigns(campaignIds),
    listPartiesForCampaigns(campaignIds),
    listBondsForCampaigns(campaignIds),
    listSheetTimestampsForCampaigns(campaignIds),
    listEncounterTimestampsForCampaigns(campaignIds),
    listUsers(),
  ]);

  const userNameById = new Map(users.map((u) => [u.Id, u.Name]));
  const charactersByCampaign = groupBy(allCharacters, (c) => c.CampaignId);
  const membershipsByCampaign = groupBy(allMemberships, (m) => m.CampaignId);
  const partyByCampaign = new Map(allParties.map((p) => [p.CampaignId, p]));
  const bondsByCampaign = groupBy(allBonds, (b) => b.CampaignId);

  // No campaigns.last_played_at column — derived as the max UpdatedAt across the four tables
  // that already carry both it and CampaignId, rather than adding a migration plus edits to
  // every mutating route that would need to keep a dedicated column current.
  const lastPlayedByCampaign = new Map<string, string>();
  const bumpLastPlayed = (campaignId: string, at: string) => {
    const current = lastPlayedByCampaign.get(campaignId);
    if (!current || at > current) lastPlayedByCampaign.set(campaignId, at);
  };
  for (const p of allParties) bumpLastPlayed(p.CampaignId, p.UpdatedAt);
  for (const b of allBonds) bumpLastPlayed(b.CampaignId, b.UpdatedAt);
  for (const s of sheetTimestamps) bumpLastPlayed(s.CampaignId, s.UpdatedAt);
  for (const e of encounterTimestamps) bumpLastPlayed(e.CampaignId, e.UpdatedAt);

  const memberships = myMemberships.map((m) => {
    const campaignCharacters = charactersByCampaign.get(m.CampaignId) ?? [];
    const campaignMemberships = membershipsByCampaign.get(m.CampaignId) ?? [];
    const characterById = new Map(campaignCharacters.map((c) => [c.Id, c]));

    const gm = campaignMemberships.find((cm) => cm.Role === 'GM');
    const gmName = (gm && userNameById.get(gm.UserId)) || '';

    const roster: CampaignOverviewMember[] = [];
    for (const cm of campaignMemberships) {
      if (cm.Role !== 'Player' || !cm.CharacterId) continue;
      const character = characterById.get(cm.CharacterId);
      if (!character) continue;
      roster.push({
        CharacterId: character.Id,
        CharacterName: character.Name,
        PlayerName: character.PlayerName,
        IsYou: cm.UserId === user.id,
      });
    }

    // Your own character's Bonds with Bond Track marked — never a special case for a GM
    // membership (CharacterId null), since no Bond can match a null CharacterAId/CharacterBId.
    const campaignBonds = bondsByCampaign.get(m.CampaignId) ?? [];
    const bonds: CampaignOverviewBond[] = [];
    for (const b of campaignBonds) {
      if (b.BondTrack <= 0) continue;
      if (b.CharacterAId !== m.CharacterId && b.CharacterBId !== m.CharacterId) continue;
      const otherId = b.CharacterAId === m.CharacterId ? b.CharacterBId : b.CharacterAId;
      const other = characterById.get(otherId);
      bonds.push({ CharacterName: other?.Name ?? 'Unknown', BondTrack: b.BondTrack });
    }

    const overview: CampaignOverview = {
      GmName: gmName,
      Roster: roster,
      Rapport: partyByCampaign.get(m.CampaignId)?.Rapport ?? 0,
      Bonds: bonds,
      LastPlayedAt: lastPlayedByCampaign.get(m.CampaignId) ?? null,
    };

    return { ...m, Overview: overview };
  });

  const body: MeResponse = {
    user: { Id: user.id, Name: user.name, Email: user.email, IsAdmin: user.isAdmin },
    memberships,
  };
  res.json(body);
}));

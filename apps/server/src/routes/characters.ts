import express, { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth.js';
import { getCampaign, membershipFor, insertCharacter, saveSheet, updateMembershipCharacter, getLibrary, getCharacter, deleteCharacter } from '../repo.js';
import {
  assertCampaignActive,
  CampaignArchivedError,
  newId,
  nowIso,
  isStandardVirtueArray,
  type Character,
  type CharacterSheet,
  type VirtueValue,
} from '@asohav/shared';

// There is no character-creation flow anywhere else in the app — Virtue scores and Theme are
// read-only once a sheet exists (see CLAUDE.md), changeable only via the Advancement picker.
// This is the one place a fresh Character + CharacterSheet gets created, gated to a Player
// membership that doesn't have one yet (i.e. right after accepting an invite).
export const charactersRouter = Router({ mergeParams: true });

charactersRouter.use(requireAuth);

interface Params {
  campaignId: string;
}

interface VirtueInput {
  virtueId: string;
  score: number;
}

charactersRouter.post('/', async (req: express.Request<Params>, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'Player') { res.status(403).json({ error: 'Only a player can create a character.' }); return; }
  if (membership.CharacterId) { res.status(409).json({ error: 'You already have a character on this campaign.' }); return; }
  try {
    assertCampaignActive(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  const name = String(req.body?.name ?? '').trim();
  const playerName = String(req.body?.playerName ?? '').trim();
  const themeId = String(req.body?.themeId ?? '').trim();
  const virtues = req.body?.virtues as VirtueInput[] | undefined;

  if (!name || !playerName) { res.status(400).json({ error: 'Name and player name are required.' }); return; }
  if (
    !Array.isArray(virtues) ||
    virtues.length !== 5 ||
    !virtues.every((v) => v && typeof v.virtueId === 'string' && typeof v.score === 'number')
  ) {
    res.status(400).json({ error: 'Virtue assignment is malformed.' });
    return;
  }
  if (!isStandardVirtueArray(virtues.map((v) => v.score))) {
    res.status(400).json({ error: 'Virtue scores must use the standard array (2, 1, 0, 0, -1), each exactly once.' });
    return;
  }

  const library = await getLibrary();
  const theme = library.themes.find((t) => t.Id === themeId);
  if (!theme) { res.status(400).json({ error: 'Choose a valid Theme.' }); return; }
  const knownVirtueIds = new Set(library.virtues.map((v) => v.Id));
  const submittedVirtueIds = new Set(virtues.map((v) => v.virtueId));
  if (submittedVirtueIds.size !== 5 || [...submittedVirtueIds].some((id) => !knownVirtueIds.has(id))) {
    res.status(400).json({ error: 'Virtue assignment is malformed.' });
    return;
  }

  const character: Character = { Id: newId('ch'), Name: name, PlayerName: playerName, UserId: req.user!.id, CampaignId: campaign.Id };
  await insertCharacter(character);

  const t = nowIso();
  const virtueValues: VirtueValue[] = virtues.map((v) => ({ VirtueId: v.virtueId, Score: v.score, ConditionMarked: false }));
  const sheet: CharacterSheet = {
    Id: `sh-${character.Id}`,
    CharacterId: character.Id,
    Looks: '',
    Virtues: virtueValues,
    Statuses: [],
    Armor: [],
    Theme: { ThemeId: theme.Id, AcceptedQuests: [{ QuestId: theme.StartingQuestId, Completed: false, AcceptedAt: t }] },
    Load: { Tier: 'Normal', LatchedUntilCamp: false },
    Items: [],
    AbilityIds: [],
    SkillIds: [],
    Advancement: { Potential: 0, PotentialAdvancementsTaken: [], History: [] },
    CreatedAt: t,
    UpdatedAt: t,
  };
  await saveSheet(sheet, campaign.Id);
  await updateMembershipCharacter(membership.Id, character.Id);

  res.status(201).json({ character, sheet });
});

// Content-admin-only — deletes the character and, via FK cascade, its sheet and any Bonds it's
// part of; the owning membership survives with CharacterId set null (see repo.ts). See
// apps/server/src/routes/admin.ts for the list view this pairs with.
charactersRouter.delete('/:id', requireAdmin, async (req, res) => {
  const character = await getCharacter(req.params.id);
  if (!character || character.CampaignId !== req.params.campaignId) { res.status(404).json({ error: 'No such character.' }); return; }
  await deleteCharacter(character.Id);
  res.json({ ok: true });
});

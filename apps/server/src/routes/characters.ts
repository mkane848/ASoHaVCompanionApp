import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth.js';
import { getCampaign, membershipFor, insertCharacter, saveSheet, updateMembershipCharacter, getLibrary, getCharacter, deleteCharacter } from '../repo.js';
import {
  assertCampaignActive,
  assertPartyCreationPhase,
  CampaignArchivedError,
  characterCreationSchema,
  newId,
  nowIso,
  PartyCreationRequiredError,
  type Character,
  type CharacterSheet,
  type VirtueValue,
} from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

// There is no character-creation flow anywhere else in the app — Virtue scores and Theme are
// read-only once a sheet exists (see CLAUDE.md), changeable only via the Advancement picker.
// This is the one place a fresh Character + CharacterSheet gets created, gated to a Player
// membership that doesn't have one yet (i.e. right after accepting an invite) and to the
// campaign's Party Creation phase (see assertPartyCreationPhase / CLAUDE.md's campaign-setup-
// phases section).
export const charactersRouter = Router({ mergeParams: true });

charactersRouter.use(requireAuth);

interface Params {
  campaignId: string;
}

charactersRouter.post('/', wrap<Params>(async (req, res) => {
  const campaign = await getCampaign(req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'No such campaign.' }); return; }
  const membership = await membershipFor(campaign.Id, req.user!.id);
  if (!membership || membership.Role !== 'Player') { res.status(403).json({ error: 'Only a player can create a character.' }); return; }
  if (membership.CharacterId) { res.status(409).json({ error: 'You already have a character on this campaign.' }); return; }
  try {
    assertCampaignActive(campaign);
    assertPartyCreationPhase(campaign);
  } catch (err) {
    if (err instanceof CampaignArchivedError) { res.status(409).json({ error: err.message }); return; }
    if (err instanceof PartyCreationRequiredError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }

  // The one shared validator, also used client-side by CreateCharacterPage.tsx's zodResolver —
  // this route is its actual authority (no other layer catches a missing check here), so it
  // re-validates the full payload rather than trusting the client already did.
  const library = await getLibrary();
  const parsed = characterCreationSchema(library).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid character.' });
    return;
  }
  const { name, playerName, themeId, virtues, looks, questIds, skillIds, abilityIds } = parsed.data;
  const theme = library.themes.find((t) => t.Id === themeId)!; // themeId already checked against library.themes

  const character: Character = { Id: newId('ch'), Name: name, PlayerName: playerName, UserId: req.user!.id, CampaignId: campaign.Id };
  await insertCharacter(character);

  const t = nowIso();
  const virtueValues: VirtueValue[] = virtues.map((v) => ({ VirtueId: v.virtueId, Score: v.score, ConditionMarked: false }));
  const sheet: CharacterSheet = {
    Id: `sh-${character.Id}`,
    CharacterId: character.Id,
    Looks: looks.join('\n'),
    Virtues: virtueValues,
    Statuses: [],
    Armor: [],
    Theme: {
      ThemeId: theme.Id,
      AcceptedQuests: [
        { QuestId: theme.StartingQuestId, Completed: false, AcceptedAt: t },
        ...questIds.map((QuestId) => ({ QuestId, Completed: false, AcceptedAt: t })),
      ],
    },
    Load: { Tier: 'Normal', LatchedUntilCamp: false },
    Items: [],
    AbilityIds: abilityIds,
    SkillIds: skillIds,
    Advancement: { Potential: 0, PotentialAdvancementsTaken: [], History: [] },
    Recoveries: library.settings.RecoveriesMax,
    Scars: [],
    Wealth: 0,
    Treasure: 0,
    Hold: 0,
    CreatedAt: t,
    UpdatedAt: t,
  };
  await saveSheet(sheet, campaign.Id);
  await updateMembershipCharacter(membership.Id, character.Id);

  res.status(201).json({ character, sheet });
}));

// Content-admin-only — deletes the character and, via FK cascade, its sheet and any Bonds it's
// part of; the owning membership survives with CharacterId set null (see repo.ts). See
// apps/server/src/routes/admin.ts for the list view this pairs with.
charactersRouter.delete('/:id', requireAdmin, wrap(async (req, res) => {
  const character = await getCharacter(req.params.id);
  if (!character || character.CampaignId !== req.params.campaignId) { res.status(404).json({ error: 'No such character.' }); return; }
  await deleteCharacter(character.Id);
  res.json({ ok: true });
}));

import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth.js';
import { getCampaign, membershipFor, insertCharacter, saveSheet, updateMembershipCharacter, getLibrary, getCharacter, deleteCharacter, ensureBondsForCampaign } from '../repo.js';
import {
  assertCampaignActive,
  assertPartyCreationPhase,
  applyLoadTierBoonBane,
  CampaignArchivedError,
  characterCreationSchema,
  emptyMarks,
  newId,
  nowIso,
  PartyCreationRequiredError,
  type Character,
  type CharacterSheet,
  type TakenImprovement,
  type VirtueValue,
} from '@asohav/shared';
import { wrap } from '../asyncHandler.js';

// There is no character-creation flow anywhere else in the app — Virtue scores and Motifs are
// read-only once a sheet exists (see CLAUDE.md).
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
  const { name, pronouns, playerName, virtues, looks, motifs, improvementIds, loadTier } = parsed.data;

  const character: Character = { Id: newId('ch'), Name: name, Pronouns: pronouns, PlayerName: playerName, UserId: req.user!.id, CampaignId: campaign.Id };
  await insertCharacter(character);

  const t = nowIso();
  const virtueValues: VirtueValue[] = virtues.map((v) => ({ VirtueId: v.virtueId, Score: v.score, ConditionMarked: false }));

  // Build Improvements from the chosen IDs — each is guaranteed valid after schema parsing
  const improvements: TakenImprovement[] = improvementIds.map((id) => {
    const imp = library.improvements.find((i) => i.Id === id);
    return { Id: id, Name: imp!.Name, Effect: imp!.Effect, TakenAt: t };
  });

  const sheet: CharacterSheet = {
    Id: `sh-${character.Id}`,
    CharacterId: character.Id,
    Looks: looks.join('\n'),
    Virtues: virtueValues,
    Strain: emptyMarks(library.settings.StrainTrackLength),
    Statuses: [],
    HealingTrack: 0,
    Boons: [],
    Banes: [],
    Armor: [],
    Motifs: motifs.map((m) => ({
      MotifId: m.motifId ?? null,
      Name: m.name,
      SkillTags: [m.skillTag],
      FlawTags: [m.flawTag],
      Potential: 0,
      Quest: m.quest,
      ActBreaks: 0,
      Forsakes: 0,
    })),
    Load: { Tier: loadTier, LatchedUntilCamp: false },
    Items: [],
    WildcardDeclarations: [],
    Advancement: { History: [] },
    Improvements: improvements,
    Scars: [],
    Wealth: 0,
    Treasure: 0,
    Hold: 0,
    CreatedAt: t,
    UpdatedAt: t,
  };

  // Apply Load tier Boons/Banes per Ruleset V0.6 revision: Light gets Inconspicuous, Heavy gets Conspicuous
  applyLoadTierBoonBane(sheet, loadTier);

  await saveSheet(sheet, campaign.Id);
  await updateMembershipCharacter(membership.Id, character.Id);
  await ensureBondsForCampaign(campaign.Id);

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

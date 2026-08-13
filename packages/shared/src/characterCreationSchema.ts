import { z } from 'zod';
import { isStandardVirtueArray } from './logic.js';
import type { Library } from './types.js';

/** Character creation is the one place this app validates a real, cross-referenced payload
 *  against the content library rather than just checking field shapes — so the schema is a
 *  factory bound to a specific `Library` snapshot, not a static export. Both
 *  CreateCharacterPage.tsx (client-side, via @hookform/resolvers' zodResolver) and
 *  apps/server/src/routes/characters.ts (server-side, the actual authority — this route has no
 *  other layer to catch a missing check) call this with the same `Library`, so the two can't
 *  silently drift the way two hand-written copies of this validation already had started to. */
export function characterCreationSchema(library: Library) {
  const virtueIds = new Set(library.virtues.map((v) => v.Id));
  const skillIds = new Set(library.skills.map((s) => s.Id));
  const startingAbilityIds = new Set(library.abilities.filter((a) => a.Acquisition === 'Starting').map((a) => a.Id));
  const themeIds = new Set(library.themes.map((t) => t.Id));

  return z
    .object({
      name: z.string().trim().min(1, 'Character name is required.'),
      playerName: z.string().trim().min(1, 'Player name is required.'),
      themeId: z.string().refine((id) => themeIds.has(id), { message: 'Choose a valid Theme.' }),
      virtues: z
        .array(z.object({ virtueId: z.string(), score: z.number() }))
        .length(5, { message: 'Virtue assignment is malformed.' })
        .refine((vs) => new Set(vs.map((v) => v.virtueId)).size === 5 && vs.every((v) => virtueIds.has(v.virtueId)), {
          message: 'Virtue assignment is malformed.',
        })
        .refine((vs) => isStandardVirtueArray(vs.map((v) => v.score)), {
          message: "Virtue scores must use one of the game's standard starting arrays.",
        }),
      looks: z
        .array(z.string())
        .transform((ls) => ls.map((l) => l.trim()).filter(Boolean))
        .refine((ls) => ls.length > 0, { message: 'Describe at least one Look.' }),
      // Deduped before the length/membership checks below (a client sending the same id twice
      // shouldn't count double against the cap), matching what the server route did by hand
      // before this schema replaced it.
      questIds: z.array(z.string()).transform((ids) => [...new Set(ids)]),
      skillIds: z
        .array(z.string())
        .transform((ids) => [...new Set(ids)])
        .refine((ids) => ids.length <= library.settings.SkillsAtCreation, { message: `Choose up to ${library.settings.SkillsAtCreation} Skills.` })
        .refine((ids) => ids.every((id) => skillIds.has(id)), { message: `Choose up to ${library.settings.SkillsAtCreation} Skills.` }),
      abilityIds: z
        .array(z.string())
        .transform((ids) => [...new Set(ids)])
        .refine((ids) => ids.length <= library.settings.AbilitiesAtCreation, {
          message: `Choose up to ${library.settings.AbilitiesAtCreation} starting Abilities.`,
        })
        .refine((ids) => ids.every((id) => startingAbilityIds.has(id)), {
          message: `Choose up to ${library.settings.AbilitiesAtCreation} starting Abilities.`,
        }),
    })
    .superRefine((data, ctx) => {
      // Which Quests are valid depends on which Theme was chosen — a cross-field rule the
      // per-field checks above can't express on their own.
      const theme = library.themes.find((t) => t.Id === data.themeId);
      if (!theme) return; // already flagged by themeId's own refine
      const availableQuestIds = new Set(theme.QuestIds.filter((id) => id !== theme.StartingQuestId));
      if (data.questIds.some((id) => !availableQuestIds.has(id))) {
        ctx.addIssue({ code: 'custom', path: ['questIds'], message: 'Choose only optional Quests offered by your Theme.' });
      }
    });
}

export type CharacterCreationInput = z.infer<ReturnType<typeof characterCreationSchema>>;

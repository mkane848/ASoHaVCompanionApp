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
  const motifIds = new Set(library.motifs.map((m) => m.Id));

  return z
    .object({
      name: z.string().trim().min(1, 'Character name is required.'),
      playerName: z.string().trim().min(1, 'Player name is required.'),
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
      // Three Motifs, each with a name, one Skill Tag, one Flaw Tag, and one Quest. `motifId` is
      // optional — a custom Motif has none; when present it must be one of the 13 library Motifs.
      motifs: z
        .array(
          z.object({
            motifId: z.string().nullable().optional(),
            name: z.string().trim().min(1, 'Each Motif needs a name.'),
            skillTag: z.string().trim().min(1, 'Each Motif needs one Skill Tag.'),
            flawTag: z.string().trim().min(1, 'Each Motif needs one Flaw Tag.'),
            quest: z.string().trim().min(1, 'Each Motif needs a Quest.'),
          }),
        )
        .length(3, { message: 'Choose exactly three Motifs.' }),
    })
    .superRefine((data, ctx) => {
      data.motifs.forEach((m, i) => {
        if (m.motifId && !motifIds.has(m.motifId)) {
          ctx.addIssue({ code: 'custom', path: ['motifs', i, 'motifId'], message: 'Choose a valid Motif.' });
        }
      });
    });
}

export type CharacterCreationInput = z.infer<ReturnType<typeof characterCreationSchema>>;

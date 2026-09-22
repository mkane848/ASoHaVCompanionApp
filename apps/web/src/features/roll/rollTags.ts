import type { CharacterSheet } from '@asohav/shared';

export interface FlatTag {
  motifIndex: number;
  motifName: string;
  tag: string;
  key: string;
}

/** Flattens all three Motifs' Skill/Flaw Tags into one list, each entry carrying which Motif it
 *  came from (for Flaw Tags' Potential mark) and a stable key (`motifIndex-tagIndex`, not the tag
 *  text itself, since two Motifs — or the same Motif — could hold the same text twice). */
export function flattenTags(sheet: CharacterSheet, field: 'SkillTags' | 'FlawTags'): FlatTag[] {
  const out: FlatTag[] = [];
  sheet.Motifs.forEach((m, mi) => {
    m[field].forEach((tag, ti) => {
      if (tag.trim()) out.push({ motifIndex: mi, motifName: m.Name || `Motif ${mi + 1}`, tag, key: `${mi}-${ti}` });
    });
  });
  return out;
}

export const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  LICENCE_LINKS,
  SAFETY_CHAPTERS,
  SAFETY_NOTES,
  SAFETY_SOURCES,
  SAFETY_TOOLKIT_CREDIT,
  SAFETY_TOOLKIT_LICENCE,
} from './safetyToolsContent.js';

/** Reduce V0.7's Markdown to the words a reader sees: links become their label, emphasis and
 *  backslash escapes go, whitespace collapses. The app text is held to the same reduction. */
function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\\([^\w\s])/g, '$1')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ruleset = plain(readFileSync(fileURLToPath(new URL('../../../../../Planning Docs/Ruleset-V0.7.md', import.meta.url)), 'utf8'));

describe('Safety Tools content against Ruleset-V0.7.md', () => {
  it('quotes the required TTRPG Safety Toolkit credit text exactly (V0.7 L178-180)', () => {
    // V0.7 ends the sentence "...You can find it at [ttrpgsafetytoolkit.com](...)." with the link as its last words.
    expect(ruleset).toContain(plain(SAFETY_TOOLKIT_CREDIT));
    expect(SAFETY_TOOLKIT_CREDIT).toMatch(/^The TTRPG Safety Toolkit, co-curated by Kienna Shaw and Lauren Bryant-Monk,/);
  });

  it('quotes the licence note exactly (V0.7 L174-178)', () => {
    for (const paragraph of SAFETY_TOOLKIT_LICENCE) {
      expect(ruleset).toContain(plain(paragraph));
    }
  });

  it('keeps every tool summary as V0.7 words it, apart from the one repaired quotation mark', () => {
    const repaired = 'have the scene "fade to black."';
    for (const chapter of SAFETY_CHAPTERS) {
      for (const topic of chapter.topics) {
        for (const paragraph of topic.paragraphs) {
          const candidate = plain(paragraph);
          if (paragraph.includes(repaired)) {
            expect(ruleset).toContain(candidate.replace(repaired, 'have the scene "fade to black.'));
          } else {
            expect(ruleset, `"${topic.heading}": ${candidate.slice(0, 60)}`).toContain(candidate);
          }
        }
      }
    }
  });

  it('covers every V0.7 heading under the Safety Tools chapter', () => {
    const headings = SAFETY_CHAPTERS.flatMap((c) => [c.heading, ...c.topics.map((t) => t.heading)]);
    for (const h of ['What are Safety Tools?', 'Session 0', 'Lines and Veils', 'X, N, and O Cards', 'Open Door', 'Bleed', 'Aftercare', 'Debriefing', 'Stars and Wishes', 'Content Warnings']) {
      expect(headings).toContain(h);
    }
    expect(SAFETY_SOURCES.length).toBe(8);
    expect(SAFETY_NOTES.map((n) => n.heading)).toEqual(['Additional resources', 'Translations', 'Updates']);
  });

  it('keeps every outbound link as a standalone, https/http/mailto address', () => {
    for (const l of LICENCE_LINKS) expect(l.href).toMatch(/^(https?:|mailto:)/);
    for (const s of SAFETY_SOURCES) if (s.href) expect(s.href).toMatch(/^https?:/);
  });
});

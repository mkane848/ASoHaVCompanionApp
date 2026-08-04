import type { GlossaryTerm } from './types.js';

export interface GlossaryMatcher {
  /** null when the glossary is empty — callers should skip matching entirely rather than run a
   *  regex that can never match. */
  regex: RegExp | null;
  /** Lowercased Name/Alias -> the term it resolves to. */
  termByKey: Map<string, GlossaryTerm>;
}

export interface GlossarySegment {
  text: string;
  /** Set only on segments that matched a term. */
  term?: GlossaryTerm;
}

/** How many bubble-opens deep a piece of text is being linkified at. 0 is the original
 *  sheet text; a term's Definition, shown inside the bubble opened from a depth-0 match, is
 *  linkified at depth 1 so a definition that itself uses jargon still helps. Depth 2 is refused
 *  so a chain of definitions can't open bubble after bubble. */
const MAX_DEPTH = 1;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compiles every Name/Alias across `terms` into one alternation regex, longest phrase first so
 *  a multi-word alias ("Mark Kin") wins over a shorter one ("Kin") that's also a substring of it.
 *  Matching is case-sensitive and word-bounded on purpose: this game's rules text always
 *  capitalizes its proper nouns ("mark a Condition", not "mark a condition"), so requiring the
 *  authored casing is what keeps this from linking ordinary English words that happen to share a
 *  term's spelling. */
export function buildGlossaryMatcher(terms: GlossaryTerm[]): GlossaryMatcher {
  const termByKey = new Map<string, GlossaryTerm>();
  const phrases: string[] = [];
  for (const term of terms) {
    for (const raw of [term.Name, ...term.Aliases]) {
      const phrase = raw.trim();
      if (!phrase) continue;
      const key = phrase.toLowerCase();
      if (!termByKey.has(key)) termByKey.set(key, term);
      phrases.push(phrase);
    }
  }
  if (phrases.length === 0) return { regex: null, termByKey };

  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  const alternation = sorted.map(escapeRegExp).join('|');
  return { regex: new RegExp(`\\b(?:${alternation})\\b`, 'g'), termByKey };
}

/**
 * Splits `text` into plain and glossary-matched segments.
 *
 * `depth` tracks recursion into a term's own Definition (see MAX_DEPTH above) — callers
 * rendering top-level sheet text should leave it at the default 0.
 *
 * `excludeTermId` skips a term when linkifying its own Definition, so a term's bubble never
 * contains a tap-target that reopens itself.
 */
export function linkifyText(
  text: string,
  matcher: GlossaryMatcher,
  depth = 0,
  excludeTermId?: string,
): GlossarySegment[] {
  if (!text || !matcher.regex || depth > MAX_DEPTH) return [{ text }];

  const segments: GlossarySegment[] = [];
  let lastIndex = 0;
  matcher.regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.regex.exec(text))) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index) });
    const term = matcher.termByKey.get(match[0].toLowerCase());
    // Excluded (a term's own name inside its own Definition) still renders as plain text —
    // only the tap-link is suppressed, the word itself must not disappear from the sentence.
    segments.push(term && term.Id !== excludeTermId ? { text: match[0], term } : { text: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments.length ? segments : [{ text }];
}

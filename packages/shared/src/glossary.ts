import type { GlossaryTerm } from './types.js';

export interface GlossaryMatcher {
  /** null when the glossary is empty, or auto-linking is off (`GameSettings.GlossaryAutoLink`)
   *  — callers should skip regex matching entirely in that case. Explicit `[Term]` tags (see
   *  below) resolve independently of this and keep working either way. */
  regex: RegExp | null;
  /** Lowercased Name/Alias -> the term it resolves to. */
  termByKey: Map<string, GlossaryTerm>;
  /** Term `Id` -> the term itself, so an explicit tag's second bracket
   *  (`[shaken][g-status]`) can resolve by Id as well as by Name/Alias. */
  termById: Map<string, GlossaryTerm>;
}

export interface GlossarySegment {
  text: string;
  /** Set only on segments that matched a term. */
  term?: GlossaryTerm;
}

/** How many bubble-opens deep a piece of text is being linkified at. 0 is the original sheet
 *  text (also every top-level render, like a GlossaryDrawer entry, which never recurses). A
 *  term's own Definition, shown inside the bubble opened from a depth-0 match, is linkified at
 *  depth 1 — past `MAX_DEPTH` — so it renders as plain text plus "See also" chips (the drawer,
 *  GlossaryText.tsx) rather than opening a second bubble. 0.25.0 dropped this from 1 to 0 after a
 *  real screenshot showed a chain of nested bubbles (Kin -> Bond -> Kin -> ...) stacking as deep
 *  as a player kept tapping — the *intent* was always "one nested level," but GlossaryText.tsx
 *  passed a hardcoded `1` into every nested call instead of `depth + 1`, so the counter never
 *  actually advanced and this constant never got the chance to cap anything. See
 *  WorkPlan-0.25.0.md section E. */
const MAX_DEPTH = 0;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compiles every Name/Alias across `terms` into one alternation regex, longest phrase first so
 *  a multi-word alias ("Mark Kin") wins over a shorter one ("Kin") that's also a substring of it.
 *  Matching is case-sensitive and word-bounded on purpose: this game's rules text always
 *  capitalizes its proper nouns ("mark a Condition", not "mark a condition"), so requiring the
 *  authored casing is what keeps this from linking ordinary English words that happen to share a
 *  term's spelling.
 *
 *  `options.autoLink: false` (from `GameSettings.GlossaryAutoLink`, 0.24.0) retires this regex
 *  entirely — `regex` comes back null, same as an empty glossary — while `termByKey`/`termById`
 *  stay populated so explicit `[Term]` tags (see `linkifyText`) keep resolving regardless. */
export function buildGlossaryMatcher(terms: GlossaryTerm[], options?: { autoLink?: boolean }): GlossaryMatcher {
  const termByKey = new Map<string, GlossaryTerm>();
  const termById = new Map<string, GlossaryTerm>();
  const phrases: string[] = [];
  for (const term of terms) {
    termById.set(term.Id, term);
    for (const raw of [term.Name, ...term.Aliases]) {
      const phrase = raw.trim();
      if (!phrase) continue;
      const key = phrase.toLowerCase();
      if (!termByKey.has(key)) termByKey.set(key, term);
      phrases.push(phrase);
    }
  }
  const autoLink = options?.autoLink ?? true;
  if (phrases.length === 0 || !autoLink) return { regex: null, termByKey, termById };

  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  const alternation = sorted.map(escapeRegExp).join('|');
  return { regex: new RegExp(`\\b(?:${alternation})\\b`, 'g'), termByKey, termById };
}

/** Resolves an explicit tag's target string against a matcher: term `Id` first (exact, since
 *  Ids are authored lowercase slugs), then Name/Alias (case-insensitive, unlike the regex
 *  auto-linker — an author typing an explicit tag shouldn't also have to match authored casing). */
function resolveExplicitTag(key: string, matcher: GlossaryMatcher): GlossaryTerm | undefined {
  return matcher.termById.get(key) ?? matcher.termByKey.get(key.toLowerCase());
}

type TagToken = { kind: 'text'; value: string } | { kind: 'tag'; display: string; resolveKey: string };

/**
 * Low-level tokenizer for CommonMark reference-link-style explicit glossary tags, shared by
 * `scanExplicitTags` (rendering) and `findUnresolvedGlossaryTags` (Content Admin validation) —
 * doesn't know about a glossary at all, just the bracket grammar:
 *
 *   - `[Kin]`            — a tag; display and resolve-key are both "Kin".
 *   - `[shaken][g-kin]`  — display "shaken", resolve-key "g-kin" (a term Id or Name/Alias).
 *   - `\[`, `\]`         — a literal bracket, no tag (standard CommonMark escaping).
 *
 * An unmatched `[` with no closing `]` is left as a literal character rather than treated as a
 * malformed tag — authored content must not be able to break a render. `hadBrackets` is true the
 * moment any bracket construct is found (a tag or an escape), regardless of whether the tag goes
 * on to resolve against a glossary.
 */
function tokenizeTags(text: string): { tokens: TagToken[]; hadBrackets: boolean } {
  const tokens: TagToken[] = [];
  let hadBrackets = false;
  let plain = '';
  let i = 0;

  const flushPlain = () => {
    if (plain) tokens.push({ kind: 'text', value: plain });
    plain = '';
  };

  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && (text[i + 1] === '[' || text[i + 1] === ']')) {
      plain += text[i + 1];
      hadBrackets = true;
      i += 2;
      continue;
    }
    if (ch === '[') {
      const close = text.indexOf(']', i + 1);
      if (close === -1) {
        plain += ch;
        i += 1;
        continue;
      }
      const display = text.slice(i + 1, close);
      let resolveKey = display;
      let end = close + 1;
      if (text[end] === '[') {
        const close2 = text.indexOf(']', end + 1);
        if (close2 !== -1) {
          resolveKey = text.slice(end + 1, close2);
          end = close2 + 1;
        }
      }
      hadBrackets = true;
      flushPlain();
      tokens.push({ kind: 'tag', display, resolveKey });
      i = end;
      continue;
    }
    plain += ch;
    i += 1;
  }
  flushPlain();
  return { tokens, hadBrackets };
}

/**
 * Scans `text` for explicit glossary tags and resolves each one against `matcher` (see
 * `tokenizeTags` for the bracket grammar). Returns `hadExplicit: true` the moment any bracket
 * construct is found — see `linkifyText` for why that's the signal that turns off the regex
 * auto-linker for the rest of this field, not just the tagged occurrence.
 */
function scanExplicitTags(
  text: string,
  matcher: GlossaryMatcher,
  excludeTermId?: string,
): { segments: GlossarySegment[]; hadExplicit: boolean } {
  const { tokens, hadBrackets } = tokenizeTags(text);
  const segments: GlossarySegment[] = tokens.map((t) => {
    if (t.kind === 'text') return { text: t.value };
    const term = resolveExplicitTag(t.resolveKey, matcher);
    return term && term.Id !== excludeTermId ? { text: t.display, term } : { text: t.display };
  });
  return { segments, hadExplicit: hadBrackets };
}

/** Every explicit tag's resolve-key that failed to resolve against `matcher` — used by Content
 *  Admin's Validation panel (`validateLibrary`, `apps/server/src/adminLogic.ts`) to surface a
 *  typo'd or dangling `[Tag]` at authoring time, per the plan's "an author finds out at authoring
 *  time" requirement, rather than it silently rendering as plain text forever. */
export function findUnresolvedGlossaryTags(text: string, matcher: GlossaryMatcher): string[] {
  const { tokens } = tokenizeTags(text);
  const unresolved: string[] = [];
  for (const t of tokens) {
    if (t.kind === 'tag' && !resolveExplicitTag(t.resolveKey, matcher)) unresolved.push(t.resolveKey);
  }
  return unresolved;
}

/**
 * Splits `text` into plain and glossary-matched segments.
 *
 * `depth` tracks recursion into a term's own Definition (see MAX_DEPTH above) — callers
 * rendering top-level sheet text should leave it at the default 0.
 *
 * `excludeTermId` skips a term when linkifying its own Definition, so a term's bubble never
 * contains a tap-target that reopens itself.
 *
 * Explicit `[Term]`/`[display][id-or-name]` tags (see `scanExplicitTags`, 0.24.0) are checked
 * first. **A field containing at least one explicit tag is treated as fully explicit** — the
 * regex auto-linker below is skipped for the rest of that field, not just the tagged occurrence.
 * That's what makes migrating a field to explicit tags free: no flag, no backfill, a field with
 * no brackets behaves exactly as it always has.
 */
export function linkifyText(
  text: string,
  matcher: GlossaryMatcher,
  depth = 0,
  excludeTermId?: string,
): GlossarySegment[] {
  if (!text) return [{ text }];
  if (depth > MAX_DEPTH) {
    // Past the nesting limit, but an explicit [display][id] tag must still resolve to its plain
    // display text — the old `return [{ text }]` here left raw bracket syntax visible the moment
    // a definition stopped being linkified, since scanExplicitTags never ran. No `term` on any
    // segment, though: a tap-target this deep would just reopen the bubble this depth check
    // exists to prevent.
    const { segments } = scanExplicitTags(text, matcher, excludeTermId);
    return (segments.length ? segments : [{ text: '' }]).map((s) => ({ text: s.text }));
  }

  const explicit = scanExplicitTags(text, matcher, excludeTermId);
  if (explicit.hadExplicit) return explicit.segments.length ? explicit.segments : [{ text: '' }];

  if (!matcher.regex) return [{ text }];

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

import { describe, expect, it } from 'vitest';
import { buildGlossaryMatcher, linkifyText } from './glossary.js';
import type { GlossaryTerm } from './types.js';

const condition: GlossaryTerm = { Id: 'g-condition', Name: 'Condition', Aliases: ['Conditions'], Definition: 'A Virtue-linked penalty.' };
const kin: GlossaryTerm = { Id: 'g-kin', Name: 'Kin', Aliases: ['Mark Kin'], Definition: 'A Bond track, marked to strengthen a Bond.' };
const rapport: GlossaryTerm = { Id: 'g-rapport', Name: 'Rapport', Aliases: [], Definition: 'A party track.' };

describe('buildGlossaryMatcher', () => {
  it('returns a null regex for an empty glossary', () => {
    expect(buildGlossaryMatcher([]).regex).toBeNull();
  });

  it('indexes both Name and Aliases, case-insensitively keyed', () => {
    const { termByKey } = buildGlossaryMatcher([condition]);
    expect(termByKey.get('condition')).toBe(condition);
    expect(termByKey.get('conditions')).toBe(condition);
  });
});

describe('linkifyText', () => {
  it('links a single capitalized term with word boundaries', () => {
    const matcher = buildGlossaryMatcher([condition]);
    const segments = linkifyText('you may mark a Condition to treat it as a 7–9 instead.', matcher);
    expect(segments.map((s) => s.term?.Id ?? null)).toContain('g-condition');
    expect(segments.map((s) => s.text).join('')).toBe('you may mark a Condition to treat it as a 7–9 instead.');
  });

  it('does not match lowercase mentions (Title-Case-only, avoids common-word false positives)', () => {
    const matcher = buildGlossaryMatcher([condition]);
    const segments = linkifyText('the road was in poor condition after the storm.', matcher);
    expect(segments.every((s) => !s.term)).toBe(true);
  });

  it('does not match a substring inside a longer word', () => {
    const matcher = buildGlossaryMatcher([kin]);
    const segments = linkifyText('She raised her Kindred banner.', matcher);
    expect(segments.every((s) => !s.term)).toBe(true);
  });

  it('prefers the longest phrase when a short alias is a substring of a longer one', () => {
    const matcher = buildGlossaryMatcher([kin]);
    const segments = linkifyText('When you Mark Kin with an ally, note it.', matcher);
    const matched = segments.filter((s) => s.term);
    expect(matched).toHaveLength(1);
    expect(matched[0].text).toBe('Mark Kin');
  });

  it('links multiple distinct terms in the same sentence', () => {
    const matcher = buildGlossaryMatcher([condition, rapport]);
    const segments = linkifyText('mark Rapport or clear a Condition.', matcher);
    const ids = segments.filter((s) => s.term).map((s) => s.term!.Id);
    expect(ids).toEqual(['g-rapport', 'g-condition']);
  });

  it('does not link past MAX_DEPTH (0 as of 0.25.0 — one nested definition renders plain)', () => {
    const matcher = buildGlossaryMatcher([condition]);
    const atLimit = linkifyText('mark a Condition.', matcher, 0);
    expect(atLimit.some((s) => s.term)).toBe(true);
    const pastLimit = linkifyText('mark a Condition.', matcher, 1);
    expect(pastLimit.every((s) => !s.term)).toBe(true);
    expect(pastLimit.map((s) => s.text).join('')).toBe('mark a Condition.');
  });

  it('flattens an explicit tag to its plain display text past MAX_DEPTH instead of leaking brackets', () => {
    const matcher = buildGlossaryMatcher([condition]);
    const pastLimit = linkifyText('you feel [shaken][g-condition] by it.', matcher, 1);
    expect(pastLimit.every((s) => !s.term)).toBe(true);
    expect(pastLimit.map((s) => s.text).join('')).toBe('you feel shaken by it.');
  });

  it('excludes a term from linking inside its own Definition without dropping the word', () => {
    const matcher = buildGlossaryMatcher([condition]);
    // depth 0, not 1: this exercises the regex-match exclusion path itself (matcher.termByKey ->
    // excludeTermId check), which is a different code path than the past-MAX_DEPTH flattening
    // covered above — a depth of 1 would land there instead and pass for the wrong reason (that
    // branch strips every term regardless of excludeTermId).
    const segments = linkifyText('A Condition clears when its ClearAction is done.', matcher, 0, 'g-condition');
    expect(segments.every((s) => !s.term)).toBe(true);
    expect(segments.map((s) => s.text).join('')).toBe('A Condition clears when its ClearAction is done.');
  });

  it('returns the text unchanged when the glossary is empty', () => {
    const matcher = buildGlossaryMatcher([]);
    const segments = linkifyText('mark a Condition.', matcher);
    expect(segments).toEqual([{ text: 'mark a Condition.' }]);
  });
});

describe('explicit glossary tags', () => {
  it('links a single-bracket tag, resolved case-insensitively unlike the auto-linker', () => {
    const matcher = buildGlossaryMatcher([condition]);
    const segments = linkifyText('mark a [condition].', matcher);
    const matched = segments.filter((s) => s.term);
    expect(matched).toHaveLength(1);
    expect(matched[0].text).toBe('condition');
    expect(matched[0].term!.Id).toBe('g-condition');
  });

  it('displays different text than it resolves to via a two-bracket tag, resolving by Id', () => {
    const matcher = buildGlossaryMatcher([condition]);
    const segments = linkifyText('you feel [shaken][g-condition] by it.', matcher);
    const matched = segments.filter((s) => s.term);
    expect(matched).toHaveLength(1);
    expect(matched[0].text).toBe('shaken');
    expect(matched[0].term!.Id).toBe('g-condition');
  });

  it('resolves the second bracket by Name/Alias as well as by Id', () => {
    const matcher = buildGlossaryMatcher([kin]);
    const segments = linkifyText('you [swear an oath][Mark Kin] together.', matcher);
    const matched = segments.filter((s) => s.term);
    expect(matched).toHaveLength(1);
    expect(matched[0].term!.Id).toBe('g-kin');
  });

  it('renders an unresolved tag as plain display text, never an error or a visible bracket', () => {
    const matcher = buildGlossaryMatcher([condition]);
    const segments = linkifyText('a [Frobnicate] happened.', matcher);
    expect(segments.every((s) => !s.term)).toBe(true);
    expect(segments.map((s) => s.text).join('')).toBe('a Frobnicate happened.');
  });

  it('treats an escaped bracket as a literal character, not a tag', () => {
    const matcher = buildGlossaryMatcher([condition]);
    const segments = linkifyText('literally \\[Condition\\] in brackets.', matcher);
    expect(segments.every((s) => !s.term)).toBe(true);
    expect(segments.map((s) => s.text).join('')).toBe('literally [Condition] in brackets.');
  });

  it('leaves an unclosed bracket as a literal character rather than erroring', () => {
    const matcher = buildGlossaryMatcher([condition]);
    const segments = linkifyText('a stray [ bracket.', matcher);
    expect(segments.map((s) => s.text).join('')).toBe('a stray [ bracket.');
  });

  it('disables the regex auto-linker for the whole field once any explicit tag is present', () => {
    const matcher = buildGlossaryMatcher([condition, rapport]);
    // Rapport would auto-link on its own; the explicit [Condition] tag should suppress that.
    const segments = linkifyText('[Condition] costs you Rapport.', matcher);
    const matched = segments.filter((s) => s.term);
    expect(matched).toHaveLength(1);
    expect(matched[0].term!.Id).toBe('g-condition');
  });

  it('still auto-links via regex when a field has no bracket syntax at all', () => {
    const matcher = buildGlossaryMatcher([condition]);
    const segments = linkifyText('mark a Condition.', matcher);
    expect(segments.filter((s) => s.term)).toHaveLength(1);
  });

  it('excludes a term from an explicit self-referencing tag, same as the regex path', () => {
    const matcher = buildGlossaryMatcher([condition]);
    // depth 0, same reasoning as the regex-path exclusion test above — depth 1 is past MAX_DEPTH
    // now and would exercise the flattening branch instead of scanExplicitTags' own exclusion.
    const segments = linkifyText('A [Condition] clears eventually.', matcher, 0, 'g-condition');
    expect(segments.every((s) => !s.term)).toBe(true);
    expect(segments.map((s) => s.text).join('')).toBe('A Condition clears eventually.');
  });

  it('GlossaryAutoLink: false retires the regex pass while explicit tags keep working', () => {
    const matcher = buildGlossaryMatcher([condition], { autoLink: false });
    expect(matcher.regex).toBeNull();
    const auto = linkifyText('mark a Condition.', matcher);
    expect(auto.every((s) => !s.term)).toBe(true);
    const explicit = linkifyText('mark a [Condition].', matcher);
    expect(explicit.filter((s) => s.term)).toHaveLength(1);
  });
});

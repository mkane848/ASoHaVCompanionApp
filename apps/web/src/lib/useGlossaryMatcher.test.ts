import { describe, expect, it } from 'vitest';
import type { GlossaryTerm } from '@asohav/shared';
import { cachedMatcher } from './useGlossaryMatcher.js';

function term(overrides: Partial<GlossaryTerm> = {}): GlossaryTerm {
  return { Id: 'g-kin', Name: 'Kin', Aliases: [], Definition: 'A social bond.', ...overrides };
}

describe('cachedMatcher', () => {
  it('returns the same matcher instance for the same glossary array + autoLink value', () => {
    const glossary = [term()];

    const first = cachedMatcher(glossary, true);
    const second = cachedMatcher(glossary, true);

    expect(second).toBe(first);
  });

  it('returns a different matcher for a different (even deep-equal) array reference — cache is keyed by identity, not content', () => {
    const glossaryA = [term()];
    const glossaryB = [term()];

    const matcherA = cachedMatcher(glossaryA, true);
    const matcherB = cachedMatcher(glossaryB, true);

    expect(matcherB).not.toBe(matcherA);
  });

  it('splits the cache by autoLink — the bug this two-WeakMap split (0.24.1) fixed', () => {
    // Same array reference both times, mirroring the real scenario: a settings-only edit
    // (toggling GlossaryAutoLink) refetches ['library'], but TanStack Query's structural
    // sharing keeps `library.glossary`'s old array reference when the terms themselves didn't
    // change. A single reference-keyed cache would then silently hand back the matcher built
    // under the *old* autoLink value.
    const glossary = [term()];

    const withAutoLink = cachedMatcher(glossary, true);
    const withoutAutoLink = cachedMatcher(glossary, false);

    expect(withoutAutoLink).not.toBe(withAutoLink);
    expect(withoutAutoLink.regex).toBeNull(); // buildGlossaryMatcher's own documented autoLink:false behavior
    expect(withAutoLink.regex).not.toBeNull();

    // And each half of the split is itself still cached on repeat calls.
    expect(cachedMatcher(glossary, true)).toBe(withAutoLink);
    expect(cachedMatcher(glossary, false)).toBe(withoutAutoLink);
  });

  it('indexes terms by Id and by lowercased Name/Alias, matching buildGlossaryMatcher directly', () => {
    const glossary = [term({ Id: 'g-bond', Name: 'Bond', Aliases: ['Bonded'] })];

    const matcher = cachedMatcher(glossary, true);

    expect(matcher.termById.get('g-bond')?.Name).toBe('Bond');
    expect(matcher.termByKey.get('bond')?.Id).toBe('g-bond');
    expect(matcher.termByKey.get('bonded')?.Id).toBe('g-bond');
  });
});

import { useMemo } from 'react';
import { buildGlossaryMatcher, type GlossaryMatcher, type GlossaryTerm } from '@asohav/shared';
import { useLibrary } from './useLibrary.js';

// `useMemo` alone only dedupes within one component instance — every sheet panel that calls this
// hook does its own build over the *same* `library.glossary` array (referentially stable via the
// TanStack Query cache), so without this cache buildGlossaryMatcher() reruns once per panel on a
// single mount instead of once per actual glossary change. Module-level, keyed on the array
// reference, so it's invalidated for free whenever a Realtime `library` update swaps in a new array.
const matcherCache = new WeakMap<GlossaryTerm[], GlossaryMatcher>();

function cachedMatcher(glossary: GlossaryTerm[]): GlossaryMatcher {
  let matcher = matcherCache.get(glossary);
  if (!matcher) {
    matcher = buildGlossaryMatcher(glossary);
    matcherCache.set(glossary, matcher);
  }
  return matcher;
}

/** One compiled matcher shared across the whole tree, rebuilt only when the library's glossary
 *  actually changes. `library.glossary` can be missing on a library JSONB row saved before this
 *  collection existed — see README.md#architecture-notes--judgment-calls — so this defaults it
 *  rather than letting `buildGlossaryMatcher` see `undefined`. */
export function useGlossaryMatcher(): GlossaryMatcher | null {
  const { data: library } = useLibrary();
  const glossary = library?.glossary;
  return useMemo(() => (glossary ? cachedMatcher(glossary) : null), [glossary]);
}

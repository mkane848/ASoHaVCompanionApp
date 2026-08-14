import { useMemo } from 'react';
import { buildGlossaryMatcher, type GlossaryMatcher, type GlossaryTerm } from '@asohav/shared';
import { useLibrary } from './useLibrary.js';

// `useMemo` alone only dedupes within one component instance — every sheet panel that calls this
// hook does its own build over the *same* `library.glossary` array (referentially stable via the
// TanStack Query cache), so without this cache buildGlossaryMatcher() reruns once per panel on a
// single mount instead of once per actual glossary change. Module-level, keyed on the array
// reference, so it's invalidated for free whenever a Realtime `library` update swaps in a new
// array.
//
// Two WeakMaps, not one keyed on `glossary` alone — `GlossaryAutoLink` does *not* reliably change
// in lockstep with `glossary`'s reference. `useLibrary()` never sets `structuralSharing: false`,
// so TanStack Query's default `replaceEqualDeep` applies on every refetch: it keeps a fetched
// sub-tree's *old* reference whenever it's deep-equal to the new one. A settings-only edit (e.g.
// toggling `GlossaryAutoLink` in Content Admin) still invalidates and refetches `['library']` —
// the same as any other library write, including via `useLiveCampaign`'s Realtime subscription —
// but if the glossary terms themselves didn't change, `library.glossary` comes back as the exact
// same array reference as before. A single reference-keyed cache would then hand back the matcher
// built under the *old* `autoLink` value: the toggle would silently do nothing for any
// already-mounted session until an unrelated glossary edit happened to also change the array
// identity. Splitting the cache by `autoLink` (only two possible values) closes that gap without
// giving up the reference-keyed win for the common case of glossary content actually changing.
const matcherCacheAutoLinkOn = new WeakMap<GlossaryTerm[], GlossaryMatcher>();
const matcherCacheAutoLinkOff = new WeakMap<GlossaryTerm[], GlossaryMatcher>();

function cachedMatcher(glossary: GlossaryTerm[], autoLink: boolean): GlossaryMatcher {
  const cache = autoLink ? matcherCacheAutoLinkOn : matcherCacheAutoLinkOff;
  let matcher = cache.get(glossary);
  if (!matcher) {
    matcher = buildGlossaryMatcher(glossary, { autoLink });
    cache.set(glossary, matcher);
  }
  return matcher;
}

/** One compiled matcher shared across the whole tree, rebuilt only when the library's glossary or
 *  its auto-link setting actually changes. `library.glossary` can be missing on a library JSONB
 *  row saved before this collection existed — see README.md#architecture-notes--judgment-calls —
 *  so this defaults it rather than letting `buildGlossaryMatcher` see `undefined`. `GlossaryAutoLink`
 *  defaults `true` the same way — `normalizeLibrary()` backfills it server-side, but a
 *  not-yet-refetched client cache entry could still be missing it. */
export function useGlossaryMatcher(): GlossaryMatcher | null {
  const { data: library } = useLibrary();
  const glossary = library?.glossary;
  const autoLink = library?.settings.GlossaryAutoLink ?? true;
  return useMemo(() => (glossary ? cachedMatcher(glossary, autoLink) : null), [glossary, autoLink]);
}

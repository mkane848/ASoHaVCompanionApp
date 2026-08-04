import { useMemo } from 'react';
import { buildGlossaryMatcher, type GlossaryMatcher } from '@asohav/shared';
import { useLibrary } from './useLibrary.js';

/** One compiled matcher shared across the whole tree, rebuilt only when the library's glossary
 *  actually changes. `library.glossary` can be missing on a library JSONB row saved before this
 *  collection existed — see README.md#architecture-notes--judgment-calls — so this defaults it
 *  rather than letting `buildGlossaryMatcher` see `undefined`. */
export function useGlossaryMatcher(): GlossaryMatcher | null {
  const { data: library } = useLibrary();
  const glossary = library?.glossary;
  return useMemo(() => (glossary ? buildGlossaryMatcher(glossary) : null), [glossary]);
}

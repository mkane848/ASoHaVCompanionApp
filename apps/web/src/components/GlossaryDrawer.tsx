import { useEffect, useMemo } from 'react';
import type { GlossaryMatcher, GlossaryTerm, Library } from '@asohav/shared';
import { linkifyText } from '@asohav/shared';
import { useModalA11y } from '../lib/useModalA11y.js';
import { useGlossaryMatcher } from '../lib/useGlossaryMatcher.js';
import { useGlossaryUiStore } from '../store/glossaryUiStore.js';
import styles from './GlossaryDrawer.module.css';

function scrollToTerm(id: string) {
  document.getElementById(`glossary-term-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/** Player-facing reference for every glossary term, modelled directly on MovesDrawer (0.25.0) —
 *  shares its shell (styles/drawer.module.css) and its useModalA11y wiring. Rendered from both
 *  the character sheet and the Campaign page (Combat's Toughness/Range terms need to be reachable
 *  mid-fight, and Combat only renders inline on Campaign), reading its own open state from
 *  glossaryUiStore rather than an `open` prop, so either page can mount it once and forget it. */
export function GlossaryDrawer({ library }: { library: Library }) {
  const { open, initialTermId, query, closeDrawer, setQuery } = useGlossaryUiStore();
  const matcher = useGlossaryMatcher();
  // Called unconditionally, before the `open` early return — same reasoning as MovesDrawer.tsx.
  const dialogRef = useModalA11y<HTMLDivElement>(closeDrawer);

  const terms = useMemo(() => [...library.glossary].sort((a, b) => a.Name.localeCompare(b.Name)), [library.glossary]);

  useEffect(() => {
    if (!open || !initialTermId) return;
    // One frame so the drawer has actually opened (and the target term is laid out) before
    // measuring its position — a same-tick scrollIntoView on the opening render is a no-op.
    const raf = requestAnimationFrame(() => scrollToTerm(initialTermId));
    return () => cancelAnimationFrame(raf);
  }, [open, initialTermId]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? terms.filter(
        (t) => t.Name.toLowerCase().includes(q) || t.Aliases.some((a) => a.toLowerCase().includes(q)) || t.Definition.toLowerCase().includes(q),
      )
    : terms;

  return (
    <>
      <div className={styles.scrim} onClick={closeDrawer} />
      <div
        ref={dialogRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glossary-drawer-title"
        tabIndex={-1}
      >
        <div className={styles.head}>
          <h2 id="glossary-drawer-title" className={styles.title}>Glossary</h2>
          <button className={`tap ${styles.close}`} onClick={closeDrawer}>
            &times;
          </button>
        </div>
        <div className={styles.body}>
          <input className={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search terms…" />

          {filtered.length === 0 && <p className={styles.empty}>No terms match.</p>}

          {filtered.map((term) => (
            <GlossaryEntry key={term.Id} term={term} matcher={matcher} />
          ))}
        </div>
      </div>
    </>
  );
}

function GlossaryEntry({ term, matcher }: { term: GlossaryTerm; matcher: GlossaryMatcher | null }) {
  // depth 0 (not 1): unlike a nested bubble reopening a definition mid-page, this is the term's
  // own top-level entry in the list, so full linking/tag resolution applies — segments are only
  // used here to find which *other* terms this one mentions (`seeAlso`), not to render tap-
  // targets; `text` is the reconstructed plain definition (explicit-tag brackets already resolved
  // to their display text by linkifyText itself, not left as raw `[Term]` syntax).
  const { text, seeAlso } = useMemo(() => {
    if (!matcher) return { text: term.Definition, seeAlso: [] as GlossaryTerm[] };
    const segments = linkifyText(term.Definition, matcher, 0, term.Id);
    const seen = new Set<string>();
    const seeAlso: GlossaryTerm[] = [];
    for (const seg of segments) {
      if (seg.term && !seen.has(seg.term.Id)) {
        seen.add(seg.term.Id);
        seeAlso.push(seg.term);
      }
    }
    return { text: segments.map((seg) => seg.text).join(''), seeAlso };
  }, [term, matcher]);

  return (
    <div id={`glossary-term-${term.Id}`} className={styles.entry}>
      <h3 className={styles.entryName}>{term.Name}</h3>
      {term.Aliases.length > 0 && <div className={styles.aliases}>{term.Aliases.join(', ')}</div>}
      <p className={styles.definition}>{text}</p>
      {seeAlso.length > 0 && (
        <div className={`tap-row ${styles.seeAlsoRow}`}>
          <span className={styles.seeAlsoLabel}>See also</span>
          {seeAlso.map((t) => (
            <button key={t.Id} type="button" className={`tap-inline ${styles.seeAlsoChip}`} onClick={() => scrollToTerm(t.Id)}>
              {t.Name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

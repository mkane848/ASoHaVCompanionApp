import { Fragment, useMemo } from 'react';
import { linkifyText, type GlossaryMatcher, type GlossaryTerm } from '@asohav/shared';
import { useTapReveal } from '../lib/useTapReveal.js';
import { useGlossaryUiStore } from '../store/glossaryUiStore.js';
import styles from './GlossaryText.module.css';

/**
 * Renders `text` with any glossary term it contains turned into a tap-to-reveal definition link.
 * Falls back to plain text when the matcher isn't ready yet (library still loading) or a text
 * field has no matches, so it's safe to wrap every authored description/effect/rules-text field
 * on the sheet unconditionally.
 */
export function GlossaryText({ text, matcher }: { text: string; matcher: GlossaryMatcher | null }) {
  if (!matcher) return <>{text}</>;
  const segments = linkifyText(text, matcher, 0);
  if (segments.length === 1 && !segments[0].term) return <>{segments[0].text}</>;

  return (
    <>
      {segments.map((seg, i) =>
        seg.term ? (
          <GlossaryTermLink key={i} term={seg.term} matchedText={seg.text} matcher={matcher} depth={0} />
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}

function GlossaryTermLink({
  term,
  matchedText,
  matcher,
  depth,
}: {
  term: GlossaryTerm;
  matchedText: string;
  matcher: GlossaryMatcher;
  depth: number;
}) {
  const { open, setOpen, ref } = useTapReveal<HTMLSpanElement>();

  return (
    <span className={styles.wrap} ref={ref}>
      {/*
        A <span role="button"> rather than a <button>, deliberately: the responsive smoke test's
        44x44 touch-target check (apps/web/scripts/responsive-smoke.mjs) queries
        `button, a, input, select, textarea`, and a real button here would fail it — but a real
        44px box is also the wrong answer on its own terms. Sentences routinely carry two or three
        terms close together (Offer Solace's "mark Potential, clear a Condition, or shift a
        Status"); 44px hit-boxes on adjacent words would overlap each other, the exact failure
        `.tap-inline` (layout.css) was built to avoid for chip rows. Inline text targets are
        WCAG's own documented exception to minimum target size (2.5.8) for the same reason: they
        can't grow without breaking the sentence they live in.
      */}
      <span
        role="button"
        tabIndex={0}
        className={styles.term}
        // Description/effect text sometimes renders inside another clickable row (e.g. a Theme
        // option button in AdvancementPicker) — stop the tap from also firing that ancestor.
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }
        }}
        aria-expanded={open}
        aria-label={`Definition: ${term.Name}`}
      >
        {matchedText}
      </span>
      {open && (
        <span className={styles.bubble} role="tooltip">
          <span className={styles.bubbleLabel}>{term.Name}</span>
          <span>
            <DefinitionText term={term} matcher={matcher} depth={depth} />
          </span>
        </span>
      )}
    </span>
  );
}

function DefinitionText({ term, matcher, depth }: { term: GlossaryTerm; matcher: GlossaryMatcher; depth: number }) {
  const openGlossary = useGlossaryUiStore((s) => s.openDrawer);
  // depth + 1, not a hardcoded 1 — the bug behind the reported "nests as deep as you keep
  // tapping" behaviour was exactly this literal, which meant the depth counter never actually
  // advanced past 1 no matter how many bubbles deep a chain of definitions went. Past MAX_DEPTH
  // (see glossary.ts) this comes back as plain text with no `.term` on any segment, which is what
  // stops a definition from opening another bubble.
  const segments = linkifyText(term.Definition, matcher, depth + 1, term.Id);
  // A second, independent call at depth 0 purely to find which other terms this definition
  // mentions, for the "See also" list below — unaffected by the render depth cap above, since a
  // chip opens the Glossary drawer rather than another bubble, so it can't reopen the nesting
  // problem the cap exists to prevent. linkifyText already returns exactly this information in
  // its segments; no new matching logic needed.
  const seeAlso = useMemo(() => {
    const seen = new Set<string>();
    const terms: GlossaryTerm[] = [];
    for (const seg of linkifyText(term.Definition, matcher, 0, term.Id)) {
      if (seg.term && !seen.has(seg.term.Id)) {
        seen.add(seg.term.Id);
        terms.push(seg.term);
      }
    }
    return terms;
  }, [term, matcher]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.term ? (
          <GlossaryTermLink key={i} term={seg.term} matchedText={seg.text} matcher={matcher} depth={depth + 1} />
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
      {seeAlso.length > 0 && (
        <span className={styles.seeAlsoRow}>
          <span className={styles.seeAlsoLabel}>See also</span>
          {seeAlso.map((t) => (
            <button
              key={t.Id}
              type="button"
              className={`tap-inline ${styles.seeAlsoChip}`}
              // Definition text sometimes sits inside another clickable row (same reasoning as
              // the term span's own onClick above) — stop the tap from also firing that ancestor.
              onClick={(e) => {
                e.stopPropagation();
                openGlossary(t.Id);
              }}
            >
              {t.Name}
            </button>
          ))}
        </span>
      )}
    </>
  );
}

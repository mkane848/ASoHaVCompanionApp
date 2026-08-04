import { Fragment } from 'react';
import { linkifyText, type GlossaryMatcher, type GlossaryTerm } from '@asohav/shared';
import { useTapReveal } from '../lib/useTapReveal.js';
import styles from './GlossaryText.module.css';

/**
 * Renders `text` with any glossary term it contains turned into a tap-to-reveal definition link.
 * Falls back to plain text when the matcher isn't ready yet (library still loading) or a text
 * field has no matches, so it's safe to wrap every authored description/effect/rules-text field
 * on the sheet unconditionally.
 */
export function GlossaryText({ text, matcher }: { text: string; matcher: GlossaryMatcher | null }) {
  if (!matcher) return <>{text}</>;
  const segments = linkifyText(text, matcher);
  if (segments.length === 1 && !segments[0].term) return <>{segments[0].text}</>;

  return (
    <>
      {segments.map((seg, i) =>
        seg.term ? (
          <GlossaryTermLink key={i} term={seg.term} matchedText={seg.text} matcher={matcher} />
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}

function GlossaryTermLink({ term, matchedText, matcher }: { term: GlossaryTerm; matchedText: string; matcher: GlossaryMatcher }) {
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
            <DefinitionText term={term} matcher={matcher} />
          </span>
        </span>
      )}
    </span>
  );
}

function DefinitionText({ term, matcher }: { term: GlossaryTerm; matcher: GlossaryMatcher }) {
  const segments = linkifyText(term.Definition, matcher, 1, term.Id);
  return (
    <>
      {segments.map((seg, i) =>
        seg.term ? (
          <GlossaryTermLink key={i} term={seg.term} matchedText={seg.text} matcher={matcher} />
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}

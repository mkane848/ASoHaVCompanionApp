import { useEffect, useRef, useState } from 'react';
import type { GlossaryMatcher } from '@asohav/shared';
import { GlossaryText } from '../GlossaryText.js';
import styles from './ProseField.module.css';

/**
 * Authored prose that reads as glossary-linked text and becomes a `<textarea>` when you click into
 * it — the read-only/edit toggle chosen for `HANDOFF.md` open issue 21.
 *
 * Adventure Prep was the one surface that could not comply with CLAUDE.md's "all authored prose
 * goes through `GlossaryText`" convention, because Concept, Hook, every Secret and every Countdown
 * step are live `onBlur`-committing `<textarea>`s and `GlossaryText` wraps *text nodes* — it has
 * nothing to attach to inside an editable control. Nobody had chosen among the three options the
 * issue listed; the app did "terms simply don't link here" by omission.
 *
 * Two things make this work, and both are load-bearing:
 *
 * - **The read view is a `div[role="button"]`, not a `<button>`, and that is forced rather than
 *   preferred.** `GlossaryText` renders each matched term as its own `<span role="button">`, so a
 *   real `<button>` wrapper would nest interactive elements — invalid HTML, and it would swallow
 *   the term taps this whole change exists to enable. It also keeps the block out of the
 *   responsive smoke test's `button, a, input, select, textarea` 44x44 query, which is the same
 *   call `GlossaryText` documents for its own term spans.
 * - **Tapping a term must open its definition, not drop you into the editor.** It already does:
 *   `GlossaryText`'s term span calls `e.stopPropagation()` on click, added so a definition inside
 *   a clickable Bond history row wouldn't also fire the row. That mechanism carries this case
 *   unchanged — no new plumbing.
 *
 * Styling stays with the caller via `className`: this file owns the *behaviour*, while each
 * surface keeps its own textarea look. `AdventuresPanel.module.css` explains why there is no
 * shared `Textarea` primitive to inherit from, and inventing one here would have meant two
 * competing definitions of what a textarea looks like.
 */
export function ProseField({
  id,
  value,
  placeholder,
  label,
  disabled = false,
  matcher,
  className = '',
  onCommit,
}: {
  id?: string;
  value: string;
  placeholder?: string;
  /** Used for the read view's accessible name — see the `aria-label` note below. */
  label: string;
  /** A locked Adventure (archived or Concluded). Renders linked prose with no way into the editor,
   *  which is strictly better than the disabled `<textarea>` this replaced: reading back a
   *  concluded Adventure is exactly when you want the terms to link. */
  disabled?: boolean;
  matcher: GlossaryMatcher | null;
  className?: string;
  /** Receives the raw textarea value. Callers trim or don't, matching what each field did before
   *  — Concept and Hook trim, a Secret does not. */
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const readRef = useRef<HTMLDivElement>(null);
  /* The height the prose actually occupied at the moment it was activated. Computing the editor's
     height from its own content instead is not equivalent and was measured to be wrong — see
     `autoSize`. Floor it to what the reader just saw and the swap cannot move anything, whatever
     the two elements' intrinsic heights would have been. */
  const [floor, setFloor] = useState<number | null>(null);

  function activate() {
    setFloor(readRef.current?.getBoundingClientRect().height ?? null);
    setEditing(true);
  }

  if (editing && !disabled) {
    return (
      <ProseEditor
        id={id}
        label={label}
        className={className}
        value={value}
        placeholder={placeholder}
        minHeight={floor}
        onDone={(next) => {
          setEditing(false);
          onCommit(next);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const empty = value.trim() === '';

  return (
    <div
      ref={readRef}
      id={id}
      className={`${className} ${styles.box} ${styles.read} ${empty ? styles.empty : ''} ${disabled ? styles.locked : ''}`}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      /* An explicit accessible name rather than relying on the sibling `<label htmlFor>`: a label
         only associates with a *labelable* element, and this is a div. The visible label still
         serves sighted readers; this makes the same name reach assistive tech, and says what the
         control does, since "Concept" alone wouldn't reveal that it opens an editor. */
      aria-label={disabled ? undefined : `${label} — activate to edit`}
      onClick={disabled ? undefined : activate}
      onKeyDown={
        disabled
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
              }
            }
      }
    >
      {empty ? placeholder ?? '' : <GlossaryText text={value} matcher={matcher} />}
    </div>
  );
}

/** Split out so the focus effect runs on mount — the editor only exists once you've activated it,
 *  so "focus when it appears" and "focus on mount" are the same moment. The caret goes to the end
 *  rather than the start: you clicked into existing prose to continue it, not to retype it. */
function ProseEditor({
  id,
  label,
  className,
  value,
  placeholder,
  minHeight,
  onDone,
  onCancel,
}: {
  id?: string;
  label: string;
  className: string;
  value: string;
  placeholder?: string;
  minHeight: number | null;
  onDone: (next: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  /* Read inside `onBlur`, because Escape gets out by blurring — one exit path, so a keyboard
     cancel and a click-away cannot disagree about whether the edit was committed. A ref rather
     than state: it is set and read within the same event turn and must not schedule a render. */
  const cancelled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    autoSize(el, minHeight);
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    // `minHeight` is listed rather than suppressed, and it is genuinely stable: ProseField
    // measures it *before* flipping to edit mode, so it is fixed for this editor's whole
    // lifetime and the effect still runs exactly once. Listing it keeps the lint ratchet at 52
    // without an eslint-disable standing in for an argument.
  }, [minHeight]);

  return (
    <textarea
      ref={ref}
      id={id}
      aria-label={label}
      className={`${className} ${styles.box}`}
      defaultValue={value}
      placeholder={placeholder}
      /* Escape abandons the edit. These fields had no way to do that before — they commit on blur
         and Escape did nothing at all — so this is a gain, not just a convenience: the editor is
         uncontrolled, so dropping back to the read view re-renders from `value` and the typing is
         discarded with it. It also means closing the editor can be a no-op, which is what lets
         `interaction-smoke.mjs` exercise this state without a write reaching a backend the
         harness does not run. */
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      onInput={(e) => autoSize(e.currentTarget, minHeight)}
      onBlur={(e) => {
        if (cancelled.current) {
          cancelled.current = false;
          onCancel();
          return;
        }
        onDone(e.target.value);
      }}
    />
  );
}

/**
 * Grows the editor to fit its content, so the box does not change size when the field flips
 * between reading and editing.
 *
 * **This was measured, not assumed, and the naive version was wrong.** A `<textarea>` sizes from
 * its `rows`/`min-height`, while the read view sizes from its content — so on the seeded fixture
 * at 390px, clicking into Concept collapsed 78.4px to 56.0px and Hook 98.6px to 56.0px, jumping
 * everything below up by 16px and 36px. You tap a field and the Secrets list leaps out from under
 * your finger.
 *
 * Neither smoke pass catches this and neither is broken for missing it: both measure a single
 * state for overflow, hit area and overlap, and each state here is individually fine. The bug only
 * exists in the *difference* between two states, which is the kind of thing
 * `responsive-device-qa`'s step 2 exists for.
 *
 * Content-sizing alone did not close it: at 390px the editor still came up 14-19px short, because
 * the textarea wraps its text into fewer lines than the read view does at the same width. So the
 * caller's measured read height is the floor, and this only ever grows past it — as you type, or
 * when the editor's own content genuinely needs more room than the prose did.
 *
 * `height = 'auto'` first is required — without it `scrollHeight` is reported against the current
 * height and the box can only ever grow, never shrink back when text is deleted.
 */
function autoSize(el: HTMLTextAreaElement, minHeight: number | null) {
  el.style.height = 'auto';
  // `scrollHeight` is content + padding and excludes the border, but `.textarea` is
  // `box-sizing: border-box` — so assigning it raw leaves the box exactly its border-width short.
  // `offsetHeight - clientHeight` is that border (plus any horizontal scrollbar), measured rather
  // than hardcoded as 2px so a restyled border cannot silently reintroduce the gap.
  const chrome = el.offsetHeight - el.clientHeight;
  const intrinsic = el.scrollHeight + chrome;
  el.style.height = `${Math.max(intrinsic, minHeight ?? 0)}px`;
}

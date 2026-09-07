import { useState } from 'react';
import styles from './InlineEdit.module.css';

/** Short player-authored text that reads as text until you tap it (WorkPlan-0.40.0 B1).
 *
 *  The sheet used to render every one of these — a Look, a Skill Tag, a Status name, a Motif
 *  name — as a permanently-live `<input>`. That reads as an unfinished form rather than a
 *  character sheet, and it costs real width: the responsive smoke test requires every
 *  `button, a, input, select, textarea` to have a 44x44 hit area on a touch viewport, so a
 *  chip built from "input + remove button" carries two 44px floors and can never be narrower
 *  than ~100px. One control per value instead of two is what lets tags flow several to a row
 *  and lets a Status row fit on one line at 360px.
 *
 *  Note the floor does NOT go away here — this renders a `<button>`, which needs 44x44 on touch
 *  exactly like the input did. The saving is in the count, not the minimum.
 *
 *  Deliberately swaps in place rather than opening a popover: `useTapReveal` (the hook behind
 *  InfoTooltip and GlossaryText's bubbles) is the right tool for revealing *reference* text
 *  anchored to a trigger, but an editor that replaces its own trigger has no anchoring problem
 *  to solve and no outside-click ambiguity — blur already means "done". */
export function InlineEdit({
  value,
  placeholder,
  ariaLabel,
  onCommit,
  onRemove,
  startEditing = false,
  className = '',
  inputClassName = '',
}: {
  value: string;
  placeholder: string;
  ariaLabel: string;
  onCommit: (next: string) => void;
  /** When given, the editing state grows an explicit remove control. Omitted for a value that
   *  always exists (a Status name, a Motif name) — only a list member can be removed. */
  onRemove?: () => void;
  /** Opens straight into the editor. TagList sets this on a tag it has just appended, so adding
   *  is one tap rather than "add, then find the empty chip and tap it". */
  startEditing?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(startEditing);

  if (editing) {
    const field = (
      <input
        // autoFocus is correct here rather than an anti-pattern: the element only mounts as the
        // direct result of the user activating the trigger it replaced, so focus is going
        // somewhere the user just asked for, not stolen on page load.
        autoFocus
        aria-label={ariaLabel}
        className={`${styles.input} ${inputClassName}`}
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => {
          onCommit(e.target.value.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur(); // commits via onBlur, so there's one commit path, not two
          } else if (e.key === 'Escape') {
            e.preventDefault();
            // Restore the original before blurring, so the onBlur commit is a no-op write of the
            // value we started with rather than needing a separate "cancelled" flag.
            e.currentTarget.value = value;
            e.currentTarget.blur();
          }
        }}
      />
    );

    if (!onRemove) return field;
    return (
      <span className={styles.editWrap}>
        {field}
        <button
          type="button"
          className={`tap-inline ${styles.remove}`}
          aria-label={`Remove ${ariaLabel}`}
          /* pointerdown, not click: the input's own blur fires first on a click and would commit
             (and re-render) before the click ever lands on this button, so the remove would be
             swallowed. preventDefault keeps focus on the input so no blur/commit happens at all,
             and the removal is done here rather than in onClick. Keyboard activation produces a
             click with no preceding pointerdown, so onClick still covers that path — and it
             can't double-fire, because the pointer path has already unmounted this element. */
          onPointerDown={(e) => {
            e.preventDefault();
            onRemove();
          }}
          onClick={() => onRemove()}
        >
          &times;
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`tap-inline ${styles.display} ${value ? '' : styles.empty} ${className}`}
      aria-label={`${ariaLabel}: ${value || 'empty'}. Activate to edit.`}
      onClick={() => setEditing(true)}
    >
      {value || placeholder}
    </button>
  );
}

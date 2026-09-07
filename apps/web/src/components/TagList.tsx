import { useState } from 'react';
import { InlineEdit } from './InlineEdit';
import styles from './TagList.module.css';

/** A wrapping row of short authored values with an inline "add" (WorkPlan-0.40.0 B2).
 *
 *  Replaces five separate hand-rolled implementations of the same control — Looks, a Motif's
 *  Skill Tags and Flaw Tags, and the Party's Skill Tags and Weakness Tags — which had drifted
 *  into three different visual treatments (an underlined text link, a dashed-border button, and
 *  a `btnSecondary` uppercase chip for the three "add" affordances alone).
 *
 *  Two layout rules matter and are the reason this is a component rather than a shared class:
 *
 *  1. The add control lives INSIDE the wrap flow, as the last item. Every previous version put it
 *     on a line of its own, which is what made three Looks occupy four rows.
 *  2. Chips are content-sized (`flex: 0 0 auto`), never equal-width cells. `.action-grid`'s
 *     "distribute peers evenly" rule explicitly does not apply to tag rows — layout.css names
 *     them as staying `flex-wrap` — and stretching four chips across a 1500px desktop panel is
 *     just the wide-screen version of the crowding this replaces.
 *
 *  Removal has two paths, both reachable from the one control per chip: clear the text and blur,
 *  or use the explicit remove that appears while editing. An empty value is never stored. */
export function TagList({
  items,
  onChange,
  addLabel,
  placeholder,
  ariaPrefix,
  boardClassName = '',
  chipClassName = '',
  emptyText,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  placeholder: string;
  /** Used to build each chip's accessible name, e.g. "Party Skill Tag 2". */
  ariaPrefix: string;
  /** Appearance decoration for the container (`board`), supplied per call site rather than
   *  hardcoded — see surfaces.css: `.board`/`.posting`/`.tilt` are opt-in per consumer. */
  boardClassName?: string;
  /** Same, for each chip (`posting tilt` on Looks; plain on the denser tag groups). */
  chipClassName?: string;
  emptyText?: string;
}) {
  const [editIndex, setEditIndex] = useState<number | null>(null);

  function commit(i: number, next: string) {
    setEditIndex(null);
    // An empty commit removes rather than storing a blank — which also makes "clear it to delete
    // it" work, and stops an added-then-abandoned chip from sticking around as a ghost.
    onChange(next ? items.map((t, ti) => (ti === i ? next : t)) : items.filter((_, ti) => ti !== i));
  }

  return (
    <div className={`${boardClassName} ${styles.chips}`}>
      {items.length === 0 && emptyText && <span className={styles.empty}>{emptyText}</span>}
      {items.map((tag, i) => (
        <InlineEdit
          /* The value is part of the key so that removing a chip remounts the ones after it
             rather than letting React reuse instances by index — otherwise the removed chip's
             `editing: true` would be inherited by whichever tag shifted into its slot, popping
             open an editor the user never asked for. */
          key={`${i}:${tag}`}
          className={`${styles.chip} ${chipClassName}`}
          value={tag}
          placeholder={placeholder}
          ariaLabel={`${ariaPrefix} ${i + 1}`}
          startEditing={editIndex === i}
          onCommit={(next) => commit(i, next)}
          onRemove={() => {
            setEditIndex(null);
            onChange(items.filter((_, ti) => ti !== i));
          }}
        />
      ))}
      <button
        type="button"
        className={`tap-inline ${styles.add}`}
        onClick={() => {
          // Append, then open that new chip's editor immediately — adding is one tap, not
          // "add, hunt for the empty chip, tap it".
          setEditIndex(items.length);
          onChange([...items, '']);
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}

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
 *  Adding opens a draft chip that exists only in this component until it commits with text in it;
 *  `onChange` never sees it before then. "+ Tag" used to append an empty string through `onChange`
 *  straight away, so every add cost two whole-document saves (the blank, then the text); whenever
 *  the second never happened — the page closed, or it failed mid-deploy — the blank stayed stored
 *  (production Party data held exactly that), and a failed first save's rollback unmounted the
 *  chip the player was typing into. An abandoned or emptied draft now just disappears, having
 *  written nothing.
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
  const [drafting, setDrafting] = useState(false);

  function commit(i: number, next: string) {
    // Opening a chip and leaving it unchanged (or Escaping out) is not an edit — skipping it saves
    // a whole-document write of the value the server already has. Non-empty only: a blank already
    // stored by the old "+ Tag" must still go away when it's opened and left empty.
    if (next && next === items[i]) return;
    // An empty commit removes rather than storing a blank — which also makes "clear it to delete
    // it" work.
    onChange(next ? items.map((t, ti) => (ti === i ? next : t)) : items.filter((_, ti) => ti !== i));
  }

  function commitDraft(next: string) {
    setDrafting(false);
    if (next) onChange([...items, next]);
  }

  return (
    <div className={`${boardClassName} ${styles.chips}`}>
      {items.length === 0 && !drafting && emptyText && <span className={styles.empty}>{emptyText}</span>}
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
          onCommit={(next) => commit(i, next)}
          onRemove={() => onChange(items.filter((_, ti) => ti !== i))}
        />
      ))}
      {drafting && (
        <InlineEdit
          /* Can't collide with the `${i}:${tag}` keys above. Tapping "+ Tag" again while a draft is
             open blurs (and so commits) the draft before the click lands, so a second draft always
             mounts fresh rather than inheriting the first one's typed text. */
          key="draft"
          className={`${styles.chip} ${chipClassName}`}
          value=""
          placeholder={placeholder}
          ariaLabel={`${ariaPrefix} ${items.length + 1}`}
          // Opens straight into the editor — adding is one tap, not "add, then find the chip".
          startEditing
          onCommit={commitDraft}
          onRemove={() => setDrafting(false)}
        />
      )}
      <button type="button" className={`tap-inline ${styles.add}`} onClick={() => setDrafting(true)}>
        {addLabel}
      </button>
    </div>
  );
}

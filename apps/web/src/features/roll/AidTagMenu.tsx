import { useId, useState } from 'react';
import { DisabledHint } from '../../components/DisabledHint.js';
import styles from './AidTagMenu.module.css';

/** Aid (V0.7): invoke one of the Party's unused Skill Tags to give an ally +1. The trigger button is
 *  styled by whichever surface shows it (the sheet's Party panel, a teammate's Combat card); the list
 *  of tags is the same everywhere. `tags` is only the unused ones, so a spent tag is not offered. */
export function AidTagMenu({
  tags,
  disabled = false,
  triggerClassName,
  onAid,
}: {
  tags: string[];
  disabled?: boolean;
  triggerClassName?: string;
  onAid: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const none = tags.length === 0;
  const hintId = useId();
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`tap-inline ${triggerClassName ?? ''}`}
        disabled={disabled || none}
        aria-expanded={open}
        aria-describedby={none ? hintId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Cancel Aid' : 'Aid (use a Party Skill Tag)'}
      </button>
      {none && <DisabledHint id={hintId}>No unused Party Skill Tags — they refresh when the Party Makes Camp.</DisabledHint>}
      {open && !none && (
        <div className={styles.menu}>
          <div className={styles.label}>Describe how you help, then pick a tag:</div>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`tap-inline ${styles.option}`}
              onClick={() => {
                setOpen(false);
                onAid(tag);
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import type { Library, RollBreakdown } from '@asohav/shared';
import { sign } from './rollTags.js';
import styles from './HeroRollBuilder.module.css';

/** Shown until a Virtue is chosen, for rolls with no fixed Virtue ("Invoke Expertise", "Take a
 *  Risk", or a Resist the table hasn't assigned one to yet). */
export function VirtuePicker({ library, onPick }: { library: Library; onPick: (virtueId: string) => void }) {
  return (
    <div className={styles.rollHelper}>
      <div className={styles.label}>Roll 2d6 + which Virtue fits?</div>
      <div className={`tap-row ${styles.virtueRow}`}>
        {library.virtues.map((v) => (
          <button key={v.Id} type="button" className={`tap-inline ${styles.virtueButton}`} onClick={() => onPick(v.Id)}>
            {v.Name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The builder's head: what to roll, the total, and every source that went into it. `onChange` is
 *  present only when the Virtue was picked rather than fixed, so it can be picked again. */
export function VirtueSection({ breakdown, onChange }: { breakdown: RollBreakdown; onChange?: () => void }) {
  return (
    <>
      <div className={styles.label}>
        Roll 2d6 + {breakdown.VirtueName}: <span className={styles.total}>{sign(breakdown.Total)}</span>
        {onChange && (
          <button type="button" className={`tap-inline ${styles.change}`} onClick={onChange}>
            change
          </button>
        )}
      </div>
      <ul className={styles.sources}>
        {breakdown.Sources.map((s, i) => (
          <li key={i}>
            {s.Label} <span className={styles.sourceValue}>{sign(s.Value)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

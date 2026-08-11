import styles from './AdvantageToggle.module.css';

export type AdvantageState = 'Normal' | 'Advantage' | 'Disadvantage';

const OPTIONS: AdvantageState[] = ['Normal', 'Advantage', 'Disadvantage'];

/** Purely informational, per the doc's few Advantage/Disadvantage mentions (Consult the Past with
 *  a book, spending Wealth on Follow a Lead) — this app never rolls dice (see CLAUDE.md's engine
 *  note), so flagging Advantage/Disadvantage doesn't change the computed roll-breakdown total at
 *  all. It's just a reminder of what to physically roll: 3d6 and keep the best two (Advantage) or
 *  worst two (Disadvantage), instead of the usual 2d6. Not persisted — it's a per-roll circumstance,
 *  reset each time this renders fresh. */
export function AdvantageToggle({ value, onChange }: { value: AdvantageState; onChange: (v: AdvantageState) => void }) {
  return (
    <div className={styles.wrap}>
      <div className={`tap-row ${styles.row}`}>
        {OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={`tap-inline ${styles.option} ${value === s ? styles.optionOn : ''}`}
            onClick={() => onChange(s)}
            aria-pressed={value === s}
          >
            {s}
          </button>
        ))}
      </div>
      {value !== 'Normal' && (
        <p className={styles.note}>
          Roll 3d6 and keep the {value === 'Advantage' ? 'best' : 'worst'} two, at the table — the total above doesn't change.
        </p>
      )}
    </div>
  );
}

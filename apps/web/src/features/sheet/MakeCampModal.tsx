import { useState } from 'react';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './MakeCampModal.module.css';

/** Make Camp reduces negative Statuses by 2 Ranks and positive by 1, refreshes Armor/Recoveries,
 *  and lifts the Load lock — all of that already happened with no input needed. The doc also
 *  clears 1d6 Conditions, which needs a choice (which ones), so this modal only covers that piece:
 *  report the d6 you rolled, then pick up to that many currently-marked Conditions to clear. This
 *  app doesn't roll dice (see CLAUDE.md) — same reporting pattern as HealStatusModal. */
export function MakeCampModal({
  markedConditions,
  onApply,
  onClose,
}: {
  markedConditions: { virtueId: string; name: string }[];
  onApply: (clearedVirtueIds: string[]) => void;
  onClose: () => void;
}) {
  const [d6, setD6] = useState(4);
  const [selected, setSelected] = useState<string[]>([]);
  const cap = Math.min(d6, markedConditions.length);

  function toggle(virtueId: string) {
    setSelected((prev) => {
      if (prev.includes(virtueId)) return prev.filter((x) => x !== virtueId);
      if (prev.length >= cap) return prev;
      return [...prev, virtueId];
    });
  }

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="make-camp-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="make-camp-title" className={modal.title}>Make Camp</h2>
          <p className={modal.subtitle}>
            Reduces negative Statuses by 2 Ranks (positive by 1), refreshes Armor and Recoveries, and lifts your Load lock — all applied automatically. It also clears 1d6 Conditions of your choice.
          </p>
        </div>
        <div className={modal.body}>
          {markedConditions.length === 0 ? (
            <p className={styles.empty}>No Conditions marked right now — everything else about Camp still applies.</p>
          ) : (
            <>
              <label className={styles.label} htmlFor="make-camp-d6">d6 you rolled</label>
              <input
                id="make-camp-d6"
                className={styles.input}
                type="number"
                min={1}
                max={6}
                value={d6}
                onChange={(e) => setD6(Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1)))}
              />
              <label className={styles.label} id="make-camp-conditions-label">Clear up to {cap} Condition{cap === 1 ? '' : 's'}</label>
              <div className={styles.conditions} role="group" aria-labelledby="make-camp-conditions-label">
                {markedConditions.map((c) => {
                  const on = selected.includes(c.virtueId);
                  return (
                    <button
                      key={c.virtueId}
                      className={`tap ${styles.condition} ${on ? styles.conditionOn : ''}`}
                      onClick={() => toggle(c.virtueId)}
                      aria-pressed={on}
                      disabled={!on && selected.length >= cap}
                    >
                      <span className={`${styles.checkbox} ${on ? styles.checkboxOn : ''}`} aria-hidden>{on ? '✓' : ''}</span>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <button className={`tap-inline ${styles.confirmAction}`} onClick={() => onApply(selected)}>
            Make Camp
          </button>
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

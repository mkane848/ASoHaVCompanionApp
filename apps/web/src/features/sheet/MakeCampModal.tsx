import { useState } from 'react';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './MakeCampModal.module.css';

/** Make Camp (V0.6 slice 1 rewrite of the mechanic, per `WorkPlan-V0.6.md` Section A2): "clear
 *  one Condition, Recuperate, refresh all Armor." Armor-refresh and lifting the Load lock already
 *  happen automatically with no input needed (`StatusesPanel.tsx`'s `makeCamp()`); this modal
 *  covers the one piece that needs a choice — which single Condition to clear, if any. Recuperate
 *  is its own self-serve action (available any time, not just at Camp), so it isn't forced here —
 *  same "reminder, not automated" treatment `CampActionsModal`'s own Advancement note already
 *  uses. Replaces the old "report a d6, clear up to that many Conditions" flow entirely — V0.6
 *  drops the die roll and the count, down to a flat one. */
export function MakeCampModal({
  markedConditions,
  onApply,
  onClose,
}: {
  markedConditions: { virtueId: string; name: string }[];
  onApply: (clearedVirtueId: string | null) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
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
            Refreshes Armor and lifts your Load lock automatically. Clears one Condition of your choice. Recuperate separately, any time you like.
          </p>
        </div>
        <div className={modal.body}>
          {markedConditions.length === 0 ? (
            <p className={styles.empty}>No Conditions marked right now — everything else about Camp still applies.</p>
          ) : (
            <>
              <label className={styles.label} id="make-camp-conditions-label">Clear one Condition</label>
              <div className={styles.conditions} role="radiogroup" aria-labelledby="make-camp-conditions-label">
                {markedConditions.map((c) => {
                  const on = selected === c.virtueId;
                  return (
                    <button
                      key={c.virtueId}
                      className={`tap ${styles.condition} ${on ? styles.conditionOn : ''}`}
                      onClick={() => setSelected(on ? null : c.virtueId)}
                      role="radio"
                      aria-checked={on}
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

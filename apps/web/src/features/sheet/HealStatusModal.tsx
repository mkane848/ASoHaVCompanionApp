import { useState } from 'react';
import type { CharacterStatus } from '@asohav/shared';
import { healingSurgeAmount, statusRank } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './HealStatusModal.module.css';

/** Healing a Status: spend a Recovery, clear 1d6 + Mettle Ranks off a single Status. This app
 *  doesn't roll dice (see CLAUDE.md) — you report the d6 you rolled physically and it does the
 *  addition and applies the result. */
export function HealStatusModal({
  statuses,
  mettleScore,
  recoveries,
  onApply,
  onClose,
}: {
  statuses: CharacterStatus[];
  mettleScore: number;
  recoveries: number;
  onApply: (statusId: string, amount: number) => void;
  onClose: () => void;
}) {
  const [statusId, setStatusId] = useState(statuses[0]?.Id ?? '');
  // Raw text, not the clamped number, controls the input — see StatusesPanel.tsx's newRankText
  // for why clamping the value itself on every keystroke fights the user mid-edit.
  const [d6Text, setD6Text] = useState('4');
  const parsedD6 = parseInt(d6Text, 10);
  const d6 = Number.isFinite(parsedD6) ? Math.max(1, Math.min(6, parsedD6)) : 1;
  const amount = healingSurgeAmount(d6, mettleScore);
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="heal-status-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="heal-status-title" className={modal.title}>Heal a Status</h2>
          <p className={modal.subtitle}>Spend a Recovery. Clears 1d6 + Mettle Ranks off a single Status.</p>
        </div>
        <div className={modal.body}>
          {statuses.length === 0 ? (
            <p className={styles.empty}>No Statuses to heal right now.</p>
          ) : recoveries <= 0 ? (
            <p className={styles.empty}>No Recoveries left — Make Camp to refresh them.</p>
          ) : (
            <>
              <label className={styles.label} htmlFor="heal-status-select">Which Status?</label>
              <select id="heal-status-select" className={styles.select} value={statusId} onChange={(e) => setStatusId(e.target.value)}>
                {statuses.map((s) => (
                  <option key={s.Id} value={s.Id}>
                    {s.Name} {statusRank(s)}
                  </option>
                ))}
              </select>
              <label className={styles.label} htmlFor="heal-status-d6">d6 you rolled</label>
              <input
                id="heal-status-d6"
                className={styles.input}
                type="number"
                min={1}
                max={6}
                value={d6Text}
                onChange={(e) => setD6Text(e.target.value)}
                onBlur={() => setD6Text(String(d6))}
              />
              <p className={styles.note}>
                {d6} + Mettle ({mettleScore >= 0 ? `+${mettleScore}` : mettleScore}) = clears <strong>{amount}</strong> Rank{amount === 1 ? '' : 's'}. Recoveries left after: {recoveries - 1}.
              </p>
              <button className={`tap-inline ${modal.primaryAction}`} onClick={() => onApply(statusId, amount)}>
                Apply
              </button>
            </>
          )}
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            {statuses.length === 0 || recoveries <= 0 ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

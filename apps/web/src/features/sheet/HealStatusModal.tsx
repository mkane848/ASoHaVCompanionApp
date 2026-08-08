import { useState } from 'react';
import type { CharacterStatus } from '@asohav/shared';
import { healingSurgeAmount } from '@asohav/shared';
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
  const [d6, setD6] = useState(4);
  const amount = healingSurgeAmount(d6, mettleScore);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 className={modal.title}>Heal a Status</h2>
          <p className={modal.subtitle}>Spend a Recovery. Clears 1d6 + Mettle Ranks off a single Status.</p>
        </div>
        <div className={modal.body}>
          {statuses.length === 0 ? (
            <p className={styles.empty}>No Statuses to heal right now.</p>
          ) : recoveries <= 0 ? (
            <p className={styles.empty}>No Recoveries left — Make Camp to refresh them.</p>
          ) : (
            <>
              <label className={styles.label}>Which Status?</label>
              <select className={styles.select} value={statusId} onChange={(e) => setStatusId(e.target.value)}>
                {statuses.map((s) => (
                  <option key={s.Id} value={s.Id}>
                    {s.Name} {s.Rank}
                  </option>
                ))}
              </select>
              <label className={styles.label}>d6 you rolled</label>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={6}
                value={d6}
                onChange={(e) => setD6(Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1)))}
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

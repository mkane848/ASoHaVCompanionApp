import { useState } from 'react';
import { useMisfortune } from '../../lib/useMisfortune.js';
import styles from './MisfortuneCounter.module.css';

/** The GM's Misfortune (revised V0.6, slice 2), shown to everyone — the repo owner's call — with
 *  the GM's three controls. Each control disables while its own request is in flight, so a double
 *  tap can't spend twice. */
export function MisfortuneCounter({
  campaignId,
  misfortune,
  isGM,
  archived,
}: {
  campaignId: string;
  misfortune: number;
  isGM: boolean;
  archived: boolean;
}) {
  const { spend, reset, beginSession } = useMisfortune(campaignId);
  const [spendLoading, setSpendLoading] = useState(false);
  const [beginSessionLoading, setBeginSessionLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSpend() {
    setSpendLoading(true);
    try {
      await spend('A Hard Move');
    } finally {
      setSpendLoading(false);
    }
  }

  async function handleBeginSession() {
    setBeginSessionLoading(true);
    try {
      await beginSession();
    } finally {
      setBeginSessionLoading(false);
    }
  }

  async function handleReset() {
    setResetLoading(true);
    try {
      await reset();
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>Misfortune</h2>
        <div className={styles.rule} />
        <span className={styles.value} aria-live="polite">
          {misfortune}
        </span>
      </div>
      <p className={styles.note}>
        The GM gains one on every 6- and spends it on Hard Moves.
      </p>
      {isGM && (
        <div className={styles.buttons}>
          <button
            type="button"
            className={`tap-inline ${styles.button}`}
            disabled={misfortune === 0 || archived || spendLoading}
            onClick={handleSpend}
          >
            {spendLoading ? 'Spending…' : 'Spend on a Hard Move'}
          </button>
          <button
            type="button"
            className={`tap-inline ${styles.button}`}
            disabled={archived || beginSessionLoading}
            onClick={handleBeginSession}
          >
            {beginSessionLoading ? 'Starting session…' : 'Begin session'}
          </button>
          <button
            type="button"
            className={`tap-inline ${styles.button}`}
            disabled={archived || resetLoading}
            onClick={handleReset}
          >
            {resetLoading ? 'Resetting…' : 'Reset to 1'}
          </button>
          <p className={styles.hint}>Begin session gains 1 only if you have none. An Adventure concluding resets it to 1 by itself.</p>
        </div>
      )}
    </div>
  );
}

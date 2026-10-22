import { lazy, Suspense, useState } from 'react';
import { useDrama } from '../../lib/useDrama.js';
import styles from './DramaCounter.module.css';

const SurrenderModal = lazy(() => import('./SurrenderModal.js').then((m) => ({ default: m.SurrenderModal })));

/** The GM's Drama (revised V0.6, slice 2), shown to everyone — the repo owner's call — with
 *  the GM's three controls. Each control disables while its own request is in flight, so a double
 *  tap can't spend twice. `compact` is the one-line form for Combat's header (slice 6): the count
 *  and the Spend, which is what the GM reaches for mid-fight; starting a session and resetting stay
 *  on the Campaign page. */
export function DramaCounter({
  campaignId,
  drama,
  isGM,
  archived,
  compact = false,
}: {
  campaignId: string;
  drama: number;
  isGM: boolean;
  archived: boolean;
  compact?: boolean;
}) {
  const { spend, reset, beginSession } = useDrama(campaignId);
  const [spendLoading, setSpendLoading] = useState(false);
  const [beginSessionLoading, setBeginSessionLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [surrendering, setSurrendering] = useState(false);

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

  const modal = surrendering ? (
    <Suspense fallback={null}>
      <SurrenderModal campaignId={campaignId} drama={drama} onClose={() => setSurrendering(false)} />
    </Suspense>
  ) : null;

  if (compact) {
    return (
      <div className={`${styles.card} ${styles.compact}`}>
        <span className={styles.compactLabel}>Drama</span>
        <span className={styles.value} aria-live="polite">
          {drama}
        </span>
        {isGM && (
          <button
            type="button"
            className={`tap-inline ${styles.button}`}
            disabled={drama === 0 || archived || spendLoading}
            onClick={handleSpend}
          >
            {spendLoading ? 'Spending…' : 'Spend on a Hard Move'}
          </button>
        )}
        {isGM && (
          <button type="button" className={`tap-inline ${styles.button}`} disabled={archived} onClick={() => setSurrendering(true)}>
            Record Surrender&hellip;
          </button>
        )}
        {modal}
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>Drama</h2>
        <div className={styles.rule} />
        <span className={styles.value} aria-live="polite">
          {drama}
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
            disabled={drama === 0 || archived || spendLoading}
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
          <button type="button" className={`tap-inline ${styles.button}`} disabled={archived} onClick={() => setSurrendering(true)}>
            Record Surrender&hellip;
          </button>
          <p className={styles.hint}>Begin session gains 1 only if you have none. An Adventure concluding resets it to 1 by itself.</p>
        </div>
      )}
      {modal}
    </div>
  );
}

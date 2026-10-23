import styles from './LoadFailed.module.css';

/** Shown in place of "Loading…" when a page's data query has failed, so the page never spins
 *  forever with no message and no way out. */
export function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className={styles.wrap} role="alert">
      <p className={styles.message}>Couldn&apos;t load {what}. Check your connection and try again.</p>
      <button className={`tap-inline ${styles.retry}`} onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

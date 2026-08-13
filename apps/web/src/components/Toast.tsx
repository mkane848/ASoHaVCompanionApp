import { useEffect } from 'react';
import styles from './Toast.module.css';

const AUTO_DISMISS_MS = 6000;

/** A transient banner, fixed to the bottom of the viewport and auto-dismissing — for events a
 *  user could otherwise miss (a stalled request timing out well after they've looked away from
 *  an inline error message; a live update from another player). Controlled: renders nothing when
 *  `message` is null. `tone` defaults to 'error' (the only kind this component raised before
 *  0.23.0) — `role="alert"` and danger styling. 'status' is for a neutral announcement that isn't
 *  a failure (e.g. Combat starting): `role="status"` so assistive tech doesn't announce it with
 *  the same urgency as an actual error, and a tone that doesn't read as something having gone
 *  wrong. */
export function Toast({ message, tone = 'error', onDismiss }: { message: string | null; tone?: 'error' | 'status'; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className={`${styles.wrap} ${tone === 'status' ? styles.statusTone : ''}`} role={tone === 'status' ? 'status' : 'alert'}>
      <span className={styles.message}>{message}</span>
      <button type="button" className={`tap ${styles.dismiss}`} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

import { useEffect } from 'react';
import styles from './Toast.module.css';

const AUTO_DISMISS_MS = 6000;

/** A transient error banner, fixed to the bottom of the viewport and auto-dismissing — for
 *  failures a user could otherwise miss (a stalled request timing out well after they've looked
 *  away from an inline error message). Controlled: renders nothing when `message` is null. */
export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className={styles.wrap} role="alert">
      <span className={styles.message}>{message}</span>
      <button type="button" className={`tap ${styles.dismiss}`} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

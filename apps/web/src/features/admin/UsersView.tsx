import { useState } from 'react';
import type { AdminUserRow } from '@asohav/shared';
import shared from './adminShared.module.css';
import styles from './UsersView.module.css';

/** Account management: list Supabase Auth users joined with their `profiles` row, and trigger a
 * password reset. There's no outbound email configured for this app (see README's Auth note), so
 * "reset" doesn't send anything itself — it generates a one-time recovery link the admin copies
 * and relays to the account holder. Deliberately no way to type or set a password directly here. */
export function UsersView({ users, onResetPassword }: { users: AdminUserRow[]; onResetPassword: (id: string) => Promise<string> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<{ id: string; link: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reset(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const link = await onResetPassword(id);
      setLinkFor({ id, link });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a reset link.');
    } finally {
      setBusyId(null);
    }
  }

  function copyLink(link: string) {
    navigator.clipboard?.writeText(link).catch(() => {});
  }

  return (
    <div>
      <h2 className={shared.viewTitle}>Users</h2>
      <p className={shared.viewIntro}>
        Every account, from Supabase Auth. Passwords can't be set here — "Reset password" generates a one-time recovery link to relay to the account holder.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.list}>
        {users.map((u) => (
          <div key={u.Id} className={styles.row}>
            <div className={styles.identity}>
              <span className={styles.name}>{u.Name}</span>
              {u.IsAdmin && <span className={styles.adminBadge}>Content admin</span>}
              <span className={`wrap-anywhere ${styles.email}`}>{u.Email}</span>
              <span className={styles.meta}>
                Last sign-in: {u.LastSignInAt ? new Date(u.LastSignInAt).toLocaleString() : 'never'}
              </span>
            </div>
            <button className={`tap-inline ${styles.resetButton}`} disabled={busyId === u.Id} onClick={() => reset(u.Id)}>
              {busyId === u.Id ? 'Generating…' : 'Reset password'}
            </button>
            {linkFor?.id === u.Id && (
              <div className={styles.linkBox}>
                <span className={`wrap-anywhere ${styles.linkText}`}>{linkFor.link}</span>
                <button className={`tap-inline ${styles.copyButton}`} onClick={() => copyLink(linkFor.link)}>
                  Copy
                </button>
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && <p className={styles.empty}>No accounts yet.</p>}
      </div>
    </div>
  );
}

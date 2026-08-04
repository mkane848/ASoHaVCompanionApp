import { useState } from 'react';
import type { AdminCampaignRow } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import shared from './adminShared.module.css';
import styles from './PlayDataAdminView.module.css';

/** Content-admin-only campaign deletion — cascades characters, sheets, memberships, party, bonds,
 * and invites (see supabase/migrations/0001_init.sql). Distinct from a GM archiving their own
 * campaign (label-only, no data loss); this is destructive and irreversible. */
export function CampaignsAdminView({ campaigns, onDelete }: { campaigns: AdminCampaignRow[]; onDelete: (id: string) => Promise<void> }) {
  const [pending, setPending] = useState<AdminCampaignRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(pending.Id);
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that campaign.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className={shared.viewTitle}>Campaigns</h2>
      <p className={shared.viewIntro}>
        Every campaign, across every GM. Deleting one is permanent — it takes every character, sheet, and Bond in it with it.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.list}>
        {campaigns.map((c) => (
          <div key={c.Id} className={styles.row}>
            <div className={styles.identity}>
              <span className={styles.name}>{c.Name}</span>
              <span className={styles.meta}>
                GM: {c.GmName} &middot; {c.MemberCount} member{c.MemberCount === 1 ? '' : 's'} &middot; created {new Date(c.CreatedAt).toLocaleDateString()}
              </span>
            </div>
            <button className={`tap-inline ${styles.deleteButton}`} onClick={() => setPending(c)}>
              Delete
            </button>
          </div>
        ))}
        {campaigns.length === 0 && <p className={styles.empty}>No campaigns yet.</p>}
      </div>

      {pending && (
        <ConfirmModal
          title={`Delete "${pending.Name}"?`}
          body="This permanently removes the campaign and every character, sheet, party, Bond, and invite in it. There is no undo."
          confirmLabel={busy ? 'Deleting…' : 'Delete campaign'}
          onConfirm={confirmDelete}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import type { AdminCharacterRow } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import shared from './adminShared.module.css';
import styles from './PlayDataAdminView.module.css';

/** Content-admin-only character deletion — cascades the character's sheet and any Bonds it's
 * part of; the owning player's campaign membership survives (CharacterId just goes null again),
 * same as if they'd never made one. */
export function CharactersAdminView({ characters, onDelete }: { characters: AdminCharacterRow[]; onDelete: (campaignId: string, characterId: string) => Promise<void> }) {
  const [pending, setPending] = useState<AdminCharacterRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(pending.CampaignId, pending.Id);
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that character.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className={shared.viewTitle}>Character Sheets</h2>
      <p className={shared.viewIntro}>
        Every character, across every campaign. Deleting one removes its sheet and any Bonds it's part of; the player keeps their campaign membership.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.list}>
        {characters.map((c) => (
          <div key={c.Id} className={styles.row}>
            <div className={styles.identity}>
              <span className={styles.name}>{c.Name}</span>
              <span className={styles.meta}>
                Played by {c.PlayerName} &middot; {c.CampaignName}
              </span>
            </div>
            <button className={`tap-inline ${styles.deleteButton}`} onClick={() => setPending(c)}>
              Delete
            </button>
          </div>
        ))}
        {characters.length === 0 && <p className={styles.empty}>No characters yet.</p>}
      </div>

      {pending && (
        <ConfirmModal
          title={`Delete "${pending.Name}"?`}
          body="This permanently removes the character and its sheet. There is no undo."
          confirmLabel={busy ? 'Deleting…' : 'Delete character'}
          onConfirm={confirmDelete}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useDrama } from '../../lib/useDrama.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { useToastStore } from '../../store/toastStore.js';
import modal from '../../styles/modal.module.css';
import { backdropClose } from '../../lib/backdropClose.js';

/** GM-only "Record Surrender" (V0.7 slice 8c, Ruleset-V0.7.md L654-656): "At any point in a scene or
 *  Combat, the Party may decide to be placed at the mercy of their enemies or their environment. The GM
 *  may spend a Drama to take a Hard Move that may result in death, capture, or new and dire stakes."
 *  Step one logs it (Combat log if a fight is Active, else the Party history). Step two offers an
 *  optional Spend 1 Drama through the existing Drama route. Nothing is forced and nothing else is
 *  automated; the Hard Move itself is the table's. */
export function SurrenderModal({ campaignId, drama, onClose }: { campaignId: string; drama: number; onClose: () => void }) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  const { spend } = useDrama(campaignId);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [spent, setSpent] = useState(false);

  async function record() {
    setBusy(true);
    try {
      await api.party.surrender(campaignId, { Note: note.trim() || undefined });
      setRecorded(true);
      // The entry is in the Combat log or Party history; refetch so both views show it.
      void qc.invalidateQueries({ queryKey: ['bootstrap', campaignId] });
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : "Couldn't record that — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function spendOne() {
    setBusy(true);
    try {
      await spend('The Party surrendered: a Hard Move');
      setSpent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={modal.backdrop} {...backdropClose(onClose)}>
      <div ref={dialogRef} className={modal.dialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="surrender-title" tabIndex={-1}>
        <div className={modal.head}>
          <h2 id="surrender-title" className={modal.title}>The Party surrenders</h2>
          <p className={modal.subtitle}>They place themselves at the mercy of their enemies or their environment.</p>
        </div>
        <div className={modal.body}>
          {!recorded ? (
            <>
              <label htmlFor="surrender-note">What happened? (optional)</label>
              <textarea id="surrender-note" className={modal.textarea} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              <button className={`tap-inline ${modal.primaryAction}`} disabled={busy} onClick={() => void record()}>
                Record Surrender
              </button>
            </>
          ) : (
            <>
              <p>Recorded in the log. You may spend 1 Drama to take a Hard Move that could mean death, capture, or new and dire stakes. It is optional, and nothing else happens automatically.</p>
              {spent ? (
                <p>1 Drama spent.</p>
              ) : (
                <button className={`tap-inline ${modal.primaryAction}`} disabled={busy || drama === 0} onClick={() => void spendOne()}>
                  {drama === 0 ? 'No Drama to spend' : 'Spend 1 Drama'}
                </button>
              )}
            </>
          )}
          <button className={`tap-inline ${modal.secondaryAction}`} onClick={onClose}>
            {recorded ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useModalA11y } from '../lib/useModalA11y.js';
import modal from '../styles/modal.module.css';
import styles from './MarkBondModal.module.css';

/** Collects the player's own reason for a Bond rank-up, rather than sending a canned note —
 *  the partner reads this when they confirm the proposal. Used from both the Campaign Shell
 *  (CampaignBonds.tsx) and the sheet's Bond section (AdvancementPanel.tsx). */
export function MarkBondModal({ partnerName, onSubmit, onClose }: { partnerName: string; onSubmit: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-bond-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="mark-bond-title" className={modal.title}>Mark Bond</h2>
          <p className={modal.subtitle}>What happened between you and {partnerName}? They'll read this when they confirm.</p>
        </div>
        <div className={modal.body}>
          <textarea
            className={modal.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What changed between you two…"
          />
          <button className={`tap-inline ${modal.primaryAction}`} disabled={!trimmed} onClick={() => { if (trimmed) onSubmit(trimmed); }}>
            Propose +1 Bond
          </button>
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

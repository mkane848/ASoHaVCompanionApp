import { useState } from 'react';
import modal from '../styles/modal.module.css';
import styles from './MarkKinModal.module.css';

/** Collects the player's own reason for a Kin rank-up, rather than sending a canned note —
 *  the partner reads this when they confirm the proposal. Used from both the Campaign Shell
 *  (CampaignBonds.tsx) and the sheet's Kin & Bonds section (AdvancementPanel.tsx). */
export function MarkKinModal({ partnerName, onSubmit, onClose }: { partnerName: string; onSubmit: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 className={modal.title}>Mark Kin</h2>
          <p className={modal.subtitle}>What happened between you and {partnerName}? They'll read this when they confirm.</p>
        </div>
        <div className={modal.body}>
          <textarea
            className={modal.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What changed between you two…"
            autoFocus
          />
          <button className={`tap-inline ${modal.primaryAction}`} disabled={!trimmed} onClick={() => { if (trimmed) onSubmit(trimmed); }}>
            Propose +1 Kin
          </button>
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

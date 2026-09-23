import { useState } from 'react';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './ForgeBondModal.module.css';

/** Forge a Bond (revised V0.6 slice 5): "reducing your Bond Track by 5 and then Gain a Connection
 *  Improvement. You may then rewrite or update your Connection Tag." The one Forge dialog — the
 *  Campaign page's Bonds and the sheet's Connections both open it (WP 5E merges the sheet's old
 *  `ForgeBondPicker` into it). `onSubmit` gets the Improvement and the rewritten tag, or null to
 *  keep `currentTag`. */
export interface ForgeBondModalProps {
  partnerName: string;
  currentTag: string;
  onSubmit: (improvement: string, newTag: string | null) => void;
  onClose: () => void;
}

export function ForgeBondModal({ partnerName, currentTag, onSubmit, onClose }: ForgeBondModalProps) {
  void currentTag;
  const [text, setText] = useState('');
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  return (
    <div className={modal.backdrop}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forge-bond-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="forge-bond-title" className={modal.title}>Forge a Bond</h2>
          <p className={modal.subtitle}>
            You and {partnerName} write this move together. Both of you must agree to the wording.
          </p>
        </div>
        <div className={modal.body}>
          <textarea
            className={modal.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Write the move the two of you have earned — what it triggers on, and what it does…"
          />
          <button className={`tap-inline ${modal.primaryAction}`} onClick={() => { const t = text.trim(); if (t) onSubmit(t, null); }}>
            Propose the Forge
          </button>
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

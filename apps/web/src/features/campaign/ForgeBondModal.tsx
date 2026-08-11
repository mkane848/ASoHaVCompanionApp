import { useState } from 'react';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './ForgeBondModal.module.css';

export function ForgeBondModal({ partnerName, onSubmit, onClose }: { partnerName: string; onSubmit: (text: string) => void; onClose: () => void }) {
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
          <button className={`tap-inline ${modal.primaryAction}`} onClick={() => { const t = text.trim(); if (t) onSubmit(t); }}>
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

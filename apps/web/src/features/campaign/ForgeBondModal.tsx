import { useState } from 'react';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './ForgeBondModal.module.css';

/** Forge a Bond (revised V0.6 slice 5): "reducing your Bond Track by 5 and then Gain a Connection
 *  Improvement. You may then rewrite or update your Connection Tag." The one Forge dialog — the
 *  Campaign page's Bonds and the sheet's Connections both open it (the sheet's own copy,
 *  `ForgeBondPicker`, was retired in slice 5). `onSubmit` gets the Improvement and the rewritten
 *  tag, or null to keep `currentTag`. The limits match what `routes/bond.ts` accepts. */
export interface ForgeBondModalProps {
  partnerName: string;
  currentTag: string;
  onSubmit: (improvement: string, newTag: string | null) => void;
  onClose: () => void;
}

export function ForgeBondModal({ partnerName, currentTag, onSubmit, onClose }: ForgeBondModalProps) {
  const [improvement, setImprovement] = useState('');
  const [tagInput, setTagInput] = useState(currentTag);
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  const handleSubmit = () => {
    const imp = improvement.trim();
    if (!imp) return;
    const newTag = tagInput.trim();
    const finalTag = newTag && newTag !== currentTag ? newTag : null;
    onSubmit(imp, finalTag);
  };

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
            You and {partnerName} reduce your Bond Track by 5 and gain a Connection Improvement. Both of you must agree.
          </p>
        </div>
        <div className={modal.body}>
          <div className={styles.field}>
            <label htmlFor="forge-improvement" className={styles.label}>Connection Improvement</label>
            <textarea
              id="forge-improvement"
              className={modal.textarea}
              value={improvement}
              onChange={(e) => setImprovement(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="What your Connection gives you now — write it together"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="forge-tag" className={styles.label}>Connection Tag</label>
            <p className={styles.tagInfo}>Current: {currentTag ? `"${currentTag}"` : 'none yet'}</p>
            <input
              id="forge-tag"
              type="text"
              className={`tap-inline ${styles.tagInput}`}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              maxLength={80}
              placeholder="Rewrite your Connection Tag (optional)"
            />
          </div>

          <button className={`tap-inline ${modal.primaryAction}`} onClick={handleSubmit} disabled={!improvement.trim()}>
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

import { useState } from 'react';
import type { PickerState } from './pickerTypes.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './ForgeBondPicker.module.css';

/** The Forge-a-Bond text writer — all that's left of `AdvancementPicker.tsx` after slice 4
 *  retired the party Rapport-track picker (see `pickerTypes.ts`'s doc comment). Renamed to match:
 *  this is the one thing `PickerState` still opens a modal for. */
export function ForgeBondPicker({
  picker,
  onProposeForge,
  onClose,
}: {
  picker: PickerState;
  onProposeForge: (bondId: string, text: string) => void;
  onClose: () => void;
}) {
  const [bondText, setBondText] = useState('');

  function handleClose() {
    setBondText('');
    onClose();
  }
  const dialogRef = useModalA11y<HTMLDivElement>(() => handleClose());

  if (!picker) return null;

  return (
    <div className={modal.backdrop}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forge-bond-picker-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="forge-bond-picker-title" className={modal.title}>Forge a Bond</h2>
          <p className={modal.subtitle}>You and {picker.partnerName} write this move together. Both of you must agree to the wording.</p>
        </div>
        <div className={modal.body}>
          <textarea
            className={modal.textarea}
            value={bondText}
            onChange={(e) => setBondText(e.target.value)}
            rows={4}
            placeholder="Write the move the two of you have earned — what it triggers on, and what it does…"
          />
          <button
            className={`tap-inline ${modal.primaryAction}`}
            onClick={() => {
              const text = bondText.trim();
              if (!text) return;
              onProposeForge(picker.bondId, text);
              setBondText('');
            }}
          >
            Propose the Forge
          </button>
        </div>
      </div>
    </div>
  );
}

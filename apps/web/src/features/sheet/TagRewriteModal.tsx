import { useId, useState } from 'react';
import type { CharacterSheet } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './MotifPanel.module.css';

/** The optional "rewrite or update any one of your Skill or Flaw Tags" step after a Motif Advance.
 *  Lazy-loaded by `MotifPanel`, like the Quest dialogs, to keep it off the sheet's first load. */
export function TagRewriteModal({
  motif,
  onClose,
  onRewrite,
}: {
  motif: CharacterSheet['Motifs'][number];
  onClose: () => void;
  onRewrite: (kind: 'Skill' | 'Flaw', index: number, text: string) => void;
}) {
  const allTags: Array<{ kind: 'Skill' | 'Flaw'; index: number; text: string }> = [
    ...motif.SkillTags.map((t, i) => ({ kind: 'Skill' as const, index: i, text: t })),
    ...motif.FlawTags.map((t, i) => ({ kind: 'Flaw' as const, index: i, text: t })),
  ];

  const [pickedIndex, setPickedIndex] = useState(0);
  const [newText, setNewText] = useState(allTags.length > 0 ? allTags[0].text : '');
  const dialogIdRewrite = useId();
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  function handleRewrite() {
    const picked = allTags[pickedIndex];
    onRewrite(picked.kind, picked.index, newText);
  }

  const isComplete = newText.trim();

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogIdRewrite}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={modal.head}>
          <h2 id={dialogIdRewrite} className={modal.title}>
            Rewrite a Tag
          </h2>
          <p className={modal.subtitle}>Then you may rewrite or update any one of your Skill or Flaw Tags for this Motif to better reflect your Hero as they are now.</p>
        </div>
        <div className={modal.body}>
          <div className={styles.tagPicker}>
            {allTags.map((tag, i) => (
              <button
                key={i}
                type="button"
                className={`tap-inline ${styles.tagButton}`}
                aria-pressed={pickedIndex === i}
                onClick={() => {
                  setPickedIndex(i);
                  setNewText(tag.text);
                }}
              >
                <span className={styles.tagKind}>{tag.kind}</span>
                <span>{tag.text}</span>
              </button>
            ))}
          </div>

          <input
            type="text"
            className={`tap-inline ${styles.advanceInput}`}
            value={newText}
            aria-label="Rewritten tag"
            placeholder="Rewrite this tag…"
            onChange={(e) => setNewText(e.target.value)}
          />

          <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={!isComplete} onClick={handleRewrite}>
            Rewrite
          </button>
          <button type="button" className={`tap-inline ${modal.secondaryAction}`} onClick={onClose}>
            Keep my tags
          </button>
        </div>
      </div>
    </div>
  );
}

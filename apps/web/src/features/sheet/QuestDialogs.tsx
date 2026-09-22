import { useState } from 'react';
import type { QuestAbandonInput, QuestCompletionChoices } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import modal from '../../styles/modal.module.css';
import styles from './QuestProgress.module.css';

/** The two Quest procedures' dialogs, split from `QuestProgress` and lazy-loaded by it: they open a
 *  handful of times per campaign, and the sheet's first load is what the bundle budget measures. */

export function QuestCompletionDialog({
  dialogId,
  currentName,
  skillTags,
  flawTags,
  progressLabel,
  onComplete,
  onClose,
}: {
  dialogId: string;
  currentName: string;
  skillTags: string[];
  flawTags: string[];
  progressLabel: 'Potential' | 'Rapport';
  onComplete: (choices: QuestCompletionChoices) => void;
  onClose: () => void;
}) {
  const [fillProgress, setFillProgress] = useState(false);
  const [newName, setNewName] = useState(currentName);
  const [newSkillTags, setNewSkillTags] = useState<string[]>(skillTags);
  const [newFlawTags, setNewFlawTags] = useState<string[]>(flawTags);
  const [newQuest, setNewQuest] = useState('');
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  function handleApply() {
    onComplete({
      FillProgress: fillProgress,
      NewName: newName !== currentName ? newName : undefined,
      SkillTags: newSkillTags,
      FlawTags: newFlawTags,
      NewQuest: newQuest,
    });
  }

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.completionDialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={modal.head}>
          <h2 id={dialogId} className={modal.title}>
            Quest complete
          </h2>
          <p className={modal.subtitle}>You've marked all the Act Breaks. Choose what changes.</p>
        </div>
        <div className={modal.body}>
          <CheckboxRow checked={fillProgress} onToggle={() => setFillProgress((v) => !v)}>
            Mark {progressLabel} to full and advance now
          </CheckboxRow>

          <div className={styles.inputGroup}>
            <div className={styles.inputLabel}>New title</div>
            <input
              type="text"
              className={`tap-inline ${styles.dialogInput}`}
              aria-label="New title"
              value={newName}
              placeholder={currentName || 'Untitled'}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div className={styles.tagsSection}>
            <div className={styles.inputLabel}>Skill Tags</div>
            <div className={styles.tagInputs}>
              {skillTags.map((tag, i) => (
                <input
                  key={i}
                  type="text"
                  className={`tap-inline ${styles.dialogInput}`}
                  aria-label={`Skill Tag ${i + 1}`}
                  defaultValue={tag}
                  placeholder={`Skill Tag ${i + 1}`}
                  onChange={(e) => {
                    const updated = [...newSkillTags];
                    updated[i] = e.target.value;
                    setNewSkillTags(updated);
                  }}
                />
              ))}
            </div>
          </div>

          <div className={styles.tagsSection}>
            <div className={styles.inputLabel}>Flaw Tags</div>
            <div className={styles.tagInputs}>
              {flawTags.map((tag, i) => (
                <input
                  key={i}
                  type="text"
                  className={`tap-inline ${styles.dialogInput}`}
                  aria-label={`Flaw Tag ${i + 1}`}
                  defaultValue={tag}
                  placeholder={`Flaw Tag ${i + 1}`}
                  onChange={(e) => {
                    const updated = [...newFlawTags];
                    updated[i] = e.target.value;
                    setNewFlawTags(updated);
                  }}
                />
              ))}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.inputLabel}>Revise or write a new Quest</div>
            <input
              type="text"
              className={`tap-inline ${styles.dialogInput}`}
              aria-label="Revise or write a new Quest"
              placeholder="Leave blank to keep the current Quest"
              value={newQuest}
              onChange={(e) => setNewQuest(e.target.value)}
            />
          </div>

          <button type="button" className={`tap-inline ${modal.primaryAction}`} onClick={handleApply}>
            Apply
          </button>
          <button type="button" className={`tap-inline ${modal.secondaryAction}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function QuestAbandonmentDialog({
  dialogId,
  currentName,
  actBreaks,
  forsakes,
  progressLabel,
  onAbandon,
  onClose,
}: {
  dialogId: string;
  currentName: string;
  actBreaks: number;
  forsakes: number;
  progressLabel: 'Potential' | 'Rapport';
  onAbandon: (input: QuestAbandonInput) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [skillTag, setSkillTag] = useState('');
  const [flawTag, setFlawTag] = useState('');
  const [newQuest, setNewQuest] = useState('');
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  const isComplete = newName.trim() && skillTag.trim() && flawTag.trim() && newQuest.trim();
  const totalProgress = actBreaks + forsakes;

  function handleRewrite() {
    if (!isComplete) return;
    onAbandon({
      NewName: newName.trim(),
      SkillTag: skillTag.trim(),
      FlawTag: flawTag.trim(),
      NewQuest: newQuest.trim(),
    });
  }

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.abandonmentDialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={modal.head}>
          <h2 id={dialogId} className={modal.title}>
            Quest abandoned
          </h2>
          <p className={modal.subtitle}>You've marked three Forsakes. Rewrite this Motif from the ground up.</p>
        </div>
        <div className={modal.body}>
          <div className={styles.inputGroup}>
            <div className={styles.inputLabel}>New title</div>
            <input
              type="text"
              className={`tap-inline ${styles.dialogInput}`}
              aria-label="New title"
              placeholder={currentName || 'Untitled'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.inputLabel}>One new Skill Tag</div>
            <input
              type="text"
              className={`tap-inline ${styles.dialogInput}`}
              aria-label="One new Skill Tag"
              placeholder="Write a tag…"
              value={skillTag}
              onChange={(e) => setSkillTag(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.inputLabel}>One new Flaw Tag</div>
            <input
              type="text"
              className={`tap-inline ${styles.dialogInput}`}
              aria-label="One new Flaw Tag"
              placeholder="Write a tag…"
              value={flawTag}
              onChange={(e) => setFlawTag(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.inputLabel}>A new Quest</div>
            <input
              type="text"
              className={`tap-inline ${styles.dialogInput}`}
              aria-label="A new Quest"
              placeholder="A short sentence…"
              value={newQuest}
              onChange={(e) => setNewQuest(e.target.value)}
            />
          </div>

          <p className={styles.progressInfo}>
            Adds {totalProgress} {progressLabel}.
          </p>

          <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={!isComplete} onClick={handleRewrite}>
            Rewrite this Motif
          </button>
          <button type="button" className={`tap-inline ${modal.secondaryAction}`} onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

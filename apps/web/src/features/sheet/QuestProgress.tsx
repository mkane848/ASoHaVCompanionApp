import { useId, useState } from 'react';
import type { QuestAbandonInput, QuestCompletionChoices } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import modal from '../../styles/modal.module.css';
import styles from './QuestProgress.module.css';
import typography from '../../styles/typography.module.css';
import { TrackStepper } from './TrackStepper.js';

/** Steps a Quest through its three Act Breaks and three Forsakes and runs the completion or
 *  abandonment procedure when either reaches three (Ruleset-V0.6.md, "Hero Motif Advancement —
 *  Quests"; the Party Quest uses the same procedures, "Party Advancement — Quests"). Generic over
 *  who holds the Quest so slice 4 can reuse it for the Party: the caller owns the data and the
 *  progress track, and applies each callback through its own commit path. */
export interface QuestProgressProps {
  quest: string;
  actBreaks: number;
  forsakes: number;
  /** The holder's current title — a Motif's name, or the Party Motif — offered as the default when
   *  the procedure asks for a new one. */
  currentName: string;
  skillTags: string[];
  flawTags: string[];
  /** "Potential" for a Hero's Motif, "Rapport" for the Party — only used in labels. */
  progressLabel: 'Potential' | 'Rapport';
  /** The Quest text itself, edited in place. */
  onQuestChange: (quest: string) => void;
  /** Set counts rather than "mark one", so a mis-tap can be stepped back like every other track on
   *  the sheet. Reaching 3 is what opens the completion or abandonment procedure. */
  onSetActBreaks: (n: number) => void;
  onSetForsakes: (n: number) => void;
  onComplete: (choices: QuestCompletionChoices) => void;
  onAbandon: (input: QuestAbandonInput) => void;
  readOnly?: boolean;
}

export function QuestProgress({
  quest,
  actBreaks,
  forsakes,
  currentName,
  skillTags,
  flawTags,
  progressLabel,
  onQuestChange,
  onSetActBreaks,
  onSetForsakes,
  onComplete,
  onAbandon,
  readOnly,
}: QuestProgressProps) {
  const [showingCompletion, setShowingCompletion] = useState(false);
  const [showingAbandonment, setShowingAbandonment] = useState(false);
  const dialogIdCompletion = useId();
  const dialogIdAbandonment = useId();

  function handleSetActBreaks(n: number) {
    onSetActBreaks(n);
    if (n === 3 && !readOnly) {
      setShowingCompletion(true);
    }
  }

  function handleSetForsakes(n: number) {
    onSetForsakes(n);
    if (n === 3 && !readOnly) {
      setShowingAbandonment(true);
    }
  }

  if (readOnly) {
    return (
      <div className={styles.questBlock}>
        <div className={typography.label}>Quest</div>
        <div className={styles.questReadonly}>{quest || '—'}</div>
        <div className={styles.tracksRow}>
          <div className={styles.trackReadonly}>
            <span className={styles.trackLabel}>Act Breaks</span>
            <span>{actBreaks}/3</span>
          </div>
          <div className={styles.trackReadonly}>
            <span className={styles.trackLabel}>Forsakes</span>
            <span>{forsakes}/3</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.questBlock}>
      <div className={typography.label}>Quest</div>
      <input
        key={quest}
        aria-label={`Quest — ${currentName || 'untitled'}`}
        className={`tap-inline ${styles.questInput}`}
        defaultValue={quest}
        placeholder="A short sentence…"
        onBlur={(e) => onQuestChange(e.target.value.trim())}
      />
      <div className={styles.tracksRow}>
        <TrackStepper
          label="Act Breaks"
          value={actBreaks}
          max={3}
          color="var(--gold-dark)"
          onSet={handleSetActBreaks}
        />
        <TrackStepper
          label="Forsakes"
          value={forsakes}
          max={3}
          color="var(--danger)"
          onSet={handleSetForsakes}
        />
      </div>

      {actBreaks === 3 && (
        <button type="button" className={`tap-inline ${styles.readyBadge}`} onClick={() => setShowingCompletion(true)}>
          Quest complete — choose what changes
        </button>
      )}

      {forsakes === 3 && (
        <button type="button" className={`tap-inline ${styles.readyBadge}`} onClick={() => setShowingAbandonment(true)}>
          Quest abandoned — rewrite this Motif
        </button>
      )}

      {showingCompletion && (
        <QuestCompletionDialog
          dialogId={dialogIdCompletion}
          currentName={currentName}
          skillTags={skillTags}
          flawTags={flawTags}
          progressLabel={progressLabel}
          onComplete={(choices) => {
            onComplete(choices);
            setShowingCompletion(false);
          }}
          onClose={() => setShowingCompletion(false)}
        />
      )}

      {showingAbandonment && (
        <QuestAbandonmentDialog
          dialogId={dialogIdAbandonment}
          currentName={currentName}
          actBreaks={actBreaks}
          forsakes={forsakes}
          progressLabel={progressLabel}
          onAbandon={(input) => {
            onAbandon(input);
            setShowingAbandonment(false);
          }}
          onClose={() => setShowingAbandonment(false)}
        />
      )}
    </div>
  );
}

function QuestCompletionDialog({
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

function QuestAbandonmentDialog({
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

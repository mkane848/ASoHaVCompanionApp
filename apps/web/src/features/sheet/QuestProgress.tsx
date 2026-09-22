import { lazy, Suspense, useId, useState } from 'react';
import type { QuestAbandonInput, QuestCompletionChoices } from '@asohav/shared';
import styles from './QuestProgress.module.css';
import typography from '../../styles/typography.module.css';
import { TrackStepper } from './TrackStepper.js';

const QuestCompletionDialog = lazy(() => import('./QuestDialogs.js').then((m) => ({ default: m.QuestCompletionDialog })));
const QuestAbandonmentDialog = lazy(() => import('./QuestDialogs.js').then((m) => ({ default: m.QuestAbandonmentDialog })));

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

      <Suspense fallback={null}>
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
      </Suspense>
    </div>
  );
}

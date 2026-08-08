import { useState } from 'react';
import type { RiskDeathOutcome, RollTier, SubduedChoice } from '@asohav/shared';
import { resolveRiskDeath } from '@asohav/shared';
import modal from '../../styles/modal.module.css';
import styles from './SubduedModal.module.css';

const TIER_BUTTONS: { tier: RollTier; label: string }[] = [
  { tier: 'Tier3', label: '10+' },
  { tier: 'Tier2', label: '7–9' },
  { tier: 'Tier1', label: 'Miss' },
];

/** A Negative Status just reached Rank 6 (Subdued) — the doc's three-way choice: take a Scar
 *  outright, roll + Nothing to Risk Death, or go out in a Blaze of Glory. This app never rolls
 *  dice itself, so Risk Death asks which tier you hit rather than simulating the roll. */
export function SubduedModal({
  statusName,
  onTakeScar,
  onRiskDeath,
  onBlazeOfGlory,
  onClose,
}: {
  statusName: string;
  onTakeScar: (scarText: string) => void;
  onRiskDeath: (outcome: RiskDeathOutcome, scarText?: string) => void;
  onBlazeOfGlory: () => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<SubduedChoice | null>(null);
  const [scarText, setScarText] = useState('');
  const [outcome, setOutcome] = useState<RiskDeathOutcome | null>(null);

  const result = outcome ? resolveRiskDeath(outcome) : null;

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 className={modal.title}>Subdued</h2>
          <p className={modal.subtitle}>{statusName} just reached Rank 6. Choose one.</p>
        </div>
        <div className={modal.body}>
          {choice === null && (
            <div className={styles.choices}>
              <button type="button" className={`tap-inline ${styles.choice}`} onClick={() => setChoice('Scar')}>
                <span className={styles.choiceName}>Take a Scar</span>
                <span className={styles.choiceDesc}>A near-permanent consequence, but you're stable.</span>
              </button>
              <button type="button" className={`tap-inline ${styles.choice}`} onClick={() => setChoice('RiskDeath')}>
                <span className={styles.choiceName}>Risk Death</span>
                <span className={styles.choiceDesc}>Roll + Nothing. 10+ live, 7-9 live but Scarred, miss dying.</span>
              </button>
              <button type="button" className={`tap-inline ${styles.choice}`} onClick={() => setChoice('BlazeOfGlory')}>
                <span className={styles.choiceName}>Blaze of Glory</span>
                <span className={styles.choiceDesc}>One last heroic act, then your character dies.</span>
              </button>
            </div>
          )}

          {choice === 'Scar' && (
            <>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="What changed about you, permanently?"
                value={scarText}
                onChange={(e) => setScarText(e.target.value)}
                autoFocus
              />
              <button className={`tap-inline ${modal.primaryAction}`} disabled={!scarText.trim()} onClick={() => onTakeScar(scarText.trim())}>
                Take the Scar
              </button>
            </>
          )}

          {choice === 'RiskDeath' && (
            <>
              {!outcome && (
                <div className={styles.tierRow}>
                  {TIER_BUTTONS.map((t) => (
                    <button key={t.tier} type="button" className={`tap-inline ${styles.tierButton}`} onClick={() => setOutcome(t.tier)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              {result && (
                <>
                  <p className={styles.narrative}>{result.Narrative}</p>
                  {result.RequiresScar ? (
                    <>
                      <textarea
                        className={styles.textarea}
                        rows={3}
                        placeholder="What Scar does the GM assign?"
                        value={scarText}
                        onChange={(e) => setScarText(e.target.value)}
                        autoFocus
                      />
                      <button
                        className={`tap-inline ${modal.primaryAction}`}
                        disabled={!scarText.trim()}
                        onClick={() => onRiskDeath(outcome!, scarText.trim())}
                      >
                        Accept the Scar
                      </button>
                    </>
                  ) : (
                    <button className={`tap-inline ${modal.primaryAction}`} onClick={() => onRiskDeath(outcome!)}>
                      Confirm
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {choice === 'BlazeOfGlory' && (
            <>
              <p className={styles.narrative}>Narrate your character's final heroic act. Once you confirm, they're gone.</p>
              <button className={`tap-inline ${modal.primaryAction}`} onClick={onBlazeOfGlory}>
                Confirm Blaze of Glory
              </button>
            </>
          )}

          <button
            className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`}
            onClick={() => {
              if (choice) {
                setChoice(null);
                setOutcome(null);
                setScarText('');
              } else {
                onClose();
              }
            }}
          >
            {choice ? 'Back' : 'Decide later'}
          </button>
        </div>
      </div>
    </div>
  );
}

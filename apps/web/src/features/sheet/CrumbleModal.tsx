import { useState } from 'react';
import type { CharacterSheet, Library } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import buttons from '../../styles/buttons.module.css';
import styles from './CrumbleModal.module.css';

/** Crumble (ruleset V0.5, `0.28.0`).
 *
 *  "If you need to mark a Condition but all Conditions are already marked, you Crumble. You lose
 *  consciousness, flee, or otherwise *must* leave the scene. Say how you do this and then clear
 *  one Condition."
 *
 *  Which Condition to clear is the player's choice — V0.5 doesn't specify one, so neither does
 *  this. The Vulnerable 4 that Crumbling in Combat also grants is applied by `EncounterView`,
 *  not here: this modal is reachable from the sheet whether or not an Encounter is running, and
 *  guessing at Combat state from the sheet is exactly the kind of thing that goes wrong quietly. */
export function CrumbleModal({
  sheet,
  library,
  reason,
  commit,
  onClose,
}: {
  sheet: CharacterSheet;
  library: Library;
  /** Why this fired, in one sentence — the trigger differs (a Gambit's cost, a spent last
   *  Recovery, the table calling for it) and the player should see which one it was. */
  reason: string;
  commit: (m: (d: CharacterSheet) => void) => void;
  onClose: () => void;
}) {
  const dialogRef = useModalA11y(onClose);
  const [chosen, setChosen] = useState<string | null>(null);

  const marked = sheet.Virtues
    .filter((v) => v.ConditionMarked)
    .map((v) => ({
      virtueId: v.VirtueId,
      name: library.conditions.find((c) => c.VirtueId === v.VirtueId)?.Name ?? v.VirtueId,
    }));

  function confirm() {
    if (!chosen) return;
    commit((d) => {
      const v = d.Virtues.find((x) => x.VirtueId === chosen);
      if (v) v.ConditionMarked = false;
    });
    onClose();
  }

  return (
    <div className={modal.backdrop}>
      <div className={modal.dialog} role="dialog" aria-modal="true" aria-labelledby="crumble-title" tabIndex={-1} ref={dialogRef}>
        <h2 id="crumble-title" className={modal.title}>You Crumble</h2>
        <p className={modal.subtitle}>{reason}</p>

        <p className={styles.body}>
          You lose consciousness, flee, or otherwise leave the scene — say how. Then clear one
          Condition. Agree with the GM how and when you come back.
        </p>

        <fieldset className={styles.choices}>
          <legend className={styles.legend}>Clear one Condition</legend>
          {marked.map((m) => (
            <label key={m.virtueId} className={`tap-row ${styles.choice}`}>
              <input
                type="radio"
                name="crumble-clear"
                checked={chosen === m.virtueId}
                onChange={() => setChosen(m.virtueId)}
              />
              <span>{m.name}</span>
            </label>
          ))}
        </fieldset>

        <div className={`action-grid ${modal.actions}`}>
          <button className="tap-inline" onClick={onClose}>Not yet</button>
          <button className={`tap-inline ${buttons.primary}`} disabled={!chosen} onClick={confirm}>
            Clear it and leave the scene
          </button>
        </div>
      </div>
    </div>
  );
}

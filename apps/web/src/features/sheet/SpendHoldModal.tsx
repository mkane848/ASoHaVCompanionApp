import { useState } from 'react';
import type { CharacterSheet, Library, Move } from '@asohav/shared';
import { holdEffectsForMove, holdGrantingMoves, holdPools, spendHold } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './SpendHoldModal.module.css';
import { backdropClose } from '../../lib/backdropClose.js';

/** Spending Hold, per the Move that granted it (V0.7 slice 11, 0.74.0).
 *
 *  V0.7 L508: "Each point of Hold can be spent, one-for-one, for a specific effect listed on the
 *  Move that gave you the Hold." The fixed four-item menu this modal used to offer (refresh Gear
 *  Charges / clear a Condition / mark a Bond / mark Potential) was inherited from End the Session's
 *  retired Hold economy and is not what any V0.7 Move that grants Hold says, so it is gone.
 *
 *  The two Moves that grant Hold, Assess the Situation and Discern the Truth, each list their
 *  effects as questions (`holdEffectsForMove()`). Spending Hold is a bookkeeping step: the app
 *  takes 1 Hold from the granting Move's pool and shows the question to ask at the table, the same
 *  self-report pattern the rest of the sheet uses — it does not answer anything.
 *
 *  Hold remembers which Move granted it (`CharacterSheet.HoldByMove`). Hold on a sheet from before
 *  that was tracked has no Move recorded; it is shown as "Earlier Hold" and may be spent on any
 *  Hold Move's effect, so an old sheet loses nothing. There is no Bond marking here any more, so
 *  the Bond propose/accept handshake is not involved: no Move that grants Hold marks a Bond. */
export function SpendHoldModal({
  sheet,
  library,
  commitSheet,
  onClose,
}: {
  sheet: CharacterSheet;
  library: Library;
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  onClose: () => void;
}) {
  const dialogRef = useModalA11y(onClose);
  const [chosenMoveId, setChosenMoveId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const hold = sheet.Hold ?? 0;
  const granting = holdGrantingMoves(library);
  const { pools, loose } = holdPools(sheet, library);

  // The Move whose effects are on show: the player's pick, or the only choice there is.
  const spendable: { move: Move; amount: number | null }[] = [
    ...pools.map((p) => ({ move: p.move, amount: p.amount as number | null })),
    // Loose Hold can pay for any Hold Move's effect; list the Moves that have no pool of their own.
    ...(loose > 0 ? granting.filter((m) => !pools.some((p) => p.move.Id === m.Id)).map((move) => ({ move, amount: null })) : []),
  ];
  const onlyChoice = spendable.length === 1 ? spendable[0].move : null;
  // Only a Move that can actually be paid for counts: a pick whose pool has since run dry falls away.
  const shown = spendable.find((s) => s.move.Id === chosenMoveId)?.move ?? onlyChoice;
  const effects = shown ? holdEffectsForMove(shown) : [];

  function spend(move: Move, effect: string) {
    const known = new Set(granting.map((m) => m.Id));
    // One commit carries the cost; if the spend can't be paid (stale view) nothing changes.
    commitSheet((d) => { spendHold(d, move.Id, known); });
    setNote(`Spent 1 Hold on ${move.Name}: “${effect}”`);
  }

  return (
    <div className={modal.backdrop} {...backdropClose(onClose)}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spend-hold-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="spend-hold-title" className={modal.title}>Spend Hold</h2>
          <p className={modal.subtitle}>Each point is spent, one-for-one, on an effect listed on the Move that gave it to you.</p>
        </div>
        <div className={modal.body}>
          <div className={styles.holdRow}>
            <span className={styles.holdLabel}>Hold</span>
            <span className={styles.holdValue}>{hold}</span>
          </div>

          {hold <= 0 && <p className={styles.empty}>No Hold to spend. Assess the Situation and Discern the Truth grant it.</p>}

          {hold > 0 && spendable.length === 0 && (
            <p className={styles.empty}>No Move in this library lists Hold effects to spend it on.</p>
          )}

          {hold > 0 && spendable.length > 1 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Which Move gave you the Hold?</div>
              <div className={`action-grid ${styles.buttonRow}`}>
                {spendable.map(({ move, amount }) => (
                  <button
                    key={move.Id}
                    type="button"
                    className={`tap-inline ${styles.choice} ${shown?.Id === move.Id ? styles.choiceOn : ''}`}
                    aria-pressed={shown?.Id === move.Id}
                    onClick={() => setChosenMoveId(move.Id)}
                  >
                    {move.Name}{amount === null ? '' : ` · ${amount}`}
                  </button>
                ))}
              </div>
              {loose > 0 && (
                <p className={styles.hint}>
                  {loose} of your Hold predates tracking which Move gave it, so it can be spent on any of these.
                </p>
              )}
            </div>
          )}

          {hold > 0 && shown && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>{shown.Name}: spend 1 Hold to&hellip;</div>
              <div className={styles.effects}>
                {effects.map((effect) => (
                  <button key={effect} type="button" className={`tap-inline ${styles.choice} ${styles.effect}`} onClick={() => spend(shown, effect)}>
                    {effect}
                  </button>
                ))}
              </div>
            </div>
          )}

          {note && <p className={styles.confirmed} role="status">{note}</p>}

          <button className={`tap-inline ${modal.secondaryAction} ${styles.close}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

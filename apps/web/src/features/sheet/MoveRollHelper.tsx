import { useState } from 'react';
import type { CharacterSheet, Library, Move } from '@asohav/shared';
import { computeRollBreakdown, conditionalRollBonuses } from '@asohav/shared';
import styles from './MoveRollHelper.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

/** "What to roll" for a Basic Move: 2d6 + Virtue, broken down by source. This app never rolls
 *  the dice itself (see CLAUDE.md) — the player rolls physical dice against this total. Moves
 *  with no fixed Virtue ("Invoke Expertise", "Take a Risk") let the player pick which one fits
 *  the fictional action first. */
export function MoveRollHelper({ move, sheet, library }: { move: Move; sheet: CharacterSheet; library: Library }) {
  const [pickedVirtueId, setPickedVirtueId] = useState<string | null>(null);
  const virtueId = move.VirtueId ?? pickedVirtueId;

  if (!virtueId) {
    return (
      <div className={styles.rollHelper}>
        <div className={styles.label}>Roll 2d6 + which Virtue fits?</div>
        <div className={`tap-row ${styles.virtueRow}`}>
          {library.virtues.map((v) => (
            <button key={v.Id} type="button" className={`tap-inline ${styles.virtueButton}`} onClick={() => setPickedVirtueId(v.Id)}>
              {v.Name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const breakdown = computeRollBreakdown(sheet, virtueId, library, move.Id);
  const conditional = conditionalRollBonuses(sheet, library, virtueId, move.Id);

  return (
    <div className={styles.rollHelper}>
      <div className={styles.label}>
        Roll 2d6 + {breakdown.VirtueName}: <span className={styles.total}>{sign(breakdown.Total)}</span>
        {!move.VirtueId && (
          <button type="button" className={`tap-inline ${styles.change}`} onClick={() => setPickedVirtueId(null)}>
            change
          </button>
        )}
      </div>
      <ul className={styles.sources}>
        {breakdown.Sources.map((s, i) => (
          <li key={i}>
            {s.Label} <span className={styles.sourceValue}>{sign(s.Value)}</span>
          </li>
        ))}
      </ul>
      {conditional.length > 0 && (
        <div className={styles.conditional}>
          <div className={styles.conditionalLabel}>May also apply — your call:</div>
          <ul className={styles.sources}>
            {conditional.map((c, i) => (
              <li key={i}>
                {c.Label}
                {c.TriggerText ? ` (${c.TriggerText})` : ''} <span className={styles.sourceValue}>{sign(c.Value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

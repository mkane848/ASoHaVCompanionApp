import type { CombatParticipant } from '@asohav/shared';
import { SectionHead } from '../../components/SectionHead.js';
import styles from './EncounterView.module.css';

/** Legendary enemies (revised V0.6, slice 7): "A Legendary Enemy takes one turn after every Hero's
 *  turn", and "if a Legendary Enemy is surprised at the start of Combat, the GM may spend a
 *  Misfortune to allow them to take their first turn after the first Hero acts" — offered only
 *  while the GM has one to spend. */
export function LegendarySection({
  isGM,
  round,
  legendaries,
  misfortuneAvailable,
  onAttack,
  onSpendMisfortuneToAct,
}: {
  isGM: boolean;
  round: number;
  legendaries: CombatParticipant[];
  misfortuneAvailable: number;
  onAttack: (p: CombatParticipant) => void;
  onSpendMisfortuneToAct: (p: CombatParticipant) => void;
}) {
  if (!(isGM && legendaries.length > 0)) return null;

  const activeLegendaries = legendaries.filter((l) => !l.Defeated);
  if (activeLegendaries.length === 0) return null;

  return (
    <div className={styles.section}>
      <SectionHead title="Legendary enemies" size="sm" />
      {activeLegendaries.map((l) => (
        <div key={l.Id} className={styles.offer}>
          <div className={styles.offerText}>
            {l.Name} — {l.Phase === 'LastStand' ? 'Last Stand' : l.Phase}
          </div>
          <div className={styles.offerDetail}>Takes a turn after every Hero's turn.</div>
          {l.Surprised && round === 1 && (
            <div className={styles.offerDetail}>
              Surprised — the GM may spend a Misfortune to let it take its first turn after the first Hero acts.
            </div>
          )}
          <div className={styles.offerRow}>
            <button className={`tap-inline ${styles.actionButton}`} onClick={() => onAttack(l)}>
              Attack
            </button>
            {l.Surprised && round === 1 && (
              <button className={`tap-inline ${styles.actionButton}`} disabled={misfortuneAvailable <= 0} onClick={() => onSpendMisfortuneToAct(l)}>
                Spend a Misfortune
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

import type { RollBreakdown } from '@asohav/shared';
import styles from './HeroRollBuilder.module.css';

/** A Major or Severe Status affects the roll without being a number in the total (see
 *  `StatusPenalty` in engine.ts); a Minor one is already a line in the sources above. */
export function StatusSection({ breakdown }: { breakdown: RollBreakdown }) {
  if (!breakdown.StatusPenalty) return null;
  return (
    <div className={styles.statusEffects}>
      <div className={styles.statusEffectsLabel}>Also affecting this roll:</div>
      <ul className={styles.sources}>
        <li>
          {breakdown.StatusPenalty.Status.Name} ({breakdown.StatusPenalty.Status.Severity})
          <span className={styles.sourceValue}>{breakdown.StatusPenalty.Penalty.Label}</span>
        </li>
      </ul>
    </div>
  );
}

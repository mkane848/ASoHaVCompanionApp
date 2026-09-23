import type { CombatParticipant, EngageKind } from '@asohav/shared';
import { isEnemyDefeated } from '@asohav/shared';
import { SectionHead } from '../../components/SectionHead.js';
import styles from './EncounterView.module.css';

/** The GM's extra actions for each living Boss — the pre-revision name for what slice 7 makes a
 *  Legendary enemy with phases. */
export function LegendarySection({
  isGM,
  livingBosses,
  onBossActs,
}: {
  isGM: boolean;
  livingBosses: CombatParticipant[];
  onBossActs: (boss: CombatParticipant, kind: EngageKind) => void;
}) {
  if (!(isGM && livingBosses.length > 0)) return null;
  return (
    <div className={styles.section}>
      <SectionHead title="Boss actions" size="sm" />
      {livingBosses.map((b) => (
        <div key={b.Id} className={styles.offer}>
          <div className={styles.offerText}>
            {b.Name} — Gambit Charges: {b.GambitCharges ?? 0}
            {isEnemyDefeated(b.Statuses, b.StatusLimits) && ' — Last Stand'}
          </div>
          <div className={styles.offerRow}>
            <button className={`tap-inline ${styles.actionButton}`} onClick={() => onBossActs(b, 'Melee')}>
              Boss Acts (Melee)
            </button>
            <button className={`tap-inline ${styles.actionButton}`} onClick={() => onBossActs(b, 'Ranged')}>
              Boss Acts (Ranged)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

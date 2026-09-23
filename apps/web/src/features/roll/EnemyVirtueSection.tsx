import type { CombatParticipant, Library } from '@asohav/shared';
import { enemyVirtueRollHints } from '@asohav/shared';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import styles from './HeroRollBuilder.module.css';

export interface EnemyVirtueSectionProps {
  enemy: CombatParticipant;
  library: Library;
  /** Virtue ids of the enemy's this roll directly opposes (Strong) or exploits (Weak). */
  selected: Set<string>;
  onToggle: (virtueId: string) => void;
}

/** "When a Hero directly opposes one of the Enemy's Strong Virtues, each `+` creates one Bane for
 *  that Hero. When a Hero exploits a Weak Virtue, each `−` creates one Boon. Resolve those Boons
 *  and Banes normally." Lists the enemy's effective Virtues — `enemyVirtueRollHints` has already
 *  applied any marked Condition's downgrade. Whether one is relevant to this roll is the table's
 *  call, so nothing is pre-ticked. */
export function EnemyVirtueSection({ enemy, library, selected, onToggle }: EnemyVirtueSectionProps) {
  const hints = enemyVirtueRollHints(enemy);

  if (hints.length === 0) return null;

  return (
    <div className={styles.tagBlock}>
      <div className={styles.tagBlockLabel}>{enemy.Name}'s Virtues — tick any this roll directly opposes or exploits:</div>
      <div>
        {hints.map((h) => {
          const virtue = library.virtues.find((v) => v.Id === h.VirtueId);
          const isStrong = h.Rating > 0;
          const count = isStrong ? h.Banes : h.Boons;
          const label = isStrong
            ? `Opposing its ${virtue?.Name} (${'+'.repeat(count)})`
            : `Exploiting its ${virtue?.Name} (${'−'.repeat(count)})`;
          const suffix = isStrong ? ` — ${count} Bane${count !== 1 ? 's' : ''}` : ` — ${count} Boon${count !== 1 ? 's' : ''}`;

          return (
            <CheckboxRow
              key={h.VirtueId}
              checked={selected.has(h.VirtueId)}
              onToggle={() => onToggle(h.VirtueId)}
            >
              {label}
              <span className={styles.tagMotif}>
                {suffix}
              </span>
            </CheckboxRow>
          );
        })}
      </div>
    </div>
  );
}

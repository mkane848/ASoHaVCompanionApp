import type { CharacterSummary, Library } from '@asohav/shared';
import styles from './PeekCard.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export function PeekCard({ summary, library }: { summary: CharacterSummary; library: Library }) {
  const dishonored = summary.ConditionsMarked.length >= 5;
  const loadOver = summary.Load.Carried > summary.Load.Capacity;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.name}>{summary.Name}</span>
        <span className={styles.player}>{summary.PlayerName}</span>
      </div>
      <div className={styles.theme}>{summary.Theme}</div>

      <div className={styles.virtues}>
        {library.virtues.map((v) => {
          const vv = summary.Virtues.find((x) => x.VirtueId === v.Id);
          if (!vv) return null;
          return (
            <div key={v.Id} className={styles.virtue}>
              <div className={styles.virtueName}>{v.Name}</div>
              <div className={`${styles.virtueScore} ${vv.ConditionMarked ? styles.virtueScoreMarked : ''}`}>{sign(vv.Score)}</div>
            </div>
          );
        })}
      </div>

      {summary.ConditionsMarked.length > 0 && (
        <div className={styles.conditions}>Conditions: {summary.ConditionsMarked.join(', ')}</div>
      )}
      {dishonored && <div className={styles.dishonored}>Dishonored</div>}

      {summary.Statuses.length > 0 && (
        <div className={styles.statuses}>
          {summary.Statuses.map((s) => (
            <span key={s.Id} className={`${styles.status} ${s.Polarity === 'Positive' ? styles.statusPositive : ''}`}>
              {s.Name} {s.Rank}
            </span>
          ))}
        </div>
      )}

      <div className={styles.footer}>
        <span className={loadOver ? styles.over : undefined}>
          Load {summary.Load.Carried} / {summary.Load.Capacity}
          {loadOver ? ' · over' : ''}
        </span>
        <span>Armor {summary.ArmorReady} / {summary.ArmorTotal}</span>
        <span>Potential {summary.Potential} / 5</span>
      </div>
    </div>
  );
}

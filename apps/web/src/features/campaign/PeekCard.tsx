import { CONDITION_COUNT, isUnstable, sortStatuses, statusRank, type CharacterSummary, type Library } from '@asohav/shared';
import { InfoTooltip, TooltipSection } from '../../components/InfoTooltip.js';
import styles from './PeekCard.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export function PeekCard({ summary, library }: { summary: CharacterSummary; library: Library }) {
  // All five Conditions marked is a legal state as of V0.5, not itself the consequence — the next
  // one marked is what triggers Crumble (see `markCondition` in logic.ts). PeekCard has no sheet
  // to hand `allConditionsMarked()`, so it compares against the exported constant directly instead
  // of re-deriving the literal 5.
  const onTheEdge = summary.ConditionsMarked.length >= CONDITION_COUNT;
  const loadOver = summary.Load.Carried > summary.Load.Capacity;
  const crumbleTerm = library.glossary.find((g) => g.Id === 'g-crumble') ?? library.glossary.find((g) => g.Name === 'Crumble');
  const unstableTerm = library.glossary.find((g) => g.Id === 'g-unstable') ?? library.glossary.find((g) => g.Name === 'Unstable');
  const unstable = isUnstable(summary.Statuses);

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
      {(onTheEdge || unstable) && (
        <div className={styles.badges}>
          {onTheEdge && (
            <div className={styles.crumbleWrap}>
              <div className={styles.crumbleBadge}>Crumbles next</div>
              <InfoTooltip label="Crumbles next">
                <TooltipSection label="What it means">{crumbleTerm?.Definition ?? 'Marking a sixth Condition with all five already marked forces them from the scene.'}</TooltipSection>
              </InfoTooltip>
            </div>
          )}
          {unstable && (
            <div className={styles.unstableWrap}>
              <div className={styles.unstableBadge}>Unstable</div>
              <InfoTooltip label="Unstable">
                <TooltipSection label="What it means">{unstableTerm?.Definition ?? 'A Status at Rank 4 or higher — a threshold other rules can key off.'}</TooltipSection>
              </InfoTooltip>
            </div>
          )}
        </div>
      )}

      {summary.Statuses.length > 0 && (
        <div className={styles.statuses}>
          {sortStatuses(summary.Statuses).map((s) => (
            <span
              key={s.Id}
              className={`${styles.status} ${
                s.Polarity === 'Positive' ? styles.statusPositive : s.Polarity === 'Negative' ? styles.statusNegative : ''
              }`}
            >
              {s.Name} {statusRank(s)}
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

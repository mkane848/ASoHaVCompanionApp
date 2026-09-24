import { rollOdds, type RollShape } from '@asohav/shared';
import styles from './OddsPanel.module.css';

/** The dice-odds readout for the roll as built (revised V0.6 slice 9) — admin-only, behind Debug
 *  mode; `HeroRollBuilder` renders it only when `useDebugMode()` is true. */
export interface OddsPanelProps {
  /** The capped final modifier (`RollBreakdown.Total`). */
  modifier: number;
  shape: RollShape;
  /** Anything the readout can't account for, e.g. a Major Status's Disadvantage (how it combines
   *  with Boons and Banes is an open question the app doesn't answer). */
  note?: string;
}

function shapeLabel(shape: RollShape): string {
  switch (shape) {
    case 'Normal':
      return '2d6';
    case 'Advantage':
      return '3d6, best two';
    case 'Disadvantage':
      return '3d6, worst two';
    case 'DoubleDisadvantage':
      return '4d6, worst two';
    case 'OneDie':
      return '1d6';
  }
}

function formatPercent(count: number, outcomes: number): string {
  const percent = Math.round((count / outcomes) * 1000) / 10;
  return percent % 1 === 0 ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;
}

export function OddsPanel({ modifier, shape, note }: OddsPanelProps) {
  const odds = rollOdds(modifier, shape);

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Odds (Debug mode)</div>

      <div className={styles.diceShape}>{shapeLabel(shape)}</div>

      <div className={styles.odds}>
        <div className={styles.tier}>
          <span className={styles.tierLabel}>10+</span>
          <span className={styles.tierValue}>{formatPercent(odds.Tier3, odds.Outcomes)}</span>
        </div>
        <div className={styles.tier}>
          <span className={styles.tierLabel}>7–9</span>
          <span className={styles.tierValue}>{formatPercent(odds.Tier2, odds.Outcomes)}</span>
        </div>
        <div className={styles.tier}>
          <span className={styles.tierLabel}>6−</span>
          <span className={styles.tierValue}>{formatPercent(odds.Tier1, odds.Outcomes)}</span>
        </div>
      </div>

      <div className={styles.twelvePlus}>
        12+: {formatPercent(odds.TwelvePlus, odds.Outcomes)}
      </div>

      {note && <div className={styles.note}>{note}</div>}
    </div>
  );
}

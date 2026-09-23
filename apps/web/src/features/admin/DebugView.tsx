import { rollOdds, type RollShape } from '@asohav/shared';
import { useDebugStore } from '../../store/debugStore.js';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import styles from './DebugView.module.css';

const SHAPES: RollShape[] = ['Normal', 'Advantage', 'Disadvantage', 'DoubleDisadvantage', 'OneDie'];

function shapeLabel(shape: RollShape): string {
  switch (shape) {
    case 'Normal':
      return '2d6';
    case 'Advantage':
      return '3d6, best';
    case 'Disadvantage':
      return '3d6, worst';
    case 'DoubleDisadvantage':
      return '4d6, worst';
    case 'OneDie':
      return '1d6';
  }
}

function formatPercent(count: number, outcomes: number): string {
  const percent = Math.round((count / outcomes) * 1000) / 10;
  return percent % 1 === 0 ? `${percent.toFixed(0)}` : `${percent.toFixed(1)}`;
}

export function DebugView() {
  const { debug, setDebug } = useDebugStore();

  return (
    <div className={styles.container}>
      <CheckboxRow checked={debug} onToggle={() => setDebug(!debug)}>
        Debug mode
      </CheckboxRow>
      <div className={styles.explanation}>
        Shows admin-only readouts, like the dice odds in the roll builder, in this browser. Other accounts never see them.
      </div>

      <div className={styles.tableSection}>
        <div className={styles.tableTitle}>Dice math</div>
        <div className={styles.tableCaption}>
          Each cell shows the chance of 10+ / 7–9 / 6− for that modifier and dice shape. The ±3 cap means these are all the modifiers a Hero Roll can reach.
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.modifierHeader}>Modifier</th>
                {SHAPES.map((shape) => (
                  <th key={shape} className={styles.shapeHeader}>
                    {shapeLabel(shape)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 7 }, (_, i) => i - 3).map((modifier) => (
                <tr key={modifier}>
                  <td className={styles.modifierCell}>{modifier > 0 ? `+${modifier}` : modifier}</td>
                  {SHAPES.map((shape) => {
                    const odds = rollOdds(modifier, shape);
                    return (
                      <td key={shape} className={styles.oddsCell}>
                        <div className={styles.oddsLine}>
                          {formatPercent(odds.Tier3, odds.Outcomes)} / {formatPercent(odds.Tier2, odds.Outcomes)} /{' '}
                          {formatPercent(odds.Tier1, odds.Outcomes)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

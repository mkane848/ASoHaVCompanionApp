import type { AdvantageState, CharacterSheet } from '@asohav/shared';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import styles from './HeroRollBuilder.module.css';

/** The sheet's Boons and Banes, ticked per roll, and what their comparison means for the dice. The
 *  Condition Banes are ticked in their own section but count toward the same comparison. */
export function BoonBaneSection({
  sheet,
  boonsSelected,
  banesSelected,
  advantage,
  onToggleBoon,
  onToggleBane,
}: {
  sheet: CharacterSheet;
  boonsSelected: Set<number>;
  banesSelected: Set<number>;
  advantage: AdvantageState;
  onToggleBoon: (i: number) => void;
  onToggleBane: (i: number) => void;
}) {
  return (
    <div className={styles.tagBlock}>
      <div className={styles.tagBlockLabel}>Boons &amp; Banes relevant to this roll:</div>
      {sheet.Boons.length === 0 && sheet.Banes.length === 0 ? (
        <div className={styles.holdConfirmed}>None yet — add some on the Statuses panel.</div>
      ) : (
        <div className={styles.boonBaneGrid}>
          <div>
            {sheet.Boons.map((b, i) => (
              <CheckboxRow key={i} checked={boonsSelected.has(i)} onToggle={() => onToggleBoon(i)}>
                {b}
              </CheckboxRow>
            ))}
          </div>
          <div>
            {sheet.Banes.map((b, i) => (
              <CheckboxRow key={i} checked={banesSelected.has(i)} onToggle={() => onToggleBane(i)}>
                {b}
              </CheckboxRow>
            ))}
          </div>
        </div>
      )}
      <div className={styles.advantageActiveBanner}>
        {advantage === 'Advantage' && 'More Boons than Banes — roll 3d6, keep the best two.'}
        {advantage === 'Disadvantage' && 'More Banes than Boons — roll 3d6, keep the worst two.'}
        {advantage === 'DoubleDisadvantage' && 'Double Disadvantage — roll 4d6, keep the worst two.'}
        {advantage === 'Normal' && 'Equal Boons and Banes (or none selected) — roll the usual 2d6.'}
      </div>
    </div>
  );
}

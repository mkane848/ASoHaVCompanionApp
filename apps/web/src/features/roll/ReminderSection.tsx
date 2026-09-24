import type { SheetReminder } from '@asohav/shared';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import styles from './HeroRollBuilder.module.css';

/** The sheet's Forward and Ongoing reminders as optional modifiers on this roll (revised V0.6
 *  slice 9): each ticked one is a `Reminder` modifier inside the ±3 cap, and `HeroRollBuilder`
 *  removes a ticked Forward from the sheet when the tier is reported. Whether one applies is the
 *  player's call — nothing is pre-ticked. */
export interface ReminderSectionProps {
  reminders: SheetReminder[];
  /** Reminder ids applied to this roll. */
  selected: Set<string>;
  onToggle: (reminderId: string) => void;
}

export function ReminderSection({ reminders, selected, onToggle }: ReminderSectionProps) {
  if (reminders.length === 0) return null;

  return (
    <div className={styles.tagBlock}>
      <div className={styles.tagBlockLabel}>Reminders — tick any that apply to this roll:</div>
      <div>
        {reminders.map((r) => (
          <CheckboxRow
            key={r.Id}
            checked={selected.has(r.Id)}
            onToggle={() => onToggle(r.Id)}
          >
            {r.Text}
            <span className={styles.tagMotif}>
              {' '}
              ({r.Value > 0 ? '+' : '−'}{Math.abs(r.Value)} {r.Kind}
              {r.Kind === 'Forward' ? ' — used up when you report the tier' : ''})
            </span>
          </CheckboxRow>
        ))}
      </div>
    </div>
  );
}

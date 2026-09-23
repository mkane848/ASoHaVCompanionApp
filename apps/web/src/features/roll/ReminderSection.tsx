import type { SheetReminder } from '@asohav/shared';

/** The sheet's Forward and Ongoing reminders as optional modifiers on this roll (revised V0.6
 *  slice 9). Contract stub — WP 9C. */
export interface ReminderSectionProps {
  reminders: SheetReminder[];
  /** Reminder ids applied to this roll. */
  selected: Set<string>;
  onToggle: (reminderId: string) => void;
}

export function ReminderSection(props: ReminderSectionProps) {
  void props;
  return null;
}

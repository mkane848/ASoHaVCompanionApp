import type { ReminderKind } from '@asohav/shared';

export interface ReminderPreset {
  MoveId: string;
  Text: string;
  Value: number;
  Kind: ReminderKind;
}

/** The Forward and Ongoing bonuses a Move's own text gives the Hero who makes it (revised V0.6
 *  slice 9), offered as one-tap reminders in the Moves drawer. Only what the text grants the roller
 *  — a bonus it gives someone else can only be added by that player. Each preset quotes its source
 *  phrase; a Move whose text grants more than one (by tier) gets one preset per grant. */
export const REMINDER_PRESETS: ReminderPreset[] = [
  // "Take +1 ongoing while acting on any answers."
  { MoveId: 'm-assess', Text: 'Acting on answers from your assessment', Value: 1, Kind: 'Ongoing' },

  // "You and any allies you brief take +1 Ongoing while you act on this knowledge"
  { MoveId: 'm-past', Text: 'Acting on the knowledge you uncovered', Value: 1, Kind: 'Ongoing' },
  // "You and any allies you brief take +1 Forward while you act on this knowledge"
  { MoveId: 'm-past', Text: 'Acting on the knowledge you uncovered', Value: 1, Kind: 'Forward' },

  // Sway the Spirit's "Then they get +1 forward" is the other Hero's, not the roller's, so it
  // isn't offered here — only the sheet's owner can add to it.
  // "The act or their answer puts them in danger; take −1 forward due to the friction."
  { MoveId: 'm-sway', Text: 'From the friction of your approach', Value: -1, Kind: 'Forward' },

  // "They stumble: gain a critical opportunity and take +1 forward against them."
  { MoveId: 'm-strike', Text: 'From the opening you revealed', Value: 1, Kind: 'Forward' },

  // "You are unshakeable. You shrug off the pressure and gain a momentary advantage (take +1 forward) against the source of the threat."
  { MoveId: 'm-defiant', Text: 'Against the source of the threat', Value: 1, Kind: 'Forward' },

  // "On a 10+, you avoid dangers and distractions and make good time... — choose one below and gain +1 Ongoing to any future rolls while you travel."
  { MoveId: 'm-journey', Text: 'To future rolls while you travel', Value: 1, Kind: 'Ongoing' },

  // "While at Camp, all party members have +1 Ongoing to all +Heart rolls."
  { MoveId: 'm-camp', Text: 'To all +Heart rolls at Camp', Value: 1, Kind: 'Ongoing' },
];

export function presetsForMove(moveId: string): ReminderPreset[] {
  return REMINDER_PRESETS.filter((p) => p.MoveId === moveId);
}

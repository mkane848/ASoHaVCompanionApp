import type { QuestAbandonInput, QuestCompletionChoices } from '@asohav/shared';

/** Steps a Quest through its three Act Breaks and three Forsakes and runs the completion or
 *  abandonment procedure when either reaches three (Ruleset-V0.6.md, "Hero Motif Advancement —
 *  Quests"; the Party Quest uses the same procedures, "Party Advancement — Quests"). Generic over
 *  who holds the Quest so slice 4 can reuse it for the Party: the caller owns the data and the
 *  progress track, and applies each callback through its own commit path. */
export interface QuestProgressProps {
  quest: string;
  actBreaks: number;
  forsakes: number;
  /** The holder's current title — a Motif's name, or the Party Motif — offered as the default when
   *  the procedure asks for a new one. */
  currentName: string;
  skillTags: string[];
  flawTags: string[];
  /** "Potential" for a Hero's Motif, "Rapport" for the Party — only used in labels. */
  progressLabel: 'Potential' | 'Rapport';
  /** The Quest text itself, edited in place. */
  onQuestChange: (quest: string) => void;
  /** Set counts rather than "mark one", so a mis-tap can be stepped back like every other track on
   *  the sheet. Reaching 3 is what opens the completion or abandonment procedure. */
  onSetActBreaks: (n: number) => void;
  onSetForsakes: (n: number) => void;
  onComplete: (choices: QuestCompletionChoices) => void;
  onAbandon: (input: QuestAbandonInput) => void;
  readOnly?: boolean;
}

export function QuestProgress(_props: QuestProgressProps) {
  // Stub from the slice 3 contract commit — WP 3D implements it.
  return null;
}

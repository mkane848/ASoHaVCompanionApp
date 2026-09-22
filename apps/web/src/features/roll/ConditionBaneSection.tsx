import type { CharacterSheet, Library } from '@asohav/shared';

/** V0.6 revision: "Each Condition you mark gives you an associated Bane that applies to any
 *  relevant rolls." Lists `conditionBaneCandidates(sheet, library)` as Banes to tick for this roll;
 *  each ticked one counts as one Bane in the Boon/Bane comparison. Whether a Condition is relevant
 *  is the table's call — the rolled Virtue's own is pre-ticked by `HeroRollBuilder`, a UI default
 *  (`WorkPlan-V0.6-Revision.md` A2.2). */
export interface ConditionBaneSectionProps {
  sheet: CharacterSheet;
  library: Library;
  /** Virtue ids whose Condition Bane is ticked for this roll. */
  selected: Set<string>;
  onToggle: (virtueId: string) => void;
}

export function ConditionBaneSection(_props: ConditionBaneSectionProps) {
  // Stub from the slice 1 web prep — WP 1C implements it.
  return null;
}

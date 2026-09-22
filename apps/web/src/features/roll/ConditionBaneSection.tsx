import type { CharacterSheet, Library } from '@asohav/shared';
import { conditionBaneCandidates } from '@asohav/shared';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import styles from './HeroRollBuilder.module.css';

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

export function ConditionBaneSection({ sheet, library, selected, onToggle }: ConditionBaneSectionProps) {
  const candidates = conditionBaneCandidates(sheet, library);

  if (candidates.length === 0) return null;

  return (
    <div className={styles.tagBlock}>
      <div className={styles.tagBlockLabel}>Marked Conditions — each is a Bane on a relevant roll:</div>
      <div>
        {candidates.map((c) => (
          <CheckboxRow
            key={c.VirtueId}
            checked={selected.has(c.VirtueId)}
            onToggle={() => onToggle(c.VirtueId)}
          >
            {c.ConditionName}
            <span className={styles.tagMotif}>
              {' '}
              ({library.virtues.find((v) => v.Id === c.VirtueId)?.Name})
            </span>
          </CheckboxRow>
        ))}
      </div>
    </div>
  );
}

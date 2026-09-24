import type { ReactNode } from 'react';
import builderStyles from './HeroRollBuilder.module.css';
import styles from './WorkTogetherSection.module.css';

/** Work Together (revised V0.6 slice 8, an Adventure Move): "the GM may ask for the Party to make a
 *  single Hero Roll … Each Hero may contribute one relevant Skill Tag … Any or all of the Party Tags
 *  may be used as well … All Hero's Flaw Tags may affect this roll as well." The roller's own tags
 *  and the Party Tags have their own sections; this one adds the other Heroes' — +1 for each Hero
 *  contributing a Skill Tag, −1 for each of their Flaw Tags that applies — inside the ±3 cap. */
export interface WorkTogetherSectionProps {
  /** The other Heroes in the Party, by name. The section renders nothing when this is empty. */
  otherHeroNames: string[];
  /** Whether this roll is the Party's single Work Together roll. Off by default. */
  active: boolean;
  onToggleActive: () => void;
  /** The other Heroes contributing a Skill Tag, by name — +1 each, at most one per Hero. */
  contributors: ReadonlySet<string>;
  onToggleContributor: (name: string) => void;
  /** How many of the other Heroes' Flaw Tags affect the roll — −1 each. */
  otherFlawTags: number;
  onOtherFlawTagsChange: (count: number) => void;
}

export function WorkTogetherSection({
  otherHeroNames,
  active,
  onToggleActive,
  contributors,
  onToggleContributor,
  otherFlawTags,
  onOtherFlawTagsChange,
}: WorkTogetherSectionProps): ReactNode {
  if (otherHeroNames.length === 0) return null;

  return (
    <div className={builderStyles.tagBlock}>
      <button
        type="button"
        className={`tap-inline ${builderStyles.tagButton} ${active ? builderStyles.tagButtonActive : ''}`}
        aria-pressed={active}
        onClick={onToggleActive}
      >
        The Party is Working Together on this roll
      </button>

      {active && (
        <>
          <div className={builderStyles.holdConfirmed}>
            This is the whole Party's single roll and its outcome affects everyone. Your own
            Skill Tag and the Party Tags are declared in their own sections above.
          </div>

          <div className={`${builderStyles.tagBlockLabel} ${styles.expandedLabel}`}>
            Heroes contributing a Skill Tag:
          </div>
          <div className={`tap-row ${builderStyles.tagRow}`}>
            {otherHeroNames.map((name) => {
              const isContributor = contributors.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  className={`tap-inline ${builderStyles.tagButton} ${isContributor ? builderStyles.tagButtonActive : ''}`}
                  aria-pressed={isContributor}
                  onClick={() => onToggleContributor(name)}
                >
                  {name} contributes a Skill Tag <span className={builderStyles.tagMotif}>(+1)</span>
                </button>
              );
            })}
          </div>

          <div className={`${builderStyles.tagBlockLabel} ${styles.expandedLabel}`}>
            Other Heroes' Flaw Tags that affect the roll:
          </div>
          <div className={styles.stepper} role="group" aria-label="Other Heroes' Flaw Tags that affect the roll">
            <button
              type="button"
              className={`tap-inline ${styles.stepperButton}`}
              disabled={otherFlawTags <= 0}
              onClick={() => onOtherFlawTagsChange(Math.max(0, otherFlawTags - 1))}
              aria-label="Decrease other Heroes' Flaw Tags"
            >
              &minus;
            </button>
            <span className={styles.stepperValue} aria-live="polite">{otherFlawTags}</span>
            <button
              type="button"
              className={`tap-inline ${styles.stepperButton}`}
              onClick={() => onOtherFlawTagsChange(otherFlawTags + 1)}
              aria-label="Increase other Heroes' Flaw Tags"
            >
              &#43;
            </button>
          </div>
          <div className={builderStyles.holdConfirmed}>
            Each Hero whose Flaw Tag applies marks Potential on their own sheet, as a Flaw Tag
            normally does outside Combat — the app can only write the roller's sheet.
          </div>
        </>
      )}
    </div>
  );
}

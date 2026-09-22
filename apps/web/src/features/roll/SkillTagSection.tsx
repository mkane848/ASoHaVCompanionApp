import type { Library } from '@asohav/shared';
import type { FlatTag } from './rollTags.js';
import styles from './HeroRollBuilder.module.css';

/** One declared Skill Tag (+1), then optionally Push Yourself with a second one: mark a Condition,
 *  +1 more. The Condition picker appears between choosing the second tag and marking it. */
export function SkillTagSection({
  library,
  skillTags,
  skillTag,
  pushYourselfTag,
  pushingVirtue,
  onChooseSkillTag,
  onBeginPush,
  onMarkPushCondition,
}: {
  library: Library;
  skillTags: FlatTag[];
  skillTag: string | null;
  pushYourselfTag: string | null;
  pushingVirtue: boolean;
  onChooseSkillTag: (tag: string) => void;
  onBeginPush: (tag: string) => void;
  onMarkPushCondition: (virtueId: string) => void;
}) {
  if (skillTags.length === 0) return null;
  const otherSkillTags = skillTags.filter((t) => t.tag !== skillTag);

  return (
    <div className={styles.tagBlock}>
      <div className={styles.tagBlockLabel}>Skill Tags — declare one that applies (+1):</div>
      <div className={`tap-row ${styles.tagRow}`}>
        {skillTags.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tap-inline ${styles.tagButton} ${skillTag === t.tag ? styles.tagButtonActive : ''}`}
            onClick={() => onChooseSkillTag(t.tag)}
          >
            {t.tag} <span className={styles.tagMotif}>({t.motifName})</span>
          </button>
        ))}
      </div>
      {skillTag && !pushYourselfTag && otherSkillTags.length > 0 && (
        <div className={styles.pushBlock}>
          <div className={styles.tagBlockLabel}>Push Yourself — a second tag also applies (mark a Condition, +1):</div>
          <div className={`tap-row ${styles.tagRow}`}>
            {otherSkillTags.map((t) => (
              <button key={t.key} type="button" className={`tap-inline ${styles.tagButton}`} onClick={() => onBeginPush(t.tag)}>
                {t.tag}
              </button>
            ))}
          </div>
        </div>
      )}
      {pushingVirtue && (
        <div className={styles.pushBlock}>
          <div className={styles.tagBlockLabel}>Mark which Condition?</div>
          <div className={`tap-row ${styles.virtueRow}`}>
            {library.virtues.map((v) => {
              const cond = library.conditions.find((c) => c.VirtueId === v.Id);
              return (
                <button key={v.Id} type="button" className={`tap-inline ${styles.virtueButton}`} onClick={() => onMarkPushCondition(v.Id)}>
                  {cond?.Name ?? v.Name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {pushYourselfTag && !pushingVirtue && (
        <div className={styles.holdConfirmed}>Pushed with &ldquo;{pushYourselfTag}&rdquo; — Condition marked.</div>
      )}
    </div>
  );
}

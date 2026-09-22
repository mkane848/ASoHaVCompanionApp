import type { Party } from '@asohav/shared';
import styles from './HeroRollBuilder.module.css';

/** V0.6 slice 7 added a Party Skill/Weakness Tag declaration, stored without a multiplier — see
 *  `WorkPlan-V0.6.md` Section D item 8, the then-open "what does a Party Tag actually do
 *  mechanically" question. Declaring one only logs it to `Party.History`. The revision answers the
 *  question (+1 without Pushing, single-use, refreshed at Make Camp); slice 4 makes this real. */
export function PartyTagSection({ party, declaredKeys, onDeclare }: {
  party: Party;
  declaredKeys: Set<string>;
  onDeclare: (field: 'SkillTags' | 'WeaknessTags', tag: string) => void;
}) {
  if (party.SkillTags.length === 0 && party.WeaknessTags.length === 0) return null;
  return (
    <div className={styles.tagBlock}>
      <div className={styles.tagBlockLabel}>Party Tags relevant to this roll:</div>
      <div className={`tap-row ${styles.tagRow}`}>
        {party.SkillTags.map((t, i) => (
          <button
            key={`skill-${i}`}
            type="button"
            className={`tap-inline ${styles.tagButton} ${declaredKeys.has(`SkillTags-${t}`) ? styles.tagButtonActive : ''}`}
            disabled={declaredKeys.has(`SkillTags-${t}`)}
            onClick={() => onDeclare('SkillTags', t)}
          >
            {t}
          </button>
        ))}
        {party.WeaknessTags.map((t, i) => (
          <button
            key={`weakness-${i}`}
            type="button"
            className={`tap-inline ${styles.tagButton} ${declaredKeys.has(`WeaknessTags-${t}`) ? styles.tagButtonActive : ''}`}
            disabled={declaredKeys.has(`WeaknessTags-${t}`)}
            onClick={() => onDeclare('WeaknessTags', t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className={styles.holdConfirmed}>
        Logged to the party&rsquo;s History only — what a Party Tag does mechanically is still an
        open question (see the Moves guide), so this doesn&rsquo;t change the total above.
      </div>
    </div>
  );
}

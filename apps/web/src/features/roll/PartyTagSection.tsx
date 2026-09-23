import type { Party, PartyTagKind } from '@asohav/shared';
import { isPartyTagUsed, partyTagKey } from '@asohav/shared';
import styles from './HeroRollBuilder.module.css';

/** V0.6 slice 4 (the Party): the player declares a Party Skill Tag (+1) to add to the roll, or the
 *  GM invokes a Party Flaw Tag (−1). Either way, one Rapport is marked and the tag is marked used
 *  until Make Camp. */
export function PartyTagSection({ party, invokedKeys, onInvoke }: {
  party: Party;
  invokedKeys: Set<string>;
  onInvoke: (kind: PartyTagKind, tag: string) => void;
}) {
  if (party.SkillTags.length === 0 && party.FlawTags.length === 0) return null;

  function renderTag(kind: PartyTagKind, tag: string, label: string) {
    const key = partyTagKey(kind, tag);
    const isInvoked = invokedKeys.has(key);
    const isUsed = isPartyTagUsed(party, kind, tag) && !isInvoked;

    return (
      <button
        key={key}
        type="button"
        className={`tap-inline ${styles.tagButton} ${isInvoked ? styles.tagButtonActive : ''}`}
        aria-pressed={isInvoked}
        disabled={isInvoked || isUsed}
        onClick={() => onInvoke(kind, tag)}
      >
        {tag}
        <span className={styles.tagMotif}> {label}</span>
        {isUsed && <span> (used — refreshes at Make Camp)</span>}
      </button>
    );
  }

  return (
    <div className={styles.tagBlock}>
      <div className={styles.tagBlockLabel}>Party Tags relevant to this roll:</div>
      <div className={`tap-row ${styles.tagRow}`}>
        {party.SkillTags.map((t) => renderTag('Skill', t, '+1'))}
        {party.FlawTags.map((t) => renderTag('Flaw', t, '−1 — the GM invokes these'))}
      </div>
      <div className={styles.holdConfirmed}>
        Each Party Tag works for one Hero Roll, then refreshes at Make Camp. Invoking one marks
        Rapport.
      </div>
    </div>
  );
}

import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import type { FlatTag } from './rollTags.js';
import styles from './HeroRollBuilder.module.css';

/** Flaw Tags that apply: −1 each, and each one marks Potential on its Motif the moment it's ticked
 *  — which is why a tick is one-way. */
export function FlawTagSection({ flawTags, usedKeys, onUse }: { flawTags: FlatTag[]; usedKeys: Set<string>; onUse: (t: FlatTag) => void }) {
  if (flawTags.length === 0) return null;
  return (
    <div className={styles.tagBlock}>
      <div className={styles.tagBlockLabel}>Flaw Tags that apply (−1 each, marks Potential either way):</div>
      {flawTags.map((t) => (
        <CheckboxRow key={t.key} checked={usedKeys.has(t.key)} disabled={usedKeys.has(t.key)} onToggle={() => onUse(t)}>
          {t.tag} <span className={styles.tagMotif}>({t.motifName})</span>
        </CheckboxRow>
      ))}
    </div>
  );
}

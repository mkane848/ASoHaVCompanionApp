import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import type { FlatTag } from './rollTags.js';
import styles from './HeroRollBuilder.module.css';

/** Flaw Tags that apply: −1 each. Outside Combat each one marks Potential on its Motif the moment
 *  it's ticked — which is why a tick is one-way there. In Combat nothing is marked per tag
 *  (`marksPotential` false), so a tick can be undone. */
export function FlawTagSection({
  flawTags,
  usedKeys,
  marksPotential = true,
  onUse,
}: {
  flawTags: FlatTag[];
  usedKeys: Set<string>;
  marksPotential?: boolean;
  onUse: (t: FlatTag) => void;
}) {
  if (flawTags.length === 0) return null;
  return (
    <div className={styles.tagBlock}>
      <div className={styles.tagBlockLabel}>
        {marksPotential ? 'Flaw Tags that apply (−1 each, marks Potential either way):' : 'Flaw Tags that apply (−1 each; in Combat, Potential is marked when Combat ends):'}
      </div>
      {flawTags.map((t) => (
        <CheckboxRow key={t.key} checked={usedKeys.has(t.key)} disabled={marksPotential && usedKeys.has(t.key)} onToggle={() => onUse(t)}>
          {t.tag} <span className={styles.tagMotif}>({t.motifName})</span>
        </CheckboxRow>
      ))}
    </div>
  );
}

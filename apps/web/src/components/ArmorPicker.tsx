import type { CharacterArmor, Library, StrainTag } from '@asohav/shared';
import { armorFit } from '@asohav/shared';
import styles from './ArmorPicker.module.css';

/** The ready Armor boxes a Hero may mark against one Strain hit, each checked against the GM's tag
 *  on it (`armorFit`): one the tag rules out is disabled and says why, one the app can't judge
 *  (untagged hit, or a Special Armor listing no effects) stays selectable with a "table's call"
 *  note. Shared by the sheet's Take Strain modal and Combat's Defend step. */
export function ArmorPicker({
  armor,
  library,
  tag,
  value,
  onChange,
  label,
}: {
  armor: CharacterArmor[];
  library: Library;
  tag: StrainTag | undefined;
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
}) {
  return (
    <div className={`board ${styles.picker}`} role="group" aria-label={label}>
      {armor.map((a) => {
        const type = library.armorTypes.find((t) => t.Id === a.ArmorTypeId);
        const fit = type ? armorFit(type.Key, tag, a.Effects) : 'unsure';
        const effects = (a.Effects ?? []).filter((e) => e.trim());
        const why =
          fit === 'blocked'
            ? type?.Key === 'Heavy'
              ? "Heavy Armor only stops Strain on the body, and this isn't."
              : "This Armor doesn't list the hit's effect."
            : fit === 'unsure'
              ? type?.Key === 'Special' && !tag
                ? "The GM didn't tag this hit — the table decides if it stops it."
                : type?.Key === 'Special'
                  ? 'No effects are listed on this Armor — the table decides.'
                  : "The GM didn't say where this hit lands — the table decides."
              : '';
        return (
          <div key={a.Id} className={styles.item}>
            <button
              type="button"
              aria-pressed={value === a.Id}
              disabled={fit === 'blocked'}
              className={`tap-inline posting ${styles.button} ${value === a.Id ? styles.active : ''}`}
              onClick={() => onChange(value === a.Id ? null : a.Id)}
            >
              {type?.Name ?? a.ArmorTypeId} {a.SourceLabel && `(${a.SourceLabel})`}
              {type?.Key === 'Special' && effects.length > 0 && <span className={styles.effects}> · stops {effects.join(', ')}</span>}
            </button>
            {why && <p className={styles.why}>{why}</p>}
          </div>
        );
      })}
    </div>
  );
}

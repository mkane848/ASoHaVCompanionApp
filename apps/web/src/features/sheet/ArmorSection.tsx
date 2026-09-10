import { useState } from 'react';
import type { CharacterSheet, Library } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { InfoTooltip } from '../../components/InfoTooltip.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './ArmorSection.module.css';

/** Armor, rendered as an integrated sub-section of StatusesPanel rather than its own Panel —
 *  marking Armor Used negates incoming Strain entirely (V0.6 slice 1; was a Status before), so
 *  the controls live together. See the "Architecture: Wealth, Treasure..." / Statuses section
 *  notes in CLAUDE.md. */
export function ArmorSection({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const [confirming, setConfirming] = useState(false);
  const matcher = useGlossaryMatcher();

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <div className={styles.label}>Armor</div>
        <button className={`tap ${styles.refresh}`} onClick={() => setConfirming(true)}>
          Refresh all
        </button>
      </div>
      <p className={styles.intro}>
        Any time you would take Strain, mark an appropriate box to negate it completely. Camp refreshes every box at once.
      </p>
      <div className="board">
        {sheet.Armor.map((a) => {
          const t = library.armorTypes.find((x) => x.Id === a.ArmorTypeId);
          return (
            <div key={a.Id} className={`posting tilt ${styles.row}`}>
              <button
                className={`tap ${styles.box} ${a.Used ? styles.boxUsed : ''}`}
                onClick={() => commit((d) => { const x = d.Armor.find((y) => y.Id === a.Id); if (x) x.Used = !x.Used; })}
              >
                {a.Used ? '×' : ''}
              </button>
              <div className={styles.naming}>
                <div className={styles.name}>
                  {t?.Name ?? a.ArmorTypeId}{' '}
                  {t?.Description && <InfoTooltip label={t.Name}><GlossaryText text={t.Description} matcher={matcher} /></InfoTooltip>}
                </div>
                <div className={styles.source}>from {a.SourceLabel || '—'}</div>
              </div>
              <span className={`${styles.state} ${a.Used ? styles.stateUsed : ''}`}>{a.Used ? 'Spent' : 'Ready'}</span>
            </div>
          );
        })}
      </div>

      {confirming && (
        <ConfirmModal
          title="Refresh all Armor?"
          body="This marks every Armor box on this sheet as Ready again, even ones you've spent this session."
          confirmLabel="Refresh all"
          onConfirm={() => {
            commit((d) => { d.Armor.forEach((a) => { a.Used = false; }); });
            setConfirming(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

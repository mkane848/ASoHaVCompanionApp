import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import styles from './ArmorPanel.module.css';

export function ArmorPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  return (
    <Panel collapseId="armor">
      <PanelHeader
        extra={
          <button className={`tap ${styles.refresh}`} onClick={() => commit((d) => { d.Armor.forEach((a) => { a.Used = false; }); })}>
            Refresh all
          </button>
        }
      >
        Armor
      </PanelHeader>
      <p className={styles.intro}>
        Any time you would take a Status, mark an appropriate box to negate it completely. Camp refreshes every box at once.
      </p>
      {sheet.Armor.map((a) => {
        const t = library.armorTypes.find((x) => x.Id === a.ArmorTypeId);
        return (
          <div key={a.Id} className={styles.row}>
            <button
              className={`tap ${styles.box} ${a.Used ? styles.boxUsed : ''}`}
              onClick={() => commit((d) => { const x = d.Armor.find((y) => y.Id === a.Id); if (x) x.Used = !x.Used; })}
            >
              {a.Used ? '×' : ''}
            </button>
            <div className={styles.naming}>
              <div className={styles.name}>{t?.Name ?? a.ArmorTypeId}</div>
              <div className={styles.source}>from {a.SourceLabel || '—'}</div>
            </div>
            <span className={`${styles.state} ${a.Used ? styles.stateUsed : ''}`}>{a.Used ? 'Spent' : 'Ready'}</span>
          </div>
        );
      })}
    </Panel>
  );
}

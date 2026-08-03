import type { CharacterSheet, Library } from '@asohav/shared';
import { carriedLoad, loadCapacityFor } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { Pips } from './Pips.js';
import styles from './LoadPanel.module.css';

export function LoadPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const might = sheet.Virtues.find((v) => v.VirtueId === 'v-might')?.Score ?? 0;
  const carried = carriedLoad(sheet, library.items);
  const cap = loadCapacityFor(sheet.Load.Tier, library.loadTiers, might);
  const over = carried > cap;
  const currentTierNote = library.loadTiers.find((t) => t.Key === sheet.Load.Tier)?.Note;

  return (
    <Panel id="p-load" collapseId="load" primary>
      <PanelHeader>Load &amp; Item Charges</PanelHeader>
      <div className={styles.tiers}>
        {library.loadTiers.map((t) => {
          const selected = sheet.Load.Tier === t.Key;
          return (
            <button
              key={t.Key}
              className={`${styles.tier} ${selected ? styles.tierSelected : ''}`}
              onClick={() => commit((d) => { d.Load.Tier = t.Key; })}
            >
              <span className={styles.tierKey}>{t.Key}</span>
              <span className={styles.tierCap}>{t.Base + might}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.note}>{currentTierNote}</p>
      <div className={styles.carriedRow}>
        <span className={styles.carriedLabel}>On your person</span>
        <span className={`${styles.carriedValue} ${over ? styles.carriedOver : ''}`}>
          {carried} of {cap}
        </span>
      </div>
      {over && (
        <p className={styles.overWarning}>
          Over your chosen Load. The sheet won't stop you — but once you check your last Load box you can't use new items until you Make Camp.
        </p>
      )}
      <div className={styles.spacer} />
      {sheet.Items.map((ci) => {
        const it = library.items.find((x) => x.Id === ci.ItemId);
        if (!it) return null;
        const maxCharges = it.Charges ?? 0;
        return (
          <div key={ci.ItemId} className={`tap-row ${styles.item}`}>
            <button
              className={`tap ${styles.check} ${ci.Carried ? styles.checkCarried : ''}`}
              onClick={() => commit((d) => { const x = d.Items.find((y) => y.ItemId === ci.ItemId); if (x) x.Carried = !x.Carried; })}
            >
              {ci.Carried ? '✓' : ''}
            </button>
            <div className={styles.itemBody}>
              <div className={`${styles.itemName} ${ci.Carried ? '' : styles.itemNameDropped}`}>{it.Name}</div>
              <div className={styles.itemText}>{it.Description}</div>
            </div>
            {it.LoadCost === 0 ? (
              <span className={`${styles.cost} ${styles.costFree}`}>concealed</span>
            ) : (
              <span className={styles.cost}>{it.LoadCost} load</span>
            )}
            {maxCharges > 0 && (
              <Pips
                count={maxCharges}
                filled={ci.ChargesUsed}
                color="var(--danger)"
                size={15}
                onSet={(n) => commit((d) => { const x = d.Items.find((y) => y.ItemId === ci.ItemId); if (x) x.ChargesUsed = n; })}
              />
            )}
          </div>
        );
      })}
    </Panel>
  );
}

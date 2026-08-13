import type { CharacterSheet, Library } from '@asohav/shared';
import { carriedLoad, loadCapacityFor } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { Pips } from './Pips.js';
import { usePanelCollapseStore } from '../../store/panelCollapseStore.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './LoadPanel.module.css';

const itemCollapseKey = (itemId: string) => `load-item-${itemId}`;

export function LoadPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const matcher = useGlossaryMatcher();
  const might = sheet.Virtues.find((v) => v.VirtueId === 'v-might')?.Score ?? 0;
  const carried = carriedLoad(sheet, library.items);
  const cap = loadCapacityFor(sheet.Load.Tier, library.loadTiers, might);
  const over = carried > cap;
  const currentTierNote = library.loadTiers.find((t) => t.Key === sheet.Load.Tier)?.Note;

  const collapsedMap = usePanelCollapseStore((s) => s.collapsed);
  const setAllCollapsed = usePanelCollapseStore((s) => s.setAll);
  const toggleCollapsed = usePanelCollapseStore((s) => s.toggle);

  // Carried items first (so the gear you're actually using isn't buried below a long
  // pack list), alphabetical within each group — a character with a big inventory
  // otherwise scrolls past everything in whatever order items were added.
  const sortedItems = [...sheet.Items].sort((a, b) => {
    if (a.Carried !== b.Carried) return a.Carried ? -1 : 1;
    const an = library.items.find((x) => x.Id === a.ItemId)?.Name ?? '';
    const bn = library.items.find((x) => x.Id === b.ItemId)?.Name ?? '';
    return an.localeCompare(bn);
  });
  const itemKeys = sortedItems.map((ci) => itemCollapseKey(ci.ItemId));
  const allItemsCollapsed = itemKeys.length > 0 && itemKeys.every((k) => collapsedMap[k]);

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
      <p className={`prose ${styles.note}`}>{currentTierNote}</p>
      <div className={styles.carriedRow}>
        <span className={styles.carriedLabel}>On your person</span>
        <span className={`${styles.carriedValue} ${over ? styles.carriedOver : ''}`}>
          {carried} of {cap}
        </span>
      </div>
      {over && (
        <p className={`prose ${styles.overWarning}`}>
          Over your chosen Load. The sheet won't stop you — but once you check your last Load box you can't use new items until you Make Camp.
        </p>
      )}
      <div className={styles.spacer} />
      {itemKeys.length > 0 && (
        <button
          type="button"
          className={`tap-inline ${styles.itemsToolbar}`}
          onClick={() => setAllCollapsed(itemKeys, !allItemsCollapsed)}
        >
          {allItemsCollapsed ? 'Expand all items' : 'Collapse all items'}
        </button>
      )}
      {sortedItems.map((ci) => {
        const it = library.items.find((x) => x.Id === ci.ItemId);
        if (!it) return null;
        const maxCharges = it.Charges ?? 0;
        const key = itemCollapseKey(ci.ItemId);
        const collapsed = !!collapsedMap[key];
        return (
          <div key={ci.ItemId} className={styles.item}>
            <div className={`tap-row ${styles.itemHead}`}>
              <button
                className={`tap ${styles.check} ${ci.Carried ? styles.checkCarried : ''}`}
                onClick={() => commit((d) => { const x = d.Items.find((y) => y.ItemId === ci.ItemId); if (x) x.Carried = !x.Carried; })}
              >
                {ci.Carried ? '✓' : ''}
              </button>
              <button
                type="button"
                className={`tap-inline ${styles.itemToggle}`}
                onClick={() => toggleCollapsed(key)}
                aria-expanded={!collapsed}
              >
                <span aria-hidden className={`${styles.chevron} ${collapsed ? styles.chevronCollapsed : ''}`}>▾</span>
                <span className={`${styles.itemName} ${ci.Carried ? '' : styles.itemNameDropped}`}>{it.Name}</span>
              </button>
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
            {!collapsed && it.Description && (
              <div className={styles.itemDetails}>
                <div className={`prose ${styles.itemText}`}><GlossaryText text={it.Description} matcher={matcher} /></div>
              </div>
            )}
          </div>
        );
      })}
    </Panel>
  );
}

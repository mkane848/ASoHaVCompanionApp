import { useState } from 'react';
import type { CharacterSheet, Library } from '@asohav/shared';
import { applyLoadTierBoonBane, carriedLoad, loadCapacityFor, newId } from '@asohav/shared';
import { Panel, PanelHeader, PlayLockedNote, sheetWriter, type SheetWriteProps } from './Panel.js';
import { Pips } from './Pips.js';
import { usePanelCollapseStore } from '../../store/panelCollapseStore.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { InlineEdit } from '../../components/InlineEdit.js';
import styles from './LoadPanel.module.css';

const itemCollapseKey = (itemId: string) => `load-item-${itemId}`;

/** Choosing a Load tier and what's carried is Kit — character building — so it stays open before
 *  play. `playLocked` disables the two things that happen in the fiction: declaring a wildcard item
 *  on the fly, and spending an item's Charges. `readOnly` (the GM's peek) renders every value as
 *  text; only the item fold toggles stay, and those fold in this instance only. */
export function LoadPanel(props: { sheet: CharacterSheet; library: Library; playLocked?: boolean } & SheetWriteProps) {
  const { sheet, library, playLocked = false } = props;
  const readOnly = props.readOnly === true;
  const commit = sheetWriter(props);
  /** Wildcard declarations render as text rather than editors whenever they can't be edited. */
  const wildcardsLocked = readOnly || playLocked;
  const matcher = useGlossaryMatcher();
  const [justAddedWildcardId, setJustAddedWildcardId] = useState<string | null>(null);
  const might = sheet.Virtues.find((v) => v.VirtueId === 'v-might')?.Score ?? 0;
  const carried = carriedLoad(sheet, library.items);
  const cap = loadCapacityFor(sheet.Load.Tier, library.loadTiers, might);
  const over = carried > cap;
  const full = carried >= cap;
  const currentTierNote = library.loadTiers.find((t) => t.Key === sheet.Load.Tier)?.Note;

  const storedCollapsed = usePanelCollapseStore((s) => s.collapsed);
  const storeSetAll = usePanelCollapseStore((s) => s.setAll);
  const storeToggle = usePanelCollapseStore((s) => s.toggle);
  // The peek folds items locally, for the same reason Panel's `localCollapse` does: these keys are
  // shared with the player's own sheet on the same browser.
  const [localCollapsed, setLocalCollapsed] = useState<Record<string, boolean>>({});
  const collapsedMap = readOnly ? localCollapsed : storedCollapsed;
  function setAllCollapsed(ids: string[], value: boolean) {
    if (!readOnly) { storeSetAll(ids, value); return; }
    setLocalCollapsed((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, value])) }));
  }
  function toggleCollapsed(id: string) {
    if (!readOnly) { storeToggle(id); return; }
    setLocalCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function declareWildcard() {
    const id = newId('wc');
    commit((d) => { d.WildcardDeclarations = [...d.WildcardDeclarations, { Id: id, Text: '', Persistent: false }]; });
    setJustAddedWildcardId(id);
  }
  function renameWildcard(id: string, text: string) {
    setJustAddedWildcardId(null);
    commit((d) => { const w = d.WildcardDeclarations.find((x) => x.Id === id); if (w) w.Text = text; });
  }
  function togglePersistent(id: string) {
    commit((d) => { const w = d.WildcardDeclarations.find((x) => x.Id === id); if (w) w.Persistent = !w.Persistent; });
  }
  function removeWildcard(id: string) {
    commit((d) => { d.WildcardDeclarations = d.WildcardDeclarations.filter((x) => x.Id !== id); });
  }

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
    <Panel id="p-load" collapseId="load" localCollapse={readOnly} primary>
      <PanelHeader>Load &amp; Item Charges</PanelHeader>
      <div className={styles.body}>
        <div className={styles.capacity}>
          <div className={styles.tiers}>
            {library.loadTiers.map((t) => {
              const selected = sheet.Load.Tier === t.Key;
              if (readOnly) {
                return (
                  <div key={t.Key} className={`${styles.tier} ${selected ? styles.tierSelected : ''}`} aria-current={selected ? 'true' : undefined}>
                    <span className={styles.tierKey}>{t.Key}</span>
                    <span className={styles.tierCap}>{t.Base + might}</span>
                  </div>
                );
              }
              return (
                <button
                  key={t.Key}
                  className={`${styles.tier} ${selected ? styles.tierSelected : ''}`}
                  onClick={() => commit((d) => { d.Load.Tier = t.Key; applyLoadTierBoonBane(d, t.Key); })}
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
          {!over && full && (
            <p className={`prose ${styles.overWarning}`}>
              No Load free. You can still declare one more item — running out should create a complication, not just a stop. The table
              decides what.
            </p>
          )}
        </div>
        <div className={`board ${styles.items}`}>
          <div className={styles.wildcardSection}>
            <div className={styles.itemsToolbar}>Wildcard items</div>
            <p className={`prose ${styles.note}`}>
              An unused Load box is a wildcard — declare a reasonable item on the fly. An ordinary one returns to the ether at your next
              Make Camp; mark a named, magical, or plot-relevant one Persistent and it keeps permanently costing this box.
            </p>
            {/* Declaring an item and spending a Charge (below) are this panel's only play actions,
                so its one note sits here, beside the first of them. */}
            {playLocked && !readOnly && <PlayLockedNote />}
            {readOnly && sheet.WildcardDeclarations.length === 0 && <p className={`prose ${styles.note}`}>None declared.</p>}
            {sheet.WildcardDeclarations.map((w) =>
              wildcardsLocked ? (
                <div key={w.Id} className={`posting ${styles.wildcardRow}`}>
                  <span className={`${styles.wildcardName} ${w.Text ? '' : styles.wildcardUnnamed}`}>{w.Text || 'Unnamed item'}</span>
                  <span className={`${styles.persistentToggle} ${w.Persistent ? styles.persistentToggleOn : ''}`}>
                    {w.Persistent ? 'Persistent' : 'Ordinary'}
                  </span>
                </div>
              ) : (
                <div key={w.Id} className={`posting ${styles.wildcardRow}`}>
                  <InlineEdit
                    className={styles.wildcardName}
                    value={w.Text}
                    placeholder="Declare an item…"
                    ariaLabel="Wildcard item"
                    startEditing={w.Id === justAddedWildcardId}
                    onCommit={(next) => renameWildcard(w.Id, next)}
                  />
                  <button
                    type="button"
                    className={`tap-inline ${styles.persistentToggle} ${w.Persistent ? styles.persistentToggleOn : ''}`}
                    onClick={() => togglePersistent(w.Id)}
                    aria-pressed={w.Persistent}
                  >
                    {w.Persistent ? 'Persistent' : 'Ordinary'}
                  </button>
                  <button
                    type="button"
                    className={`tap-inline ${styles.remove}`}
                    onClick={() => removeWildcard(w.Id)}
                    title="Remove this item"
                    aria-label={`Remove wildcard item: ${w.Text || 'unnamed'}`}
                  >
                    &times;
                  </button>
                </div>
              ),
            )}
            {!readOnly && (
              <button type="button" className={`tap-inline ${styles.itemsToolbar}`} disabled={playLocked} onClick={declareWildcard}>
                + Declare an item
              </button>
            )}
          </div>
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
              <div key={ci.ItemId} className={`posting tilt ${styles.item}`}>
                <div className={`tap-row ${styles.itemHead}`}>
                  {readOnly ? (
                    /* The name beside it is dimmed when dropped, but that's colour alone — so the
                       mark carries its own accessible name. */
                    <span
                      className={`${styles.check} ${styles.checkStatic} ${ci.Carried ? styles.checkCarried : ''}`}
                      role="img"
                      aria-label={ci.Carried ? 'Carried' : 'Not carried'}
                    >
                      {ci.Carried ? '✓' : ''}
                    </span>
                  ) : (
                    <button
                      className={`tap ${styles.check} ${ci.Carried ? styles.checkCarried : ''}`}
                      onClick={() => commit((d) => { const x = d.Items.find((y) => y.ItemId === ci.ItemId); if (x) x.Carried = !x.Carried; })}
                    >
                      {ci.Carried ? '✓' : ''}
                    </button>
                  )}
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
                      label={`${it.Name} Charges used`}
                      disabled={playLocked}
                      readOnly={readOnly}
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
        </div>
      </div>
    </Panel>
  );
}

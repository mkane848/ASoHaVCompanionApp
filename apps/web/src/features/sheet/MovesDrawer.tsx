import type { Library, Move, MoveResults } from '@asohav/shared';
import { useSheetUiStore } from '../../store/sheetUiStore.js';
import { usePanelCollapseStore } from '../../store/panelCollapseStore.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './MovesDrawer.module.css';

const TIER_LABELS: Record<keyof MoveResults, string> = { Tier3: 'On a 10+', Tier2: 'On a 7–9', Tier1: 'On a miss' };
const TIER_ORDER: (keyof MoveResults)[] = ['Tier3', 'Tier2', 'Tier1'];

const groupCollapseKey = (key: string) => `moves-group-${key}`;

function groupKeyFor(m: Move): string {
  return m.VirtueId ?? (m.Kind === 'Adventure' ? 'adventure' : 'any');
}

function groupLabelFor(key: string, library: Library): string {
  if (key === 'adventure') return 'Adventure';
  if (key === 'any') return 'Any';
  return library.virtues.find((v) => v.Id === key)?.Name ?? key;
}

export function MovesDrawer({ library, open, onClose }: { library: Library; open: boolean; onClose: () => void }) {
  const { moveQuery: query, setMoveQuery: setQuery, moveVirtueFilter, setMoveVirtueFilter } = useSheetUiStore();
  const matcher = useGlossaryMatcher();
  const collapsedMap = usePanelCollapseStore((s) => s.collapsed);
  const toggleCollapsed = usePanelCollapseStore((s) => s.toggle);
  if (!open) return null;

  // Stable regardless of the search text, so the filter row doesn't jump around while typing.
  const allGroupKeys = [...library.virtues.map((v) => v.Id), 'adventure', 'any'].filter((key) =>
    library.moves.some((m) => groupKeyFor(m) === key),
  );

  const q = query.toLowerCase();
  const searched = library.moves.filter((m) => !q || m.Name.toLowerCase().includes(q) || m.Description.toLowerCase().includes(q));

  const groups = allGroupKeys
    .filter((key) => !moveVirtueFilter || key === moveVirtueFilter)
    .map((key) => ({ key, label: groupLabelFor(key, library), moves: searched.filter((m) => groupKeyFor(m) === key) }))
    .filter((g) => g.moves.length > 0);

  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.head}>
          <h2 className={styles.title}>The Moves</h2>
          <button className={`tap ${styles.close}`} onClick={onClose}>
            &times;
          </button>
        </div>
        <div className={styles.body}>
          <input className={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search moves…" />

          <div className={`tap-row ${styles.filterRow}`}>
            <button
              className={`tap-inline ${styles.filterChip} ${!moveVirtueFilter ? styles.filterChipActive : ''}`}
              onClick={() => setMoveVirtueFilter(null)}
            >
              All
            </button>
            {allGroupKeys.map((key) => (
              <button
                key={key}
                className={`tap-inline ${styles.filterChip} ${moveVirtueFilter === key ? styles.filterChipActive : ''}`}
                onClick={() => setMoveVirtueFilter(moveVirtueFilter === key ? null : key)}
              >
                {groupLabelFor(key, library)}
              </button>
            ))}
          </div>

          {groups.length === 0 && <p className={styles.empty}>No moves match.</p>}

          {groups.map((g) => {
            const key = groupCollapseKey(g.key);
            const collapsed = !!collapsedMap[key];
            return (
              <div key={g.key} className={styles.group}>
                <button
                  type="button"
                  className={`tap-inline ${styles.groupHead}`}
                  onClick={() => toggleCollapsed(key)}
                  aria-expanded={!collapsed}
                >
                  <span aria-hidden className={`${styles.chevron} ${collapsed ? styles.chevronCollapsed : ''}`}>▾</span>
                  <span className={styles.groupTitle}>{g.label}</span>
                  <span className={styles.groupCount}>{g.moves.length}</span>
                </button>
                {!collapsed &&
                  g.moves.map((m) => (
                    <div key={m.Id} className={styles.move}>
                      <div className={styles.moveHead}>
                        <span className={styles.moveName}>{m.Name}</span>
                      </div>
                      <p className={styles.moveText}><GlossaryText text={m.Description} matcher={matcher} /></p>
                      {TIER_ORDER.map((k) => {
                        const r = m.Results[k];
                        return (
                          <div key={k} className={styles.tier}>
                            <div className={styles.tierLabel}>{TIER_LABELS[k]}</div>
                            <div className={styles.tierText}><GlossaryText text={r.Description} matcher={matcher} /></div>
                            {r.Options.map((o, i) => (
                              <div key={i} className={styles.option}>
                                <GlossaryText text={o} matcher={matcher} />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {m.PlayerVariantResults && (
                        <div className={styles.variant}>
                          <div className={styles.variantLabel}>On a Player</div>
                          {TIER_ORDER.map((k) => {
                            const r = m.PlayerVariantResults![k];
                            return (
                              <div key={k} className={styles.tierTight}>
                                <div className={styles.tierLabel}>{TIER_LABELS[k]}</div>
                                <div className={styles.tierText}><GlossaryText text={r.Description} matcher={matcher} /></div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

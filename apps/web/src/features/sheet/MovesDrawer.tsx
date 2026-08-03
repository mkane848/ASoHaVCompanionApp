import type { Library, MoveResults } from '@asohav/shared';
import { useSheetUiStore } from '../../store/sheetUiStore.js';
import styles from './MovesDrawer.module.css';

const TIER_LABELS: Record<keyof MoveResults, string> = { Tier3: 'On a 10+', Tier2: 'On a 7–9', Tier1: 'On a miss' };
const TIER_ORDER: (keyof MoveResults)[] = ['Tier3', 'Tier2', 'Tier1'];

export function MovesDrawer({ library, open, onClose }: { library: Library; open: boolean; onClose: () => void }) {
  const { moveQuery: query, setMoveQuery: setQuery } = useSheetUiStore();
  if (!open) return null;

  const q = query.toLowerCase();
  const moves = library.moves.filter((m) => !q || m.Name.toLowerCase().includes(q) || m.Description.toLowerCase().includes(q));

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
          {moves.map((m) => {
            const virtue = m.VirtueId ? library.virtues.find((v) => v.Id === m.VirtueId) : null;
            const virtueLabel = virtue ? virtue.Name : m.Kind === 'Adventure' ? 'Adventure' : 'Any';
            return (
              <div key={m.Id} className={styles.move}>
                <div className={styles.moveHead}>
                  <span className={styles.moveName}>{m.Name}</span>
                  <span className={styles.virtue}>{virtueLabel}</span>
                </div>
                <p className={styles.moveText}>{m.Description}</p>
                {TIER_ORDER.map((k) => {
                  const r = m.Results[k];
                  return (
                    <div key={k} className={styles.tier}>
                      <div className={styles.tierLabel}>{TIER_LABELS[k]}</div>
                      <div className={styles.tierText}>{r.Description}</div>
                      {r.Options.map((o, i) => (
                        <div key={i} className={styles.option}>
                          {o}
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
                          <div className={styles.tierText}>{r.Description}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

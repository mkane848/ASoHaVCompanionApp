import type { Library, MoveResults } from '@asohav/shared';
import { useSheetUiStore } from '../../store/sheetUiStore.js';

const TIER_LABELS: Record<keyof MoveResults, string> = { Tier3: 'On a 10+', Tier2: 'On a 7–9', Tier1: 'On a miss' };
const TIER_ORDER: (keyof MoveResults)[] = ['Tier3', 'Tier2', 'Tier1'];

export function MovesDrawer({ library, open, onClose }: { library: Library; open: boolean; onClose: () => void }) {
  const { moveQuery: query, setMoveQuery: setQuery } = useSheetUiStore();
  if (!open) return null;

  const q = query.toLowerCase();
  const moves = library.moves.filter((m) => !q || m.Name.toLowerCase().includes(q) || m.Description.toLowerCase().includes(q));

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(42,32,26,.42)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 'min(560px, 100%)', background: 'var(--panel)', borderLeft: '2px solid var(--gold)', overflowY: 'auto', animation: 'fadeUp .18s ease-out' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--panel)', borderBottom: '1px solid var(--rule)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, margin: 0, flex: 1 }}>The Moves</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 24, lineHeight: 1, color: 'var(--ink-45)', padding: '0 4px' }}>
            &times;
          </button>
        </div>
        <div style={{ padding: '14px 20px 60px' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search moves…"
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule-field)', fontSize: 14, padding: '7px 0', marginBottom: 14, outline: 'none' }}
          />
          {moves.map((m) => {
            const virtue = m.VirtueId ? library.virtues.find((v) => v.Id === m.VirtueId) : null;
            const virtueLabel = virtue ? virtue.Name : m.Kind === 'Adventure' ? 'Adventure' : 'Any';
            return (
              <div key={m.Id} style={{ padding: '14px 0', borderBottom: '1px solid var(--rule)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>{m.Name}</span>
                  <span style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold-dark)', border: '1px solid var(--gold-line)', padding: '1px 6px' }}>{virtueLabel}</span>
                </div>
                <p style={{ margin: '6px 0 10px', fontSize: 13, color: 'rgba(42,32,26,.78)' }}>{m.Description}</p>
                {TIER_ORDER.map((k) => {
                  const r = m.Results[k];
                  return (
                    <div key={k} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>{TIER_LABELS[k]}</div>
                      <div style={{ fontSize: 12.5, color: 'rgba(42,32,26,.8)' }}>{r.Description}</div>
                      {r.Options.map((o, i) => (
                        <div key={i} style={{ fontSize: 12.5, color: 'rgba(42,32,26,.7)', paddingLeft: 12, borderLeft: '1px solid var(--gold-line)', marginTop: 3 }}>
                          {o}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {m.PlayerVariantResults && (
                  <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--gold-tint)', border: '1px solid rgba(157,124,51,.22)' }}>
                    <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold-dark)', marginBottom: 5 }}>On a Player</div>
                    {TIER_ORDER.map((k) => {
                      const r = m.PlayerVariantResults![k];
                      return (
                        <div key={k} style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>{TIER_LABELS[k]}</div>
                          <div style={{ fontSize: 12.5, color: 'rgba(42,32,26,.8)' }}>{r.Description}</div>
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

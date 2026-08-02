import type { CharacterSummary, Library } from '@asohav/shared';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export function PeekCard({ summary, library }: { summary: CharacterSummary; library: Library }) {
  const dishonored = summary.ConditionsMarked.length >= 5;
  const loadOver = summary.Load.Carried > summary.Load.Capacity;

  return (
    <div style={{ flex: '1 1 330px', background: 'var(--panel)', border: '1px solid var(--rule)', borderTop: '2px solid var(--gold)', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 2 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>{summary.Name}</span>
        <span style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>{summary.PlayerName}</span>
      </div>
      <div style={{ fontSize: 11.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--gold-dark)', marginBottom: 10 }}>{summary.Theme}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 11 }}>
        {library.virtues.map((v) => {
          const vv = summary.Virtues.find((x) => x.VirtueId === v.Id);
          if (!vv) return null;
          return (
            <div key={v.Id} style={{ textAlign: 'center', minWidth: 44 }}>
              <div style={{ fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>{v.Name}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: vv.ConditionMarked ? 'var(--danger)' : undefined }}>{sign(vv.Score)}</div>
            </div>
          );
        })}
      </div>

      {summary.ConditionsMarked.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 7 }}>Conditions: {summary.ConditionsMarked.join(', ')}</div>
      )}
      {dishonored && (
        <div style={{ display: 'inline-block', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--panel)', background: 'var(--danger)', padding: '2px 8px', marginBottom: 7 }}>
          Dishonored
        </div>
      )}

      {summary.Statuses.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
          {summary.Statuses.map((s) => (
            <span
              key={s.Id}
              style={
                s.Polarity === 'Positive'
                  ? { fontSize: 11, color: 'var(--gold-dark)', border: '1px solid var(--gold-line)', padding: '2px 7px' }
                  : { fontSize: 11, color: 'var(--danger)', border: '1px solid var(--danger-line)', padding: '2px 7px' }
              }
            >
              {s.Name} {s.Rank}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11.5, color: 'var(--ink-55)', borderTop: '1px solid var(--rule-soft)', paddingTop: 8 }}>
        <span style={loadOver ? { color: 'var(--danger)' } : undefined}>
          Load {summary.Load.Carried} / {summary.Load.Capacity}
          {loadOver ? ' · over' : ''}
        </span>
        <span>Armor {summary.ArmorReady} / {summary.ArmorTotal}</span>
        <span>Potential {summary.Potential} / 5</span>
      </div>
    </div>
  );
}

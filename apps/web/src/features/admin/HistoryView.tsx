import type { ChangeLogEntry } from '@asohav/shared';

type Entry = ChangeLogEntry & { Diffs: { field: string; before: string; after: string }[] };

export function HistoryView({ entries }: { entries: Entry[] }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, margin: '0 0 4px' }}>Change history</h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-55)', fontStyle: 'italic', margin: '0 0 18px' }}>Every write, most recent first.</p>
      {entries.map((h) => (
        <div key={h.Id} style={{ padding: '12px 0', borderBottom: '1px solid var(--rule)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--gold-dark)', border: '1px solid var(--gold-line)', padding: '1px 6px' }}>{h.Action}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>{h.ObjectName}</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-45)' }}>{h.Collection}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-45)' }}>
              {h.Who} &middot; {new Date(h.At).toLocaleString()}
            </span>
          </div>
          {h.Diffs.slice(0, 8).map((d, i) => (
            <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, marginTop: 5, paddingLeft: 12, borderLeft: '2px solid var(--gold-line)' }}>
              <span style={{ minWidth: 120, color: 'var(--ink-55)' }}>{d.field}</span>
              <span style={{ color: 'var(--danger)', textDecoration: 'line-through', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.before}</span>
              <span style={{ color: 'var(--ink)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.after}</span>
            </div>
          ))}
        </div>
      ))}
      {entries.length === 0 && <p style={{ fontSize: 13, color: 'var(--ink-45)', fontStyle: 'italic' }}>No changes recorded yet.</p>}
    </div>
  );
}

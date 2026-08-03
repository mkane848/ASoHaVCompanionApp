import { useState } from 'react';
import type { CollectionDef, Library } from '@asohav/shared';
import { subtitleFor } from './adminHelpers.js';

export function AdminListPane({
  col,
  library,
  selectedId,
  onOpen,
  onCreateNew,
  onBack,
}: {
  col: CollectionDef;
  library: Library;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onCreateNew: () => void;
  /** Only supplied on the narrow drill-down, where this pane replaces the nav. */
  onBack?: () => void;
}) {
  const [search, setSearch] = useState('');
  const items = ((library as any)[col.key] as any[]) ?? [];
  const q = search.toLowerCase();
  const rows = items.filter((o) => !q || (o.Name || '').toLowerCase().includes(q));

  return (
    <div className="admin-pane admin-list">
      {onBack && (
        <button
          className="tap-inline"
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 12, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--ink-25)', color: 'rgba(42,32,26,.7)', padding: '7px 12px' }}
        >
          &larr; Game objects
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, margin: 0, flex: 1 }}>{col.label}</h2>
        <button className="tap" onClick={onCreateNew} style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: '6px 11px' }}>
          New
        </button>
      </div>
      <input
        className="tap-inline"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule-field)', fontSize: 13, padding: '6px 0', marginBottom: 10, outline: 'none' }}
      />
      {rows.map((r) => {
        const selected = selectedId === r.Id;
        return (
          <button
            key={r.Id}
            onClick={() => onOpen(r.Id)}
            style={
              selected
                ? { width: '100%', textAlign: 'left', padding: '9px 10px', marginBottom: 3, border: '1px solid var(--gold)', background: 'var(--gold-tint)' }
                : { width: '100%', textAlign: 'left', padding: '9px 10px', marginBottom: 3, border: '1px solid transparent', borderBottom: '1px solid var(--rule-soft)', background: 'transparent' }
            }
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>{r.Name || '(unnamed)'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-55)' }}>{subtitleFor(col.key, r, library)}</div>
          </button>
        );
      })}
      {rows.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--ink-45)', fontStyle: 'italic' }}>Nothing here yet.</p>}
    </div>
  );
}

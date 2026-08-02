import { collections, type Library } from '@asohav/shared';

export function DataView({
  library,
  onExport,
  onImport,
  onReset,
}: {
  library: Library;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, margin: '0 0 4px' }}>Import &amp; export</h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-55)', fontStyle: 'italic', margin: '0 0 18px' }}>
        The whole content library as one JSON file. This is the format the server stores and what the GM tooling will read.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        <button onClick={onExport} style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: '9px 16px' }}>
          Export library
        </button>
        <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--ink-28)', color: 'rgba(42,32,26,.7)', padding: '9px 16px', cursor: 'pointer' }}>
          Import library
          <input type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
        </label>
        <button onClick={onReset} style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--danger-line)', color: 'var(--danger)', padding: '9px 16px' }}>
          Reset to seed
        </button>
      </div>
      <div style={{ padding: '14px 16px', background: 'var(--panel)', border: '1px solid var(--rule)' }}>
        <div style={{ fontSize: 10.5, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--ink-45)', marginBottom: 7 }}>Library contents</div>
        {collections.map((c) => (
          <div key={c.key} style={{ display: 'flex', fontSize: 12.5, padding: '2px 0' }}>
            <span style={{ flex: 1 }}>{c.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-55)' }}>{((library as any)[c.key] as any[])?.length ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

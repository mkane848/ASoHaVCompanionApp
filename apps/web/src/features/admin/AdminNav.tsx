import { collections, type Library } from '@asohav/shared';

export type AdminView = 'settings' | 'history' | 'validation' | 'data' | (string & {});

export function AdminNav({
  view,
  onSelect,
  library,
  changeCount,
  issueCount,
}: {
  view: AdminView;
  onSelect: (v: AdminView) => void;
  library: Library;
  changeCount: number;
  issueCount: number;
}) {
  const tools: { key: AdminView; label: string; count: number | '' }[] = [
    { key: 'settings', label: 'Settings', count: '' },
    { key: 'history', label: 'History', count: changeCount },
    { key: 'validation', label: 'Validation', count: issueCount },
    { key: 'data', label: 'Import / export', count: '' },
  ];

  return (
    <div className="admin-pane admin-nav">
      <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-45)', padding: '0 16px 6px' }}>Game objects</div>
      {collections.map((c) => (
        <NavButton key={c.key} active={view === c.key} onClick={() => onSelect(c.key)} label={c.label} count={(library as any)[c.key]?.length ?? 0} />
      ))}
      <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-45)', padding: '16px 16px 6px' }}>Tools</div>
      {tools.map((t) => (
        <NavButton key={t.key} active={view === t.key} onClick={() => onSelect(t.key)} label={t.label} count={t.count} />
      ))}
    </div>
  );
}

function NavButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number | string }) {
  return (
    <button
      className="tap-inline"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '7px 16px',
        border: 'none',
        borderLeft: active ? '3px solid var(--gold)' : '3px solid transparent',
        background: active ? 'var(--gold-tint)' : 'transparent',
        color: active ? 'var(--ink)' : 'rgba(42,32,26,.72)',
        fontSize: 13,
        display: 'flex',
        gap: 8,
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ opacity: 0.5, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
    </button>
  );
}

import { collections, type Library } from '@asohav/shared';
import styles from './AdminNav.module.css';

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
      <div className={styles.groupLabel}>Game objects</div>
      {collections.map((c) => (
        <NavButton key={c.key} active={view === c.key} onClick={() => onSelect(c.key)} label={c.label} count={(library as any)[c.key]?.length ?? 0} />
      ))}
      <div className={`${styles.groupLabel} ${styles.groupLabelSpaced}`}>Tools</div>
      {tools.map((t) => (
        <NavButton key={t.key} active={view === t.key} onClick={() => onSelect(t.key)} label={t.label} count={t.count} />
      ))}
    </div>
  );
}

function NavButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number | string }) {
  return (
    <button className={`${styles.navButton} ${active ? styles.navButtonActive : ''}`} onClick={onClick}>
      <span className={styles.navLabel}>{label}</span>
      <span className={styles.navCount}>{count}</span>
    </button>
  );
}

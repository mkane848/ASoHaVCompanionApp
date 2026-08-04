import { collections, type Library } from '@asohav/shared';
import styles from './AdminNav.module.css';

export type AdminView = 'settings' | 'history' | 'validation' | 'data' | (string & {});

/** Synthetic nav keys for the two Advancement tracks — there's one real `advancements`
 *  collection underneath, filtered by `Track`. See resolveAdminView() in AdminPanelPage.tsx,
 *  which is what actually understands these keys; this file just needs to render them. */
export const ADVANCEMENT_TRACK_VIEWS: Record<string, 'Potential' | 'Rapport'> = {
  'advancements-potential': 'Potential',
  'advancements-rapport': 'Rapport',
};

const labelFor = (key: string) => collections.find((c) => c.key === key)?.label ?? key;

// Alphabetical within each group, per the reorganized menu structure. Advancements and Tools
// are built inline below since their items either aren't real collections (Tools) or split one
// collection into two (Advancements).
const CORE_KEYS = ['abilities', 'armorTypes', 'conditions', 'items', 'moves', 'skills', 'virtues'];
const NARRATIVE_KEYS = ['quests', 'themes'];

type NavItem = { key: AdminView; label: string; count: number | '' };

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
  const countFor = (key: string) => (library as any)[key]?.length ?? 0;
  const advancements = (library as any).advancements as { Track: 'Potential' | 'Rapport' }[] | undefined;

  const core: NavItem[] = CORE_KEYS.map((key) => ({ key, label: labelFor(key), count: countFor(key) }));
  const narrative: NavItem[] = NARRATIVE_KEYS.map((key) => ({ key, label: labelFor(key), count: countFor(key) }));
  const advancement: NavItem[] = [
    { key: 'advancements-potential', label: 'Potential', count: (advancements ?? []).filter((a) => a.Track === 'Potential').length },
    { key: 'advancements-rapport', label: 'Rapport', count: (advancements ?? []).filter((a) => a.Track === 'Rapport').length },
  ];
  // Alphabetical: History, Import / export, Settings, Validation.
  const tools: NavItem[] = [
    { key: 'history', label: 'History', count: changeCount },
    { key: 'data', label: 'Import / export', count: '' },
    { key: 'settings', label: 'Settings', count: '' },
    { key: 'validation', label: 'Validation', count: issueCount },
  ];

  const groups: { label: string; items: NavItem[] }[] = [
    { label: 'Core', items: core },
    { label: 'Narrative', items: narrative },
    { label: 'Advancements', items: advancement },
    { label: 'Tools', items: tools },
  ];

  return (
    <div className="admin-pane admin-nav">
      {groups.map((g, i) => (
        <div key={g.label}>
          <div className={`${styles.groupLabel} ${i > 0 ? styles.groupLabelSpaced : ''}`}>{g.label}</div>
          {g.items.map((item) => (
            <NavButton key={item.key} active={view === item.key} onClick={() => onSelect(item.key)} label={item.label} count={item.count} />
          ))}
        </div>
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

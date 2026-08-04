import { collections, type Library } from '@asohav/shared';
import styles from './AdminNav.module.css';

export type AdminView = 'settings' | 'history' | 'validation' | 'data' | (string & {});

/** Synthetic nav keys for the Potential/Rapport Advancement tracks — there's one real
 *  `advancements` collection underneath, filtered by `Track`. See resolveAdminView() in
 *  AdminPanelPage.tsx, which is what actually understands these keys; this file just needs to
 *  render them. Kin is a real Advancement track too (see AdvancementTrack in
 *  packages/shared/src/types.ts) but has no authored library content — its nav key
 *  ('advancements-kin') isn't in this map, so it resolves to no collection and renders
 *  KinAdvancementView instead of an AdminListPane. */
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
  userCount,
  campaignCount,
  characterCount,
}: {
  view: AdminView;
  onSelect: (v: AdminView) => void;
  library: Library;
  changeCount: number;
  issueCount: number;
  userCount?: number;
  campaignCount?: number;
  characterCount?: number;
}) {
  const countFor = (key: string) => (library as any)[key]?.length ?? 0;
  const advancements = (library as any).advancements as { Track: 'Potential' | 'Rapport' }[] | undefined;

  const core: NavItem[] = CORE_KEYS.map((key) => ({ key, label: labelFor(key), count: countFor(key) }));
  const narrative: NavItem[] = NARRATIVE_KEYS.map((key) => ({ key, label: labelFor(key), count: countFor(key) }));
  const advancement: NavItem[] = [
    { key: 'advancements-kin', label: 'Kin', count: '' },
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
  const accounts: NavItem[] = [{ key: 'admin-users', label: 'Users', count: userCount ?? '' }];
  // "Play Data" is deliberately separate from the Core/Narrative library-content groups above —
  // these are play-state rows (campaigns, characters), not authored game content.
  const playData: NavItem[] = [
    { key: 'admin-campaigns', label: 'Campaigns', count: campaignCount ?? '' },
    { key: 'admin-characters', label: 'Character Sheets', count: characterCount ?? '' },
  ];

  const groups: { label: string; items: NavItem[] }[] = [
    { label: 'Core', items: core },
    { label: 'Narrative', items: narrative },
    { label: 'Advancements', items: advancement },
    { label: 'Accounts', items: accounts },
    { label: 'Play Data', items: playData },
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

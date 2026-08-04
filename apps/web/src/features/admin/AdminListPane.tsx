import { useState } from 'react';
import type { CollectionDef, Library } from '@asohav/shared';
import { subtitleFor } from './adminHelpers.js';
import styles from './AdminListPane.module.css';

export function AdminListPane({
  col,
  title,
  trackFilter,
  library,
  selectedId,
  onOpen,
  onCreateNew,
  onBack,
}: {
  col: CollectionDef;
  /** Defaults to col.label — overridden for the Advancements split (Potential/Rapport), where
   *  "Advancements" would be less useful than the actual track name. */
  title?: string;
  /** Set only for the Advancements split — filters the one shared `advancements` collection
   *  down to the track this nav item represents. */
  trackFilter?: 'Potential' | 'Rapport';
  library: Library;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onCreateNew: () => void;
  /** Only supplied on the narrow drill-down, where this pane replaces the nav. */
  onBack?: () => void;
}) {
  const [search, setSearch] = useState('');
  const items = (((library as any)[col.key] as any[]) ?? []).filter((o) => !trackFilter || o.Track === trackFilter);
  const q = search.toLowerCase();
  const rows = items.filter((o) => !q || (o.Name || '').toLowerCase().includes(q));

  return (
    <div className="admin-pane admin-list">
      {onBack && (
        <button className={styles.back} onClick={onBack}>
          &larr; Menu
        </button>
      )}
      <div className={styles.head}>
        <h2 className={styles.title}>{title ?? col.label}</h2>
        <button className={`tap ${styles.new}`} onClick={onCreateNew}>
          New
        </button>
      </div>
      <input
        className={`tap-inline ${styles.search}`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
      />
      {rows.map((r) => {
        const selected = selectedId === r.Id;
        return (
          <button key={r.Id} className={`${styles.row} ${selected ? styles.rowSelected : ''}`} onClick={() => onOpen(r.Id)}>
            <div className={styles.rowName}>{r.Name || '(unnamed)'}</div>
            <div className={styles.rowSubtitle}>{subtitleFor(col.key, r, library)}</div>
          </button>
        );
      })}
      {rows.length === 0 && <p className={styles.empty}>Nothing here yet.</p>}
    </div>
  );
}

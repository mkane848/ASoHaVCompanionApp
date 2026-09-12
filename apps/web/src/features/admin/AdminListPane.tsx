import { useState } from 'react';
import type { CollectionDef, FieldDef, Library } from '@asohav/shared';
import { rowsOf, subtitleFor, type LibRow } from './adminHelpers.js';
import styles from './AdminListPane.module.css';

type SortKey = 'name' | 'nameDesc' | 'recent';

/** The one field a collection is worth filtering by, picked from the schema rather than a
 *  per-collection lookup table: the first enum or ref it declares. That lands on Moves' `Kind`,
 *  Improvements' `TreeId`, Enemies' `Toughness`, NPCs' `Type` — and on nothing at all for the
 *  collections where no field carves the list up usefully, which is the right answer for those.
 *  A new collection gets its filter for free, the same way it already gets its CRUD. */
function filterFieldFor(col: CollectionDef): FieldDef | null {
  return col.fields.find((f) => f.type === 'enum' || f.type === 'ref') ?? null;
}

/** Every value worth matching a search against — the whole record's authored prose, not just its
 *  Name. Searching `Name` alone was the shipped behaviour until 0.51.0, which made the glossary
 *  (whose Definitions are the entire point) and the 22 Moves effectively unsearchable. */
function searchableText(col: CollectionDef, row: LibRow): string {
  const parts: string[] = [String(row.Name ?? ''), String(row.Id ?? '')];
  for (const f of col.fields) {
    const v = row[f.name];
    if (v == null) continue;
    if (f.type === 'text' || f.type === 'textarea' || f.type === 'enum') parts.push(String(v));
    else if (f.type === 'taglist' && Array.isArray(v)) parts.push(v.join(' '));
  }
  return parts.join(' ').toLowerCase();
}

export function AdminListPane({
  col,
  library,
  selectedId,
  recentIds,
  onOpen,
  onCreateNew,
  onBack,
}: {
  col: CollectionDef;
  library: Library;
  selectedId: string | null;
  /** Object Ids in most-recently-changed-first order, from the changelog. Powers the "Recently
   *  changed" sort — the one ordering that can't be derived from the records themselves. */
  recentIds: string[];
  onOpen: (id: string) => void;
  onCreateNew: () => void;
  /** Only supplied on the narrow drill-down, where this pane replaces the nav. */
  onBack?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [sort, setSort] = useState<SortKey>('name');

  const items = rowsOf(library, col.key);
  const filterField = filterFieldFor(col);

  const filterOptions: { value: string; label: string }[] = !filterField
    ? []
    : filterField.type === 'enum'
      ? (filterField.options ?? []).map((o) => ({ value: o, label: o }))
      : rowsOf(library, filterField.collection as string).map((o) => ({ value: o.Id, label: o.Name || o.Id }));

  const q = search.trim().toLowerCase();
  let rows = items.filter((o) => {
    if (q && !searchableText(col, o).includes(q)) return false;
    if (filterField && filterValue && String(o[filterField.name] ?? '') !== filterValue) return false;
    return true;
  });

  rows = [...rows].sort((a, b) => {
    if (sort === 'recent') {
      // Anything the changelog has never seen sorts after everything it has, rather than to the
      // top — an untouched record is the opposite of recently changed.
      const ai = recentIds.indexOf(a.Id);
      const bi = recentIds.indexOf(b.Id);
      return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
    }
    const cmp = String(a.Name ?? '').localeCompare(String(b.Name ?? ''));
    return sort === 'nameDesc' ? -cmp : cmp;
  });

  const narrowed = rows.length !== items.length;

  return (
    <div className="admin-pane admin-list">
      {onBack && (
        <button className={styles.back} onClick={onBack}>
          &larr; Menu
        </button>
      )}
      <div className={styles.head}>
        <h2 className={styles.title}>{col.label}</h2>
        <button className={`tap ${styles.new}`} onClick={onCreateNew}>
          New
        </button>
      </div>
      <input
        className={`tap-inline ${styles.search}`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${col.label.toLowerCase()}…`}
        aria-label={`Search ${col.label}`}
      />

      <div className={styles.controls}>
        {filterField && filterOptions.length > 0 && (
          <select
            className={`tap-inline ${styles.control}`}
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            aria-label={`Filter by ${filterField.label ?? filterField.name}`}
          >
            <option value="">All {(filterField.label ?? filterField.name).toLowerCase()}</option>
            {filterOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        <select
          className={`tap-inline ${styles.control}`}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort"
        >
          <option value="name">Name A–Z</option>
          <option value="nameDesc">Name Z–A</option>
          <option value="recent">Recently changed</option>
        </select>
      </div>

      {narrowed && (
        <div className={styles.count}>
          {rows.length} of {items.length}
        </div>
      )}

      {rows.map((r) => {
        const selected = selectedId === r.Id;
        return (
          <button key={r.Id} className={`${styles.row} ${selected ? styles.rowSelected : ''}`} onClick={() => onOpen(r.Id)}>
            <div className={styles.rowName}>{r.Name || '(unnamed)'}</div>
            <div className={styles.rowSubtitle}>{subtitleFor(col.key, r, library)}</div>
          </button>
        );
      })}
      {rows.length === 0 && (
        <p className={styles.empty}>{items.length === 0 ? 'Nothing here yet.' : 'Nothing matches.'}</p>
      )}
    </div>
  );
}

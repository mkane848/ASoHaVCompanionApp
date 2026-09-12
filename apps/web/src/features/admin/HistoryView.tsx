import type { ChangeLogEntry, Library } from '@asohav/shared';
import { rowsOf } from './adminHelpers.js';
import shared from './adminShared.module.css';
import styles from './HistoryView.module.css';

type Entry = ChangeLogEntry & { Diffs: { field: string; before: string; after: string }[] };

/** Whether a record with this entry's Id is live in the library right now. A delete whose Id has
 *  since been taken again can't be restored — two records under one Id would make every ref to it
 *  resolve arbitrarily — and the server refuses it, so the button says so instead of offering a
 *  click that can only fail. */
function isLive(library: Library, entry: Entry): boolean {
  return rowsOf(library, entry.Collection).some((x) => x.Id === entry.ObjectId);
}

export function HistoryView({
  entries,
  library,
  onRestore,
}: {
  entries: Entry[];
  library: Library;
  onRestore: (entry: Entry) => void;
}) {
  return (
    <div>
      <h2 className={shared.viewTitle}>Change history</h2>
      <p className={shared.viewIntro}>Every write, most recent first.</p>
      {entries.map((h) => {
        /* Every delete has always stored the whole record here as `Before`; nothing read it, so
           "there is no undo" was true only by omission. A restore puts it back under its original
           Id, which is what keeps the refs that pointed at it working. */
        const restorable = h.Action === 'delete' && Boolean(h.Before);
        const live = restorable && isLive(library, h);
        return (
          <div key={h.Id} className={styles.entry}>
            <div className={styles.head}>
              <span className={styles.action}>{h.Action}</span>
              <span className={styles.objectName}>{h.ObjectName}</span>
              <span className={styles.collection}>{h.Collection}</span>
              <span className={styles.who}>
                {h.Who} &middot; {new Date(h.At).toLocaleString()}
              </span>
              {restorable &&
                (live ? (
                  <span className={styles.restored}>Back in the library</span>
                ) : (
                  <button className={styles.restore} onClick={() => onRestore(h)}>
                    Restore
                  </button>
                ))}
            </div>
            {h.Diffs.slice(0, 8).map((d, i) => (
              <div key={i} className={styles.diff}>
                <span className={styles.diffField}>{d.field}</span>
                <span className={styles.diffBefore}>{d.before}</span>
                <span className={styles.diffAfter}>{d.after}</span>
              </div>
            ))}
          </div>
        );
      })}
      {entries.length === 0 && <p className={styles.empty}>No changes recorded yet.</p>}
    </div>
  );
}

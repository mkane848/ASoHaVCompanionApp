import type { ChangeLogEntry } from '@asohav/shared';
import shared from './adminShared.module.css';
import styles from './HistoryView.module.css';

type Entry = ChangeLogEntry & { Diffs: { field: string; before: string; after: string }[] };

export function HistoryView({ entries }: { entries: Entry[] }) {
  return (
    <div>
      <h2 className={shared.viewTitle}>Change history</h2>
      <p className={shared.viewIntro}>Every write, most recent first.</p>
      {entries.map((h) => (
        <div key={h.Id} className={styles.entry}>
          <div className={styles.head}>
            <span className={styles.action}>{h.Action}</span>
            <span className={styles.objectName}>{h.ObjectName}</span>
            <span className={styles.collection}>{h.Collection}</span>
            <span className={styles.who}>
              {h.Who} &middot; {new Date(h.At).toLocaleString()}
            </span>
          </div>
          {h.Diffs.slice(0, 8).map((d, i) => (
            <div key={i} className={styles.diff}>
              <span className={styles.diffField}>{d.field}</span>
              <span className={styles.diffBefore}>{d.before}</span>
              <span className={styles.diffAfter}>{d.after}</span>
            </div>
          ))}
        </div>
      ))}
      {entries.length === 0 && <p className={styles.empty}>No changes recorded yet.</p>}
    </div>
  );
}

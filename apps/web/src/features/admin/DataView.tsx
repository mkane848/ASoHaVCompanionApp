import { collections, type Library } from '@asohav/shared';
import shared from './adminShared.module.css';
import styles from './DataView.module.css';

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
      <h2 className={shared.viewTitle}>Import &amp; export</h2>
      <p className={shared.viewIntro}>
        The whole content library as one JSON file. This is the format the server stores and what the GM tooling will read.
      </p>
      <div className={styles.actions}>
        <button className={shared.primaryButton} onClick={onExport}>
          Export library
        </button>
        <label className={styles.buttonImport}>
          Import library
          <input
            className={styles.hiddenInput}
            type="file"
            accept="application/json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }}
          />
        </label>
        <button className={styles.buttonDanger} onClick={onReset}>
          Reset to seed
        </button>
      </div>
      <div className={styles.summary}>
        <div className={styles.summaryLabel}>Library contents</div>
        {collections.map((c) => (
          <div key={c.key} className={styles.summaryRow}>
            <span className={styles.summaryName}>{c.label}</span>
            <span className={styles.summaryCount}>{((library as any)[c.key] as any[])?.length ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

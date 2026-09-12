import { useState } from 'react';
import { collections, type Library } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { rowsOf } from './adminHelpers.js';
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
  /* Both of these replace the entire library in one request and neither had a confirm until
     0.51.0. Reset is the worse of the two: its changelog entry stores `Before: null`, so unlike a
     record delete there is genuinely nothing to restore from afterward. */
  const [confirming, setConfirming] = useState<'reset' | null>(null);
  const [pendingImport, setPendingImport] = useState<File | null>(null);

  const authoredTotal = collections.reduce((n, c) => n + rowsOf(library, c.key).length, 0);

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
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingImport(f); e.target.value = ''; }}
          />
        </label>
        <button className={styles.buttonDanger} onClick={() => setConfirming('reset')}>
          Reset to seed
        </button>
      </div>
      <div className={styles.summary}>
        <div className={styles.summaryLabel}>Library contents</div>
        {collections.map((c) => (
          <div key={c.key} className={styles.summaryRow}>
            <span className={styles.summaryName}>{c.label}</span>
            <span className={styles.summaryCount}>{rowsOf(library, c.key).length}</span>
          </div>
        ))}
      </div>

      {confirming === 'reset' && (
        <ConfirmModal
          title="Reset the library to seed content?"
          body={`This replaces all ${authoredTotal} authored records across ${collections.length} collections with the seed data shipped in the code. Every edit made through this panel is lost, and unlike deleting a single record the changelog keeps no copy to restore from. There is no undo.`}
          confirmLabel={`Replace all ${authoredTotal} records`}
          onConfirm={() => { setConfirming(null); onReset(); }}
          onCancel={() => setConfirming(null)}
        />
      )}

      {pendingImport && (
        <ConfirmModal
          title="Replace the library with this file?"
          body={`"${pendingImport.name}" replaces all ${authoredTotal} authored records outright — this is not a merge. The server only checks that the file has virtues and moves, so a partial export will still be accepted and will drop whatever it omits.`}
          confirmLabel="Replace library"
          onConfirm={() => { const f = pendingImport; setPendingImport(null); onImport(f); }}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  );
}

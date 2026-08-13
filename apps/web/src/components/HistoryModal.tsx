import type { GlossaryMatcher } from '@asohav/shared';
import { useModalA11y } from '../lib/useModalA11y.js';
import { GlossaryText } from './GlossaryText.js';
import modal from '../styles/modal.module.css';
import styles from './HistoryModal.module.css';

export interface HistoryEntry {
  label: string;
  detail?: string;
  when: string;
}

/** Shared "game history" display (0.24.0) — Potential/Rapport/per-Bond history used to render
 *  inline on the sheet at all times; per repo-owner feedback ("let's try to use modals when we
 *  can for 'game history' type information displays"), it's now a trigger + this modal at all
 *  three call sites (AdvancementPanel.tsx). Built on the shared `modal.module.css` shell and
 *  `useModalA11y` like every other dialog in the app — extend, don't fork, if a fourth history
 *  display shows up (see CLAUDE.md's "Every modal shares focus-trap..." note). */
export function HistoryModal({
  title,
  entries,
  matcher,
  onClose,
}: {
  title: string;
  entries: HistoryEntry[];
  matcher: GlossaryMatcher | null;
  onClose: () => void;
}) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="history-title" className={modal.title}>{title}</h2>
          <p className={modal.subtitle}>{entries.length === 1 ? '1 entry' : `${entries.length} entries`}, most recent first.</p>
        </div>
        <div className={styles.body}>
          {entries.map((e, i) => (
            <div key={i} className={styles.row}>
              <span className={styles.label}>{e.label}</span>
              {e.detail && <span className={styles.meta}><GlossaryText text={e.detail} matcher={matcher} /></span>}
              <span className={styles.meta}>{new Date(e.when).toLocaleString()}</span>
            </div>
          ))}
          {entries.length === 0 && <p className={styles.empty}>Nothing here yet.</p>}
        </div>
        <div className={styles.footer}>
          <button className={`tap-inline ${modal.secondaryAction}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

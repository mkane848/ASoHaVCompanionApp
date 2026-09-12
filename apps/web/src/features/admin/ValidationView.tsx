import { getCollection, type ValidationIssue } from '@asohav/shared';
import shared from './adminShared.module.css';
import styles from './ValidationView.module.css';

export function ValidationView({ issues, onOpen }: { issues: ValidationIssue[]; onOpen: (issue: ValidationIssue) => void }) {
  return (
    <div>
      <h2 className={shared.viewTitle}>Validation</h2>
      <p className={shared.viewIntro}>
        Broken references and empty required fields. Nothing here blocks you — the sheet tolerates all of it.
      </p>
      {issues.map((v, i) => {
        /* Every issue already carries the collection and Id of the record it's about, so the one
           thing this view was missing was a way to act on it: finding the offending record meant
           reading the name off the issue, walking the nav to its collection and searching for it
           by hand. A non-collection issue (settings) has nowhere to jump to, so it stays a
           plain row rather than a button that goes nowhere. */
        const target = getCollection(v.collection);
        const body = (
          <>
            <div className={styles.issueName}>
              {v.objectName} <span className={styles.issueLabel}>{v.label}</span>
            </div>
            <div className={styles.issueMessage}>{v.message}</div>
          </>
        );
        return target ? (
          <button key={i} className={styles.issueLink} onClick={() => onOpen(v)}>
            {body}
          </button>
        ) : (
          <div key={i} className={styles.issue}>
            {body}
          </div>
        );
      })}
      {issues.length === 0 && <p className={styles.clean}>Every reference resolves and every required field is filled.</p>}
    </div>
  );
}

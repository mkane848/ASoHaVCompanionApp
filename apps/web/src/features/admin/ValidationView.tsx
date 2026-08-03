import type { ValidationIssue } from '@asohav/shared';
import shared from './adminShared.module.css';
import styles from './ValidationView.module.css';

export function ValidationView({ issues }: { issues: ValidationIssue[] }) {
  return (
    <div>
      <h2 className={shared.viewTitle}>Validation</h2>
      <p className={shared.viewIntro}>
        Broken references and empty required fields. Nothing here blocks you — the sheet tolerates all of it.
      </p>
      {issues.map((v, i) => (
        <div key={i} className={styles.issue}>
          <div className={styles.issueName}>
            {v.objectName} <span className={styles.issueLabel}>{v.label}</span>
          </div>
          <div className={styles.issueMessage}>{v.message}</div>
        </div>
      ))}
      {issues.length === 0 && <p className={styles.clean}>Every reference resolves and every required field is filled.</p>}
    </div>
  );
}

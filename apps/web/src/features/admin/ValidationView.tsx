import type { ValidationIssue } from '@asohav/shared';

export function ValidationView({ issues }: { issues: ValidationIssue[] }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, margin: '0 0 4px' }}>Validation</h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-55)', fontStyle: 'italic', margin: '0 0 18px' }}>
        Broken references and empty required fields. Nothing here blocks you — the sheet tolerates all of it.
      </p>
      {issues.map((v, i) => (
        <div key={i} style={{ padding: '10px 12px', marginBottom: 6, background: 'var(--danger-tint)', borderLeft: '2px solid var(--danger-line)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>
            {v.objectName} <span style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>{v.label}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(42,32,26,.72)' }}>{v.message}</div>
        </div>
      ))}
      {issues.length === 0 && <p style={{ fontSize: 13, color: 'var(--gold-dark)' }}>Every reference resolves and every required field is filled.</p>}
    </div>
  );
}

import { useState } from 'react';
import type { Invite } from '@asohav/shared';

export function InvitesPanel({ invites, onSend, onRevoke }: { invites: Invite[]; onSend: (email: string) => void; onRevoke: (id: string) => void }) {
  const [email, setEmail] = useState('');

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--rule)', padding: '16px 18px' }}>
      <div className="tap-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <input
          className="tap-inline"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="player@example.com"
          style={{ flex: 1, minWidth: 200, background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule-field)', fontSize: 13.5, padding: '6px 0', outline: 'none' }}
        />
        <button
          className="tap-inline"
          onClick={() => { if (email.trim()) { onSend(email.trim()); setEmail(''); } }}
          style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: '8px 15px' }}
        >
          Send invite
        </button>
      </div>
      {invites.map((i) => (
        <div key={i.Id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--rule-soft)' }}>
          <span className="wrap-anywhere" style={{ flex: 1, minWidth: 160, fontSize: 13.5 }}>{i.Email}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold-dark)', border: '1px solid var(--gold-line)', padding: '2px 8px' }}>{i.Code}</span>
          <span style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>{i.Status}</span>
          <button className="tap" onClick={() => onRevoke(i.Id)} style={{ background: 'transparent', border: 'none', color: 'var(--ink-38)', fontSize: 17, lineHeight: 1, padding: '0 4px' }}>&times;</button>
        </div>
      ))}
      {invites.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-45)', fontStyle: 'italic' }}>No invites outstanding.</p>}
    </div>
  );
}

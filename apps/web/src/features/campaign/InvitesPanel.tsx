import { useState } from 'react';
import type { Invite } from '@asohav/shared';
import styles from './InvitesPanel.module.css';

export function InvitesPanel({ invites, onSend, onRevoke }: { invites: Invite[]; onSend: (email: string) => void; onRevoke: (id: string) => void }) {
  const [email, setEmail] = useState('');

  return (
    <div className={styles.panel}>
      <div className={`tap-row ${styles.form}`}>
        <input
          className={`tap-inline ${styles.email}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="player@example.com"
        />
        <button
          className={`tap-inline ${styles.send}`}
          onClick={() => { if (email.trim()) { onSend(email.trim()); setEmail(''); } }}
        >
          Send invite
        </button>
      </div>
      {invites.map((i) => (
        <div key={i.Id} className={styles.row}>
          <span className={`wrap-anywhere ${styles.rowEmail}`}>{i.Email}</span>
          <span className={styles.code}>{i.Code}</span>
          <span className={styles.status}>{i.Status}</span>
          <button className={`tap ${styles.revoke}`} onClick={() => onRevoke(i.Id)}>&times;</button>
        </div>
      ))}
      {invites.length === 0 && <p className={styles.empty}>No invites outstanding.</p>}
    </div>
  );
}

import { useState } from 'react';
import type { Invite } from '@asohav/shared';
import type { InviteDelivery } from '../../lib/api.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { Toast } from '../../components/Toast.js';
import styles from './InvitesPanel.module.css';

/** A friendly line for the transient Toast fed by a `delivery` result (0.37.0, Issue 17) — the
 *  code/link stays authoritative regardless of what this says, so a failure reads as "share it by
 *  hand" rather than as something blocking. */
function deliveryMessage(delivery: InviteDelivery, email: string): { text: string; tone: 'status' | 'error' } {
  if (delivery.delivered) {
    const via = delivery.via === 'supabase' ? 'Supabase' : 'Resend';
    return { text: `Invite emailed to ${email} (via ${via}).`, tone: 'status' };
  }
  return { text: `Couldn't email ${email} automatically${delivery.error ? ` (${delivery.error})` : ''} — share the code or link by hand.`, tone: 'error' };
}

export function InvitesPanel({
  invites,
  onSend,
  onResend,
  onRevoke,
}: {
  invites: Invite[];
  onSend: (email: string) => Promise<InviteDelivery>;
  onResend: (id: string) => Promise<InviteDelivery>;
  onRevoke: (id: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'status' | 'error' } | null>(null);

  function inviteLink(invite: Invite): string {
    return `${window.location.origin}/?invite=${encodeURIComponent(invite.Code)}`;
  }

  async function copyLink(invite: Invite) {
    try {
      await navigator.clipboard.writeText(inviteLink(invite));
      setToast({ text: `Link copied for ${invite.Email}.`, tone: 'status' });
    } catch {
      setToast({ text: "Couldn't copy the link — copy it from the address bar after opening it, or share the code instead.", tone: 'error' });
    }
  }

  async function send() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setEmail('');
    const delivery = await onSend(trimmed);
    setToast(deliveryMessage(delivery, trimmed));
  }

  async function resend(invite: Invite) {
    setResendingId(invite.Id);
    try {
      const delivery = await onResend(invite.Id);
      setToast(deliveryMessage(delivery, invite.Email));
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={`tap-row ${styles.form}`}>
        <input
          className={`tap-inline ${styles.email}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="player@example.com"
        />
        <button className={`tap-inline ${styles.send}`} onClick={send}>
          Send invite
        </button>
      </div>
      {invites.map((i) => (
        <div key={i.Id} className={styles.item}>
          <div className={styles.row}>
            <span className={`wrap-anywhere ${styles.rowEmail}`}>{i.Email}</span>
            <span className={styles.code}>{i.Code}</span>
            <span className={styles.status}>{i.Status}</span>
            <button className={`tap ${styles.revoke}`} onClick={() => setRevoking(i)} aria-label={`Revoke invite to ${i.Email}`}>&times;</button>
          </div>
          <div className={`action-grid ${styles.actions}`}>
            <button type="button" className={`tap-inline ${styles.actionButton}`} onClick={() => copyLink(i)}>
              Copy link
            </button>
            {i.Status === 'Pending' && (
              <button type="button" className={`tap-inline ${styles.actionButton}`} disabled={resendingId === i.Id} onClick={() => resend(i)}>
                {resendingId === i.Id ? 'Resending…' : 'Resend'}
              </button>
            )}
          </div>
        </div>
      ))}
      {invites.length === 0 && <p className={styles.empty}>No invites outstanding.</p>}

      <Toast message={toast?.text ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />

      {revoking && (
        <ConfirmModal
          title="Revoke this invite?"
          body={`${revoking.Email} won't be able to use code ${revoking.Code} to join anymore.`}
          confirmLabel="Revoke invite"
          onConfirm={() => { onRevoke(revoking.Id); setRevoking(null); }}
          onCancel={() => setRevoking(null)}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { MyInvite } from '@asohav/shared';
import { api } from '../../lib/api.js';
import { useMyInvites } from '../../lib/useMyInvites.js';
import { Toast } from '../../components/Toast.js';
import styles from './InviteInbox.module.css';

export function InviteInbox() {
  const { data: invites, isLoading } = useMyInvites();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function afterJoin(campaignId: string) {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['me'] }),
      qc.invalidateQueries({ queryKey: ['invites', 'mine'] }),
    ]);
    navigate(`/c/${campaignId}`);
  }

  async function accept(invite: MyInvite) {
    setBusyId(invite.Id);
    setError(null);
    try {
      const { membership } = await api.invites.redeem(invite.Id);
      await afterJoin(membership.CampaignId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept that invite.');
    } finally {
      setBusyId(null);
    }
  }

  async function decline(invite: MyInvite) {
    setBusyId(invite.Id);
    setError(null);
    try {
      await api.invites.decline(invite.Id);
      await qc.invalidateQueries({ queryKey: ['invites', 'mine'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline that invite.');
    } finally {
      setBusyId(null);
    }
  }

  async function joinByCode() {
    const trimmed = code.trim();
    if (!trimmed || joining) return;
    setJoining(true);
    setError(null);
    try {
      const { membership } = await api.invites.redeemByCode(trimmed);
      setCode('');
      await afterJoin(membership.CampaignId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join with that code.');
    } finally {
      setJoining(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className={styles.panel}>
      {invites && invites.length > 0 && (
        <>
          <div className={styles.label}>Pending invites</div>
          {invites.map((invite) => (
            <div key={invite.Id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.campaignName}>{invite.CampaignName}</span>
                <span className={styles.code}>{invite.Code}</span>
              </div>
              <div className={`tap-row ${styles.actions}`}>
                <button className={`tap-inline ${styles.accept}`} disabled={busyId === invite.Id} onClick={() => accept(invite)}>
                  Accept
                </button>
                <button className={`tap-inline ${styles.decline}`} disabled={busyId === invite.Id} onClick={() => decline(invite)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <div className={styles.joinLabel}>Join a campaign</div>
      <div className={`tap-row ${styles.joinRow}`}>
        <input
          className={styles.joinInput}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') joinByCode(); }}
          placeholder="Invite code (e.g. ROAD-1234)…"
        />
        <button className={`tap-inline ${styles.joinButton}`} onClick={joinByCode} disabled={joining || !code.trim()}>
          {joining ? 'Joining…' : 'Join'}
        </button>
      </div>
      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}

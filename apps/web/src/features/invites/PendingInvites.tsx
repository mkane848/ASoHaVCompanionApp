import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { MyInvite } from '@asohav/shared';
import { api } from '../../lib/api.js';
import { useMyInvites } from '../../lib/useMyInvites.js';
import { Toast } from '../../components/Toast.js';
import styles from './PendingInvites.module.css';

/** Split out of the old InviteInbox (0.23.0) — pending invites are time-sensitive, so they stay
 *  above the home screen's campaign-tile grid; only the join-by-code input moved down into the
 *  bottom row (see JoinByCode.tsx). Renders nothing while loading or once there are no pending
 *  invites, rather than an empty panel taking up space above the grid. */
export function PendingInvites() {
  const { data: invites, isLoading } = useMyInvites();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
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

  if (isLoading || !invites || invites.length === 0) return null;

  return (
    <div className={styles.panel}>
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
      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}

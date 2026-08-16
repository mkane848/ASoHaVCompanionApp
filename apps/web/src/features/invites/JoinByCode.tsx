import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api } from '../../lib/api.js';
import { Toast } from '../../components/Toast.js';
import styles from './JoinByCode.module.css';

/** Split out of the old InviteInbox (0.23.0) — see PendingInvites.tsx. This half moved into the
 *  home screen's bottom row, sharing a line with "Start a new campaign". */
export function JoinByCode() {
  const qc = useQueryClient();
  const navigate = useNavigate();
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

  return (
    <div className={styles.panel}>
      <div className={styles.label}>Join a campaign</div>
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

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { MeResponse } from '@asohav/shared';
import { api } from '../lib/api.js';
import { PendingInvites } from '../features/invites/PendingInvites.js';
import { JoinByCode } from '../features/invites/JoinByCode.js';
import { CampaignTile } from '../features/campaign/CampaignTile.js';
import styles from './HomePage.module.css';

export default function HomePage({ me }: { me: MeResponse }) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function createCampaign() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      const { campaign } = await api.campaign.create(trimmed);
      await qc.invalidateQueries({ queryKey: ['me'] });
      setName('');
      navigate(`/c/${campaign.Id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the campaign.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.greeting}>Welcome, {me.user.Name}.</h1>
      <p className={styles.subtitle}>Your campaigns.</p>

      <PendingInvites />

      <div className={styles.grid}>
        {me.memberships.map((m) => (
          <CampaignTile key={m.Id} membership={m} />
        ))}
        {me.memberships.length === 0 && <p className={styles.empty}>No campaigns yet.</p>}
      </div>

      <div className={styles.bottomRow}>
        <JoinByCode />

        <div className={styles.createCard}>
          <div className={styles.createLabel}>Start a new campaign</div>
          <div className={`tap-row ${styles.createRow}`}>
            <input
              className={styles.createInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createCampaign(); }}
              placeholder="Campaign name…"
            />
            <button
              className={`tap-inline ${styles.createButton}`}
              onClick={createCampaign}
              disabled={creating || !name.trim()}
            >
              {creating ? 'Creating…' : 'Create campaign'}
            </button>
          </div>
          {error && <p className={styles.createError}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

import { Link, useParams } from 'react-router';
import { campaignPhase, type MeResponse } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { CombatPanel } from '../features/combat/CombatPanel.js';
import styles from './CombatPage.module.css';

/** Thin route wrapper around CombatPanel (0.23.0) — kept as a working deep link
 *  (/c/:campaignId/combat) even though Combat now also renders inline on CampaignPage, since
 *  that's the one URL worth bookmarking/sharing mid-session. Owns only this page's own chrome
 *  (back link, "Combat" heading, the archived note); CombatPanel owns the actual start-form/
 *  live-Encounter content, shared with CampaignPage's inline section. */
export default function CombatPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();

  if (isLoading || libLoading || !boot || !library || !campaignId) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.page}>
      <Link to={`/c/${campaignId}`} className={styles.back}>
        &larr; {boot.campaign.Name}
      </Link>
      <h1 className={styles.title}>Combat</h1>

      {boot.campaign.Status === 'Archived' && (
        <p className={styles.archivedNote}>This campaign is archived — Combat is frozen until it's unarchived.</p>
      )}

      {/* 0.38.0 hid Combat until a campaign is actually Playing, but only on CampaignPage's
          inline section — this route rendered CombatPanel at any phase until 0.50.0, so the
          gate was bypassable by typing the URL. The server has always refused POST /combat/start
          outside Playing (assertPlayingPhase), so this was a UI inconsistency rather than a data
          hole; it still defeated the point of the feature. */}
      {campaignPhase(boot.campaign) === 'Playing' ? (
        <CombatPanel me={me} campaignId={campaignId} boot={boot} library={library} />
      ) : (
        <p className={styles.archivedNote}>
          Combat opens once the GM starts play. This campaign is still in setup.
        </p>
      )}
    </div>
  );
}

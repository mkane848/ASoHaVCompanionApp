import { Link } from 'react-router-dom';
import type { MeResponse } from '@asohav/shared';
import styles from './CampaignTile.module.css';

type MembershipOverview = MeResponse['memberships'][number];

function formatLastPlayed(iso: string | null): string {
  if (!iso) return 'Never played';
  return `Last played ${new Date(iso).toLocaleDateString()}`;
}

/** One tile in the home screen's campaign grid (0.23.0) — replaces the old plain name/role/link
 *  card with GM, roster, Rapport, Kin (when there is any), and last played. Your own character is
 *  marked in the roster and doubles as the sheet link, so there's no separate "Open character
 *  sheet" button the way the old card had. All the data behind this comes pre-batched on
 *  MeResponse (see CampaignOverview) rather than a second round trip per tile. */
export function CampaignTile({ membership }: { membership: MembershipOverview }) {
  const overview = membership.Overview;

  return (
    <div className={styles.tile}>
      <div className={styles.head}>
        <span className={styles.name}>{membership.CampaignName}</span>
        {membership.CampaignStatus === 'Archived' && <span className={styles.archivedBadge}>Archived</span>}
        <span className={styles.role}>{membership.Role}</span>
      </div>

      {overview.GmName && <div className={styles.gm}>GM {overview.GmName}</div>}

      {overview.Roster.length > 0 && (
        <div className={styles.roster}>
          {overview.Roster.map((r) =>
            r.IsYou ? (
              <Link key={r.CharacterId} to={`/c/${membership.CampaignId}/sheet`} className={`tap-inline ${styles.rosterChip} ${styles.rosterChipYou}`}>
                {r.CharacterName}
              </Link>
            ) : (
              <span key={r.CharacterId} className={styles.rosterChip}>
                {r.CharacterName}
              </span>
            ),
          )}
        </div>
      )}

      <div className={styles.stats}>
        <span className={styles.stat}>Rapport {overview.Rapport} / 5</span>
        {overview.Kin.map((k) => (
          <span key={k.CharacterName} className={styles.stat}>
            Kin with {k.CharacterName} {k.KinTrack} / 5
          </span>
        ))}
      </div>

      <div className={styles.footer}>
        <span className={styles.lastPlayed}>{formatLastPlayed(overview.LastPlayedAt)}</span>
        <Link to={`/c/${membership.CampaignId}`} className={`tap-inline ${styles.link}`}>
          Open campaign
        </Link>
      </div>
    </div>
  );
}

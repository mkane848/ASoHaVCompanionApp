import { Link } from 'react-router';
import type { MeResponse } from '@asohav/shared';
import { queryClient } from '../../lib/queryClient.js';
import { api } from '../../lib/api.js';
import styles from './CampaignTile.module.css';

type MembershipOverview = MeResponse['memberships'][number];

function formatLastPlayed(iso: string | null): string {
  if (!iso) return 'Never played';
  return `Last played ${new Date(iso).toLocaleDateString()}`;
}

// Same key/queryFn as useBootstrap.ts, so a real click's useQuery call dedupes into this
// prefetch instead of firing a second request — the "loader prefetching" benefit
// TechStackAudit.md section A8 noted a router migration couldn't actually deliver here (App.tsx
// gates the whole tree on useMe() above the router), obtained instead with no migration at all
// (D4's optional second step). Fires on hover *or* focus so keyboard/touch users who never
// hover still get it on focus, just later than a mouse user does.
function prefetchBootstrap(campaignId: string) {
  queryClient.prefetchQuery({ queryKey: ['bootstrap', campaignId], queryFn: () => api.campaign.bootstrap(campaignId) });
}

/** One tile in the home screen's campaign grid (0.23.0) — replaces the old plain name/role/link
 *  card with GM, roster, Rapport, Bonds (when there are any), and last played. Your own character
 *  is marked in the roster and doubles as the sheet link, so there's no separate "Open character
 *  sheet" button the way the old card had. All the data behind this comes pre-batched on
 *  MeResponse (see CampaignOverview) rather than a second round trip per tile.
 *  `rapportTrackLength`/`bondTrackLength` come from the (global, campaign-independent) library
 *  singleton rather than the per-membership overview — see HomePage.tsx's call site. */
export function CampaignTile({
  membership,
  rapportTrackLength,
  bondTrackLength,
}: {
  membership: MembershipOverview;
  rapportTrackLength: number;
  bondTrackLength: number;
}) {
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
              <Link
                key={r.CharacterId}
                to={`/c/${membership.CampaignId}/sheet`}
                className={`tap-inline ${styles.rosterChip} ${styles.rosterChipYou}`}
                onMouseEnter={() => prefetchBootstrap(membership.CampaignId)}
                onFocus={() => prefetchBootstrap(membership.CampaignId)}
              >
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
        <span className={styles.stat}>Rapport {overview.Rapport} / {rapportTrackLength}</span>
        {overview.Bonds.map((b) => (
          <span key={b.CharacterName} className={styles.stat}>
            Bond with {b.CharacterName} {b.BondTrack} / {bondTrackLength}
          </span>
        ))}
      </div>

      <div className={styles.footer}>
        <span className={styles.lastPlayed}>{formatLastPlayed(overview.LastPlayedAt)}</span>
        <Link
          to={`/c/${membership.CampaignId}`}
          className={`tap-inline ${styles.link}`}
          onMouseEnter={() => prefetchBootstrap(membership.CampaignId)}
          onFocus={() => prefetchBootstrap(membership.CampaignId)}
        >
          Open campaign
        </Link>
      </div>
    </div>
  );
}

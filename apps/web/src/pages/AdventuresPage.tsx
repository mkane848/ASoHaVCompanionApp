import { Link, Navigate, useParams } from 'react-router';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { AdventuresPanel } from '../features/adventures/AdventuresPanel.js';
import styles from './AdventuresPage.module.css';

/** Adventure prep — the fourth surface (Ruleset-V0.5.md's "Adventures" chapter, slice 9),
 *  alongside the Character Sheet, Content Admin, and the Campaign Shell. GM-only end to end: a
 *  Player who navigates here directly is redirected back to the campaign, the same way this app
 *  has no other player-facing route for GM-only content — see CLAUDE.md's "Architecture:
 *  Adventures" for why an Adventure never gets even a partial player-facing view (unrevealed
 *  Secret text, in particular, is content this app never sends a Player at all, not just content
 *  the UI declines to show). `boot.adventures` is already empty for a Player (campaign.ts's
 *  bootstrap route only fetches it for a GM membership), so this redirect is a courtesy — the
 *  page would otherwise just render nothing useful — not the only thing enforcing the boundary. */
export default function AdventuresPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();

  if (isLoading || libLoading || !boot || !library || !campaignId) {
    return <div className={styles.loading}>Loading…</div>;
  }

  if (boot.membership.Role !== 'GM') {
    return <Navigate to={`/c/${campaignId}`} replace />;
  }

  return (
    <div className={styles.page}>
      <Link to={`/c/${campaignId}`} className={styles.back}>
        &larr; {boot.campaign.Name}
      </Link>
      <h1 className={styles.title}>Adventure Prep</h1>

      {boot.campaign.Status === 'Archived' && (
        <p className={styles.archivedNote}>This campaign is archived — Adventures are frozen until it's unarchived.</p>
      )}

      <AdventuresPanel campaignId={campaignId} boot={boot} library={library} />
    </div>
  );
}

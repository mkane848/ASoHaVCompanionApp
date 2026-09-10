import { Link, useParams } from 'react-router';
import { useBootstrap } from '../lib/useBootstrap.js';
import { WorldPanel } from '../features/world/WorldPanel.js';
import styles from './WorldPage.module.css';

/** Creating the World (V0.6 slice 8) — CATS plus the five-step (really six-section) collaborative
 *  map build, `Ruleset-V0.6.md`'s new chapter. Unlike Adventure Prep, this surface is for every
 *  campaign member, not GM-only — the doc's own framing has the whole table (GM included) build
 *  it together, so there's no role redirect here. See CLAUDE.md's "Architecture: Creating the
 *  World" for the full account, including why this app builds World before character creation
 *  rather than after, reversing the chapter's own narrated order. */
export default function WorldPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);

  if (isLoading || !boot || !campaignId) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.page}>
      <Link to={`/c/${campaignId}`} className={styles.back}>
        &larr; {boot.campaign.Name}
      </Link>
      <h1 className={styles.title}>Creating the World</h1>
      <WorldPanel campaignId={campaignId} boot={boot} />
    </div>
  );
}

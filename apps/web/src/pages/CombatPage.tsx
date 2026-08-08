import { Link, useParams } from 'react-router-dom';
import type { MeResponse } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import styles from './CombatPage.module.css';

/** Placeholder — Combat is real scope, deliberately deferred to its own build slice (see
 *  HANDOFF.md). This route exists now so nav/QA can click through the whole app while the rest
 *  of the rules engine lands underneath it. When it's built, it'll follow the doc's most recent
 *  combat draft (Combat Basics V2.2): AP-based turns, zipper initiative, Combat/Reaction Moves,
 *  Gambits, and enemy stat blocks with per-Status Limits and Toughness. */
export default function CombatPage(_props: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);

  if (isLoading || !boot) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.page}>
      <Link to={`/c/${campaignId}`} className={styles.back}>
        &larr; {boot.campaign.Name}
      </Link>
      <h1 className={styles.title}>Combat</h1>
      <p className={styles.comingSoon}>Coming soon</p>
      <p className={styles.body}>
        Combat is its own build slice — AP-based turns, Combat &amp; Reaction Moves, Gambits, and
        enemy stat blocks, following the game's Combat Basics draft. Everything outside of
        Combat (Moves, Statuses, Conditions, Advancement) already works from the Character Sheet
        and Campaign Shell; this page is a placeholder so the nav stays click-through-able while
        Combat is built out.
      </p>
    </div>
  );
}

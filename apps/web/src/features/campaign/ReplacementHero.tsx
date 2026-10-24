import { Link } from 'react-router';
import type { GmReplacementState } from '../../lib/replacementHero.js';
import styles from './ReplacementHero.module.css';

/** GM control on a Dead or Retired Hero's roster card. */
export function ReplacementHeroToggle({ state, busy, onOpen, onCancel }: { state: GmReplacementState; busy: boolean; onOpen: () => void; onCancel: () => void }) {
  if (state === 'none') return null;
  if (state === 'blocked') return <p className={styles.note}>A replacement Hero is already open for another player.</p>;
  if (state === 'open') {
    return (
      <div className={styles.row}>
        <span className={styles.note}>Replacement Hero open. Waiting for the player.</span>
        <button type="button" className={`tap-inline ${styles.button}`} disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    );
  }
  return (
    <div className={styles.row}>
      <button type="button" className={`tap-inline ${styles.button}`} disabled={busy} onClick={onOpen}>Open replacement Hero</button>
    </div>
  );
}

/** Shown to the player the GM opened it for. */
export function ReplacementHeroPrompt({ campaignId, heroName }: { campaignId: string; heroName: string | undefined }) {
  return (
    <div className={styles.prompt}>
      <p className={styles.promptText}>
        {heroName ? `${heroName}'s story is over.` : 'Your Hero’s story is over.'} The GM has opened a replacement Hero for you.
      </p>
      <Link to={`/c/${campaignId}/create-character`} className={styles.link}>Create your new Hero</Link>
    </div>
  );
}

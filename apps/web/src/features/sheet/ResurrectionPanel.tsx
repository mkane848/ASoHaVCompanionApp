import { useState } from 'react';
import type { Clock } from '@asohav/shared';
import { isResurrectionClockComplete } from '@asohav/shared';
import type { DeathActions } from '../../lib/mutations.js';
import styles from './ResurrectionPanel.module.css';

/** Resurrection on a Dead Hero's sheet (V0.7 slice 8c, Ruleset-V0.7.md L650-652), reusing the Clocks
 *  feature: the GM links a Clock (an existing one, or a new Project Clock made here) and, once it is
 *  complete, the Hero's player has the final say — Return or Stay dead. Return flips only Dead to Alive
 *  and clears the Ending; what state the Hero returns in is Ryan's open question, so nothing else
 *  changes and the table settles the rest. Dead only: a Retired Hero never gets this panel.
 *  Lives in `DyingNotices`' lazy chunk because it shows only on a Dead sheet. */
export function ResurrectionPanel({
  linkedClockId,
  heroName,
  clocks,
  isGM,
  death,
}: {
  linkedClockId: string | null;
  heroName: string;
  clocks: Clock[];
  isGM: boolean;
  death: DeathActions;
}) {
  const [pick, setPick] = useState('');
  const [title, setTitle] = useState('');
  const [segments, setSegments] = useState('6');
  const [busy, setBusy] = useState(false);

  async function act(call: () => Promise<boolean>) {
    setBusy(true);
    try {
      await call();
    } finally {
      setBusy(false);
    }
  }

  const clock = linkedClockId ? clocks.find((c) => c.Id === linkedClockId) : undefined;
  const linkable = clocks.filter((c) => c.Status === 'Open');

  const gmLinker = isGM && (
    <div className={styles.linker}>
      {linkable.length > 0 && (
        <div className={styles.row}>
          <label className={styles.label} htmlFor="res-clock-pick">Link an existing Clock</label>
          <select id="res-clock-pick" className={styles.field} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose a Clock&hellip;</option>
            {linkable.map((c) => <option key={c.Id} value={c.Id}>{c.Title} ({c.SuccessMarks}/{c.Segments})</option>)}
          </select>
          <button className={`tap-inline ${styles.button}`} disabled={!pick || busy} onClick={() => void act(() => death.linkClock({ ClockId: pick }))}>
            Link
          </button>
        </div>
      )}
      <div className={styles.row}>
        <label className={styles.label} htmlFor="res-clock-title">Or make a new Clock</label>
        <input id="res-clock-title" className={styles.field} value={title} maxLength={120} placeholder="The rite of return" onChange={(e) => setTitle(e.target.value)} />
        <input aria-label="Segments" className={`${styles.field} ${styles.segments}`} type="number" inputMode="numeric" min={2} max={12} value={segments} onChange={(e) => setSegments(e.target.value)} />
        <button className={`tap-inline ${styles.button}`} disabled={!title.trim() || busy} onClick={() => void act(() => death.linkClock({ NewClock: { Title: title.trim(), Segments: Number(segments) || undefined } }))}>
          Make and link
        </button>
      </div>
    </div>
  );

  if (!linkedClockId || !clock) {
    return (
      <div className={styles.panel}>
        <p className={styles.text}>
          <strong>Resurrection</strong> is rare, arduous and often costly. {isGM
            ? `Outline a Clock for ${heroName}'s return; once it is complete, their player decides whether it works.`
            : 'If the GM outlines a Clock for your return, it will show here, and once it is complete you decide whether it works.'}
          {linkedClockId && !clock ? ' The linked Clock no longer exists, so a new one needs linking.' : ''}
        </p>
        {gmLinker}
      </div>
    );
  }

  if (!isResurrectionClockComplete(clock)) {
    return (
      <div className={styles.panel}>
        <p className={styles.text}>
          <strong>Resurrection Clock:</strong> {clock.Title}, {clock.SuccessMarks} of {clock.Segments}
          {clock.ResolvedAs === 'Failure' ? ' (resolved as a failure)' : ''}. It is worked on in the Clocks panel.
        </p>
        {isGM && (
          <button className={`tap-inline ${styles.button}`} disabled={busy} onClick={() => void act(() => death.linkClock({ ClockId: null }))}>
            Unlink this Clock
          </button>
        )}
        {isGM && clock.ResolvedAs === 'Failure' && gmLinker}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.text}>
        <strong>The Resurrection Clock &ldquo;{clock.Title}&rdquo; is complete.</strong> The ritual can be performed, and {heroName}&rsquo;s player has the final say on whether it works.
      </p>
      <div className={styles.row}>
        <button className={`tap-inline ${styles.button}`} disabled={busy} onClick={() => void act(() => death.resurrect('Return'))}>
          Return
        </button>
        <button className={`tap-inline ${styles.button}`} disabled={busy} onClick={() => void act(() => death.resurrect('StayDead'))}>
          Stay dead
        </button>
      </div>
      <p className={styles.hint}>Returning only marks {heroName} alive again. Strain, Statuses, Scars and Dying stay exactly as they are now; the table settles the rest.</p>
    </div>
  );
}

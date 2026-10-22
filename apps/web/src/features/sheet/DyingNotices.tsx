import { lazy, Suspense, useState } from 'react';
import type { CharacterSheet, Clock } from '@asohav/shared';
import { heroSpeed } from '@asohav/shared';
import type { DeathActions } from '../../lib/mutations.js';
import { ResurrectionPanel } from './ResurrectionPanel.js';
import styles from './StatusesPanel.module.css';

const DyingChoiceModal = lazy(() => import('./DyingChoiceModal.js').then((m) => ({ default: m.DyingChoiceModal })));

/** One line for the Dead / Retired banner: how the Hero's story ended, with the words recorded. */
function endingSummary(e: NonNullable<CharacterSheet['Ending']>): string {
  const said = e.Text ? ` “${e.Text}”` : '';
  switch (e.Kind) {
    case 'RiskDeathFailed': return `Risked Death and lost.${e.Text ? ' Last words:' : ''}${said}`;
    case 'ScarRefused': return `Refused the GM’s Scar and perished.${said}`;
    case 'BlazeOfGlory': return `Went out in a Blaze of Glory:${said}`;
    case 'StrainDeath': return 'Struck down with no Strain box left to take the hit.';
    case 'FourthScar': return `Took a fourth Scar and retires; the table works out the ending.${e.Text ? ' Note:' : ''}${said}`;
    default: return '';
  }
}

/** The Statuses panel's Dying / Dead / Retired banners (V0.7 slice 8b), lazy-loaded by `StatusesPanel`
 *  because they show only then and the sheet's first load is what the bundle budget measures.
 *  - **Dead / Retired**: who they were and how it ended; the sheet is read-only.
 *  - **Dying**: the effects, and a non-blocking prompt for the Dying choice until one is recorded
 *    (the Hero can keep acting). `death` is given to the Hero's player and to the GM's peek. */
export function DyingNotices({
  sheet,
  heroName,
  readOnly,
  playLocked,
  death,
  clocks,
  onClearDying,
}: {
  sheet: CharacterSheet;
  heroName: string;
  readOnly: boolean;
  playLocked: boolean;
  death?: DeathActions;
  /** The campaign's Clocks, for the Resurrection Clock of a Dead Hero (slice 8c). */
  clocks?: Clock[];
  onClearDying: () => void;
}) {
  const [choosing, setChoosing] = useState(false);

  if (sheet.LifeState === 'Dead' || sheet.LifeState === 'Retired') {
    return (
      <div className={styles.dyingNotice} role="status">
        <p className={styles.noticeText}>
          <strong>{sheet.LifeState === 'Retired' ? 'Retired.' : 'Dead.'}</strong> {sheet.Ending ? endingSummary(sheet.Ending) : ''} This sheet is read-only.
        </p>
        {sheet.LifeState === 'Dead' && death && clocks && (
          <ResurrectionPanel linkedClockId={sheet.ResurrectionClockId ?? null} heroName={heroName} clocks={clocks} isGM={readOnly} death={death} />
        )}
      </div>
    );
  }

  return (
    <div className={styles.dyingNotice} role="status">
      <p className={styles.noticeText}>
        <strong>Dying.</strong> {readOnly ? 'Their' : 'Your'} life is in mortal danger. Speed {heroSpeed(sheet)}; no Recuperate and no recovering Statuses. {readOnly ? 'They' : 'You'} can still act, and allies can still help reduce Strain.{' '}
        {sheet.DyingChoice
          ? `Choice made (${sheet.DyingChoice === 'Scar' ? 'a Scar' : 'Risk Death'}): a second Strain can now be marked in each box, and a hit with no box left kills.`
          : 'A choice is due — Take a Scar, Risk Death or a Blaze of Glory — but play can go on until it is made.'}
      </p>
      {!sheet.DyingChoice && death && (
        <button className={`tap-inline ${styles.noticeButton}`} onClick={() => setChoosing(true)}>
          Make the choice&hellip;
        </button>
      )}
      {!readOnly && (
        <button className={`tap-inline ${styles.noticeButton}`} disabled={playLocked} onClick={onClearDying}>
          Clear Dying
        </button>
      )}
      {choosing && death && (
        <Suspense fallback={null}>
          <DyingChoiceModal heroName={heroName} scarCount={(sheet.Scars ?? []).length} onSubmit={death.choose} onClose={() => setChoosing(false)} />
        </Suspense>
      )}
    </div>
  );
}

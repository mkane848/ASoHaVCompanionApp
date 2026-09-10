import { useState } from 'react';
import type { CharacterSheet, Library, Party } from '@asohav/shared';
import { computeRollBreakdown, newId, nowIso } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { TierChoiceRow } from './TierChoiceRow.js';
import modal from '../../styles/modal.module.css';
import styles from './CampActionsModal.module.css';

type GmTier = 'Tier3' | 'Tier2' | 'Tier1';

const GM_TIER2_OPTIONS = [
  'The person on watch notices something interesting nearby, related to any Hero’s Motif, Threat, or the Adventure Countdown.',
  'One party member wakes with the Restless Bane, which doesn’t clear until they can sleep well.',
  'Something dangerous approaches.',
] as const;

const VOLUNTEER_OPTIONS = [
  { key: 'alert', label: "You're alert — gain the Alert Boon." },
  { key: 'turf', label: 'You choose the turf.' },
  { key: 'senses', label: 'You use your senses — ask the GM two questions (they answer only with what your Hero could feasibly find out).' },
] as const;

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Keep Watch (V0.6 slice 4 rewrite, `WorkPlan-V0.6.md` Section A2, on top of slice 1's own
 *  Boon/Bane terminology update): a GM "roll +Nothing" (no Virtue), then the volunteer's roll —
 *  now fixed to +Wit rather than a free Virtue pick, per the doc's own literal wording. The GM's
 *  6- now marks party Rapport (it used to have everyone mark Potential); the volunteer's own 6-
 *  no longer marks Potential either — the doc's text for that result is just "the GM takes or
 *  holds a hard move." This app only ever writes to the viewer's own sheet (see `sheet.ts`'s
 *  owner-only PUT), so a Boon/Bane one of these results names for "one party member"/"the
 *  volunteer" only ever lands on whoever is running this flow — a deliberate scope narrowing,
 *  same shape as Combat's `PendingStrainOffer` restriction being left out of this slice (see
 *  `README.md`). */
export function KeepWatchModal({
  sheet,
  library,
  commitSheet,
  commitParty,
  onClose,
}: {
  sheet: CharacterSheet;
  library: Library;
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  commitParty: (m: (d: Party) => void) => void;
  onClose: () => void;
}) {
  const [gmTier, setGmTier] = useState<GmTier | null>(null);
  const [gmOption, setGmOption] = useState<number | null>(null);
  const [gmApplied, setGmApplied] = useState(false);
  const [volunteerTier, setVolunteerTier] = useState<GmTier | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [volunteerApplied, setVolunteerApplied] = useState(false);

  const maxChoices = volunteerTier === 'Tier3' ? 2 : 1;
  const witBreakdown = computeRollBreakdown(sheet, 'v-wit', library);

  function log(text: string) {
    commitParty((d) => { d.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'noted', Name: 'Keep Watch', Effect: text }); });
  }

  function applyGm() {
    if (gmTier === 'Tier2' && gmOption !== null) {
      log(GM_TIER2_OPTIONS[gmOption]);
      if (gmOption === 1) commitSheet((d) => { d.Banes = [...d.Banes, 'Restless']; });
    } else if (gmTier === 'Tier1') {
      commitParty((d) => { d.Rapport = Math.min(library.settings.RapportTrackLength, d.Rapport + 1); });
      log('The Party marks Rapport, and a danger will emerge tonight.');
    } else if (gmTier === 'Tier3') {
      log('The night passes without incident.');
    }
    setGmApplied(true);
  }

  function toggleChoice(key: string) {
    setChosen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : prev.length < maxChoices ? [...prev, key] : prev));
  }

  function applyVolunteer() {
    if (chosen.includes('alert')) {
      commitSheet((d) => { d.Boons = [...d.Boons, 'Alert']; });
    }
    const labels = VOLUNTEER_OPTIONS.filter((o) => chosen.includes(o.key)).map((o) => o.label);
    if (labels.length > 0) log(`Volunteer rolled ${volunteerTier}: ${labels.join(' ')}`);
    setVolunteerApplied(true);
  }

  function applyVolunteerMiss() {
    log("On a 6-, whatever it is gets to you before you notice it — the GM takes or holds a hard move.");
    setVolunteerApplied(true);
  }

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="keep-watch-title" tabIndex={-1}>
        <div className={modal.head}>
          <h2 id="keep-watch-title" className={modal.title}>Keep Watch</h2>
          <p className={modal.subtitle}>The GM rolls first, no Virtue. Then the volunteer rolls +Wit.</p>
        </div>
        <div className={modal.body}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>1. GM rolls +Nothing — report the tier</div>
            {!gmApplied ? (
              <>
                <TierChoiceRow chosen={gmTier} onChoose={setGmTier} />
                {gmTier === 'Tier2' && (
                  <div className={styles.stackedRow}>
                    {GM_TIER2_OPTIONS.map((o, i) => (
                      <button key={i} type="button" className={`tap-inline ${styles.choice} ${gmOption === i ? styles.choiceSelected : ''}`} onClick={() => setGmOption(i)}>
                        {gmOption === i ? '✓ ' : ''}{o}
                      </button>
                    ))}
                  </div>
                )}
                {gmTier && (
                  <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={gmTier === 'Tier2' && gmOption === null} onClick={applyGm}>
                    Apply
                  </button>
                )}
              </>
            ) : (
              <p className={styles.hint}>Applied.</p>
            )}
          </div>

          {gmApplied && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>2. Volunteer rolls +Wit ({sign(witBreakdown.Total)})</div>
              {!volunteerApplied ? (
                <>
                  <TierChoiceRow chosen={volunteerTier} onChoose={setVolunteerTier} />
                  {volunteerTier === 'Tier1' ? (
                    <button type="button" className={`tap-inline ${modal.primaryAction}`} onClick={applyVolunteerMiss}>Apply</button>
                  ) : volunteerTier && (
                    <>
                      <p className={styles.hint}>Choose {maxChoices}:</p>
                      <div className={`action-grid ${styles.row}`}>
                        {VOLUNTEER_OPTIONS.map((o) => (
                          <button
                            key={o.key}
                            type="button"
                            className={`tap-inline ${styles.choice} ${chosen.includes(o.key) ? styles.choiceSelected : ''}`}
                            disabled={!chosen.includes(o.key) && chosen.length >= maxChoices}
                            onClick={() => toggleChoice(o.key)}
                          >
                            {chosen.includes(o.key) ? '✓ ' : ''}{o.label}
                          </button>
                        ))}
                      </div>
                      <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={chosen.length === 0} onClick={applyVolunteer}>Apply</button>
                    </>
                  )}
                </>
              ) : (
                <p className={styles.hint}>Applied.</p>
              )}
            </div>
          )}

          <p className={styles.hint}>Not keeping watch? Treat any threat as a 6- on this roll.</p>

          <button type="button" className={`tap-inline ${modal.secondaryAction} ${styles.close}`} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

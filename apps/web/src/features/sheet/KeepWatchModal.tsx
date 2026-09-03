import { useState } from 'react';
import type { CharacterSheet, Library, Party, RollTier } from '@asohav/shared';
import { addMotifPotential, giveStatus, newId, nowIso } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { TierChoiceRow } from './TierChoiceRow.js';
import modal from '../../styles/modal.module.css';
import styles from './CampActionsModal.module.css';

const GM_TIER2_OPTIONS = [
  'The person on watch notices something interesting nearby.',
  "One party member wakes with Restless 2.",
  'Something dangerous approaches.',
] as const;

const VOLUNTEER_OPTIONS = [
  { key: 'alert', label: "You're alert — gain Alert 2." },
  { key: 'turf', label: 'You choose the turf.' },
  { key: 'senses', label: 'You use your senses — ask the GM two questions.' },
] as const;

/** Keep Watch (Ruleset-V0.5.md): a GM "roll + Nothing" (no Virtue), then a volunteer's Virtue
 *  roll. This app only ever writes to the viewer's own sheet (see `sheet.ts`'s owner-only PUT),
 *  so a Status one of these results names for "one party member"/"the volunteer" only ever lands
 *  on whoever is running this flow — a deliberate scope narrowing, same shape as Combat's
 *  `PendingStatusOffer` restriction being left out of this slice (see `README.md`). */
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
  const [gmTier, setGmTier] = useState<RollTier | null>(null);
  const [gmOption, setGmOption] = useState<number | null>(null);
  const [gmApplied, setGmApplied] = useState(false);
  const [virtueId, setVirtueId] = useState<string | null>(null);
  const [volunteerTier, setVolunteerTier] = useState<RollTier | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [volunteerApplied, setVolunteerApplied] = useState(false);
  const [motifIndex, setMotifIndex] = useState(0);

  const maxChoices = volunteerTier === 'Tier3' ? 2 : 1;

  function log(text: string) {
    commitParty((d) => { d.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'noted', Name: 'Keep Watch', Effect: text }); });
  }

  function applyGm() {
    if (gmTier === 'Tier2' && gmOption !== null) {
      log(GM_TIER2_OPTIONS[gmOption]);
      if (gmOption === 1) commitSheet((d) => { d.Statuses = giveStatus(d.Statuses, { Name: 'Restless', Polarity: 'Negative', Rank: 2 }).Statuses; });
    } else if (gmTier === 'Tier1') {
      commitSheet((d) => { addMotifPotential(d.Motifs[motifIndex], 1, library.settings.PotentialTrackLength); });
      log('Everyone marks Potential — a danger will emerge tonight.');
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
      commitSheet((d) => { d.Statuses = giveStatus(d.Statuses, { Name: 'Alert', Polarity: 'Positive', Rank: 2 }).Statuses; });
    }
    const labels = VOLUNTEER_OPTIONS.filter((o) => chosen.includes(o.key)).map((o) => o.label);
    if (labels.length > 0) log(`Volunteer rolled ${volunteerTier}: ${labels.join(' ')}`);
    setVolunteerApplied(true);
  }

  function applyVolunteerMiss() {
    commitSheet((d) => { addMotifPotential(d.Motifs[motifIndex], 1, library.settings.PotentialTrackLength); });
    log("On a 6-, whatever it is reaches you first — the GM takes or holds a Hard Move.");
    setVolunteerApplied(true);
  }

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="keep-watch-title" tabIndex={-1}>
        <div className={modal.head}>
          <h2 id="keep-watch-title" className={modal.title}>Keep Watch</h2>
          <p className={modal.subtitle}>The GM rolls first, no Virtue. Then a volunteer rolls + an appropriate Virtue.</p>
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
              <div className={styles.sectionLabel}>2. Volunteer rolls + a Virtue</div>
              {!virtueId ? (
                <div className={`tap-row ${styles.row}`}>
                  {library.virtues.map((v) => (
                    <button key={v.Id} type="button" className={`tap-inline ${styles.choice}`} onClick={() => setVirtueId(v.Id)}>{v.Name}</button>
                  ))}
                </div>
              ) : !volunteerApplied ? (
                <>
                  <TierChoiceRow chosen={volunteerTier} onChoose={setVolunteerTier} />
                  {volunteerTier === 'Tier1' ? (
                    <>
                      <MotifPicker sheet={sheet} value={motifIndex} onChange={setMotifIndex} />
                      <button type="button" className={`tap-inline ${modal.primaryAction}`} onClick={applyVolunteerMiss}>Apply</button>
                    </>
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

          <p className={styles.hint}>Not keeping watch? Treat any threat as a 6- on this Virtue roll.</p>

          <button type="button" className={`tap-inline ${modal.secondaryAction} ${styles.close}`} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function MotifPicker({ sheet, value, onChange }: { sheet: CharacterSheet; value: number; onChange: (i: number) => void }) {
  return (
    <select className={`tap-inline ${styles.select}`} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {sheet.Motifs.map((m, i) => <option key={i} value={i}>{m.Name || `Motif ${i + 1}`}</option>)}
    </select>
  );
}

import { useState } from 'react';
import type { CharacterSheet, Library, RollTier } from '@asohav/shared';
import { addMotifPotential, computeRollBreakdown, newId, nowIso } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { TierChoiceRow } from './TierChoiceRow.js';
import modal from '../../styles/modal.module.css';
import styles from './CampActionsModal.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

const SCOUT_OPTIONS = ['alert', 'status', 'prepared', 'discovery'] as const;
type ScoutOption = (typeof SCOUT_OPTIONS)[number];
const SCOUT_LABELS: Record<ScoutOption, string> = {
  alert: 'You notice signs of nearby danger — gain the Alert Boon.',
  status: 'You discern a beneficial aspect of the terrain — gain a Boon you name.',
  prepared: 'You get the drop on whatever lies ahead — gain the Prepared Boon.',
  discovery: 'You make an interesting discovery.',
};

const VENTURE_TIER3_OPTIONS = [
  'You encounter a significant person, place, or opportunity related to the area or your Party Quest.',
  'You discover something noteworthy the Scout missed.',
  'The trip takes longer than planned — everyone marks a Condition, or the GM advances a Threat.',
  'Something or someone is following you.',
];

/** Set Out (renamed from "Undertake a Journey," V0.6 slice 4 — `WorkPlan-V0.6.md` Section A2:
 *  "Set Out keeps Scout Ahead → Venture Forth intact but promotes Loadout to its first step").
 *  Loadout was already this modal's first section before the rename, so the only real change
 *  here is the name itself and matching the doc's own wording more closely. Self-contained to the
 *  acting player's own sheet — no Party/Clock plumbing needed, unlike Make Camp/Enjoy Downtime,
 *  since nothing in either phase names a shared resource this app tracks (Rapport-as-Aid is
 *  already covered by the existing Aid controls in Advancement). */
export function SetOutModal({ sheet, library, commitSheet, onClose }: { sheet: CharacterSheet; library: Library; commitSheet: (m: (d: CharacterSheet) => void) => void; onClose: () => void }) {
  const [scoutTier, setScoutTier] = useState<RollTier | null>(null);
  const [scoutChosen, setScoutChosen] = useState<ScoutOption[]>([]);
  const [scoutStatusName, setScoutStatusName] = useState('');
  const [scoutMotifIndex, setScoutMotifIndex] = useState(0);
  const [scoutApplied, setScoutApplied] = useState(false);
  const [ventureTier, setVentureTier] = useState<RollTier | null>(null);
  const [ventureChoice, setVentureChoice] = useState<string>('');
  const [ventureGmNote, setVentureGmNote] = useState('');
  const [ventureMotifIndex, setVentureMotifIndex] = useState(0);
  const [ventureApplied, setVentureApplied] = useState(false);

  const witBreakdown = computeRollBreakdown(sheet, 'v-wit', library);
  const guileBreakdown = computeRollBreakdown(sheet, 'v-guile', library);
  const scoutMax = scoutTier === 'Tier3' ? 2 : 1;

  function toggleScout(o: ScoutOption) {
    setScoutChosen((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : prev.length < scoutMax ? [...prev, o] : prev));
  }

  function applyScoutHit() {
    commitSheet((d) => {
      if (scoutChosen.includes('alert')) d.Boons = [...d.Boons, 'Alert'];
      if (scoutChosen.includes('prepared')) d.Boons = [...d.Boons, 'Prepared'];
      if (scoutChosen.includes('status') && scoutStatusName.trim()) d.Boons = [...d.Boons, scoutStatusName.trim()];
      d.Advancement.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'noted', Name: 'Scout Ahead', Effect: scoutChosen.map((o) => SCOUT_LABELS[o]).join(' ') });
    });
    setScoutApplied(true);
  }

  function applyScoutMiss() {
    commitSheet((d) => {
      addMotifPotential(d.Motifs[scoutMotifIndex], 1, library.settings.PotentialTrackLength);
      d.Advancement.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'noted', Name: 'Scout Ahead', Effect: 'Marked Potential — the GM makes a hard move.' });
    });
    setScoutApplied(true);
  }

  function applyVentureHit(note: string) {
    commitSheet((d) => {
      d.Advancement.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'noted', Name: 'Venture Forth', Effect: note });
    });
    setVentureApplied(true);
  }

  function applyVentureMiss() {
    commitSheet((d) => {
      addMotifPotential(d.Motifs[ventureMotifIndex], 1, library.settings.PotentialTrackLength);
      d.Advancement.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'noted', Name: 'Venture Forth', Effect: 'Marked Potential — the GM makes a hard move.' });
    });
    setVentureApplied(true);
  }

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="journey-title" tabIndex={-1}>
        <div className={modal.head}>
          <h2 id="journey-title" className={modal.title}>Set Out</h2>
          <p className={modal.subtitle}>Choose your Loadout, Scout Ahead, then Venture Forth.</p>
        </div>
        <div className={modal.body}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Loadout</div>
            <select className={`tap-inline ${styles.select}`} value={sheet.Load.Tier} onChange={(e) => commitSheet((d) => { d.Load.Tier = e.target.value as typeof d.Load.Tier; })}>
              {library.loadTiers.map((t) => <option key={t.Key} value={t.Key}>{t.Key}</option>)}
            </select>
            <p className={styles.hint}>Everything else stays in Camp.</p>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Scout Ahead — Roll 2d6 + Wit: {sign(witBreakdown.Total)}</div>
            {!scoutApplied ? (
              <>
                <TierChoiceRow chosen={scoutTier} onChoose={setScoutTier} />
                {scoutTier === 'Tier1' ? (
                  <>
                    <MotifPicker sheet={sheet} value={scoutMotifIndex} onChange={setScoutMotifIndex} />
                    <button type="button" className={`tap-inline ${modal.primaryAction}`} onClick={applyScoutMiss}>Apply</button>
                  </>
                ) : scoutTier && (
                  <>
                    <p className={styles.hint}>Choose {scoutMax}:</p>
                    <div className={styles.stackedRow}>
                      {SCOUT_OPTIONS.map((o) => (
                        <button key={o} type="button" className={`tap-inline ${styles.choice} ${scoutChosen.includes(o) ? styles.choiceSelected : ''}`} disabled={!scoutChosen.includes(o) && scoutChosen.length >= scoutMax} onClick={() => toggleScout(o)}>
                          {scoutChosen.includes(o) ? '✓ ' : ''}{SCOUT_LABELS[o]}
                        </button>
                      ))}
                    </div>
                    {scoutChosen.includes('status') && (
                      <input className={`tap-inline ${styles.textInput}`} placeholder="Name the Boon…" value={scoutStatusName} onChange={(e) => setScoutStatusName(e.target.value)} />
                    )}
                    <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={scoutChosen.length === 0} onClick={applyScoutHit}>Apply</button>
                  </>
                )}
              </>
            ) : (
              <p className={styles.hint}>Applied.</p>
            )}
          </div>

          {scoutApplied && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Venture Forth — Roll 2d6 + Guile: {sign(guileBreakdown.Total)}</div>
              {!ventureApplied ? (
                <>
                  <TierChoiceRow chosen={ventureTier} onChoose={setVentureTier} />
                  {ventureTier === 'Tier3' && (
                    <>
                      <div className={styles.stackedRow}>
                        {VENTURE_TIER3_OPTIONS.map((o) => (
                          <button key={o} type="button" className={`tap-inline ${styles.choice} ${ventureChoice === o ? styles.choiceSelected : ''}`} onClick={() => setVentureChoice(o)}>{o}</button>
                        ))}
                      </div>
                      <p className={styles.hint}>Gains +1 Ongoing to any future rolls while you travel (a table judgment call this app doesn&rsquo;t track).</p>
                      <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={!ventureChoice} onClick={() => applyVentureHit(ventureChoice)}>Apply</button>
                    </>
                  )}
                  {ventureTier === 'Tier2' && (
                    <>
                      <input className={`tap-inline ${styles.textInput}`} placeholder="What did the GM choose?" value={ventureGmNote} onChange={(e) => setVentureGmNote(e.target.value)} />
                      <button type="button" className={`tap-inline ${modal.primaryAction}`} onClick={() => applyVentureHit(ventureGmNote || 'The GM chose a complication.')}>Apply</button>
                    </>
                  )}
                  {ventureTier === 'Tier1' && (
                    <>
                      <MotifPicker sheet={sheet} value={ventureMotifIndex} onChange={setVentureMotifIndex} />
                      <button type="button" className={`tap-inline ${modal.primaryAction}`} onClick={applyVentureMiss}>Apply</button>
                    </>
                  )}
                </>
              ) : (
                <p className={styles.hint}>Applied — you&rsquo;ve arrived, or reached a safe place to Make Camp.</p>
              )}
            </div>
          )}

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

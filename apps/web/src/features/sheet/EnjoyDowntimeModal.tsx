import { useState } from 'react';
import type { Bond, Character, CharacterSheet, Clock, Library, Party, RollTier } from '@asohav/shared';
import { addMotifPotential, newId, nowIso, tickClock } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { MarkBondModal } from '../../components/MarkBondModal.js';
import { TierChoiceRow } from './TierChoiceRow.js';
import modal from '../../styles/modal.module.css';
import styles from './CampActionsModal.module.css';

const ADVANCE_SEGMENTS: Record<RollTier, number> = { Tier3: 3, Tier2: 2, Tier1: 1 };

/** Enjoy Downtime (Ruleset-V0.5.md) — a menu of seven activities, most a straight resource spend
 *  plus one mechanical effect. Everything available at Make Camp is also available here, per the
 *  doc's own wording, but this modal only covers the seven Downtime-specific activities; use the
 *  Make Camp flow for the rest (personal resource clearing, Camp Actions). */
export function EnjoyDowntimeModal({
  sheet,
  library,
  party,
  bonds,
  characters,
  myCharacterId,
  clocks,
  commitSheet,
  commitParty,
  onPropose,
  onSaveClock,
  onClose,
}: {
  sheet: CharacterSheet;
  library: Library;
  party: Party;
  bonds: Bond[];
  characters: Character[];
  myCharacterId: string;
  clocks: Clock[];
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  commitParty: (m: (d: Party) => void) => void;
  onPropose: (bondId: string, note?: string) => void;
  onSaveClock: (clock: Clock) => void;
  onClose: () => void;
}) {
  const [acquireNote, setAcquireNote] = useState('');
  const [acquireCost, setAcquireCost] = useState(1);
  const [trainMotifIndex, setTrainMotifIndex] = useState(0);
  const [pivotMode, setPivotMode] = useState<'personal' | 'party'>('personal');
  const [pivotMotifIndex, setPivotMotifIndex] = useState(0);
  const [pivotDraft, setPivotDraft] = useState(sheet.Motifs[0]?.Quest ?? '');
  const [partyGoalDraft, setPartyGoalDraft] = useState(party.Goal);
  const [advanceClockId, setAdvanceClockId] = useState('');
  const [markingBond, setMarkingBond] = useState<{ bondId: string; partnerName: string } | null>(null);

  const myBonds = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);
  const partnerName = (b: Bond) => characters.find((c) => c.Id === (b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId))?.Name ?? 'them';

  function rest() {
    if ((sheet.Wealth ?? 0) < 1) return;
    commitSheet((d) => { d.Wealth = Math.max(0, (d.Wealth ?? 0) - 1); d.Statuses = []; });
  }

  function recover() {
    commitSheet((d) => { d.Virtues.forEach((v) => { v.ConditionMarked = false; }); });
  }

  function carouse(bondId: string, note: string) {
    if ((sheet.Treasure ?? 0) < 1) return;
    commitSheet((d) => { d.Treasure = Math.max(0, (d.Treasure ?? 0) - 1); });
    onPropose(bondId, note);
    setMarkingBond(null);
  }

  function acquire() {
    if ((sheet.Wealth ?? 0) < acquireCost) return;
    commitSheet((d) => {
      d.Wealth = Math.max(0, (d.Wealth ?? 0) - acquireCost);
      d.Advancement.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'spent', Name: 'Acquire', Effect: acquireNote.trim() || `Spent ${acquireCost} Wealth.` });
    });
    setAcquireNote('');
  }

  function train() {
    if ((sheet.Wealth ?? 0) < 1) return;
    commitSheet((d) => {
      d.Wealth = Math.max(0, (d.Wealth ?? 0) - 1);
      addMotifPotential(d.Motifs[trainMotifIndex], 1, library.settings.PotentialTrackLength);
    });
  }

  function pivot() {
    if (pivotMode === 'personal') {
      commitSheet((d) => { d.Motifs[pivotMotifIndex].Quest = pivotDraft.trim(); });
    } else {
      commitParty((d) => { d.Goal = partyGoalDraft.trim(); });
    }
  }

  function advance(tier: RollTier) {
    const clock = clocks.find((c) => c.Id === advanceClockId);
    if (!clock) return;
    const segments = ADVANCE_SEGMENTS[tier];
    onSaveClock({ ...clock, SuccessMarks: tickClock(clock, segments), History: [{ Id: newId('h'), At: nowIso(), Text: `Advanced ${segments} during Enjoy Downtime (${tier}).` }, ...clock.History] });
  }

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="downtime-title" tabIndex={-1}>
        <div className={modal.head}>
          <h2 id="downtime-title" className={modal.title}>Enjoy Downtime</h2>
          <p className={modal.subtitle}>Do as many of these as you like or can afford.</p>
        </div>
        <div className={modal.body}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Rest — spend 1 Wealth to remove all Status Ranks</div>
            <button type="button" className={`tap-inline ${styles.choice}`} disabled={(sheet.Wealth ?? 0) < 1} onClick={rest}>Rest</button>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Recover — clear all Conditions</div>
            <button type="button" className={`tap-inline ${styles.choice}`} onClick={recover}>Recover</button>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Carouse — spend 1 Treasure to mark Bond with someone involved</div>
            {myBonds.length === 0 ? <p className={styles.empty}>No Bonds yet.</p> : (
              <div className={`action-grid ${styles.row}`}>
                {myBonds.map((b) => (
                  <button key={b.Id} type="button" className={`tap-inline ${styles.choice}`} disabled={(sheet.Treasure ?? 0) < 1} onClick={() => setMarkingBond({ bondId: b.Id, partnerName: partnerName(b) })}>
                    {partnerName(b)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Acquire — spend Wealth to procure, repair, or restock</div>
            <div className={styles.actionRow}>
              <input type="number" min={1} className={`tap-inline ${styles.numberInput}`} value={acquireCost} onChange={(e) => setAcquireCost(Math.max(1, parseInt(e.target.value, 10) || 1))} aria-label="Wealth to spend" />
              <input className={`tap-inline ${styles.textInput}`} placeholder="What did you acquire?" value={acquireNote} onChange={(e) => setAcquireNote(e.target.value)} />
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={(sheet.Wealth ?? 0) < acquireCost} onClick={acquire}>Acquire</button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Train — spend 1 Wealth to mark Potential</div>
            <div className={styles.actionRow}>
              <select className={`tap-inline ${styles.select}`} value={trainMotifIndex} onChange={(e) => setTrainMotifIndex(Number(e.target.value))}>
                {sheet.Motifs.map((m, i) => <option key={i} value={i}>{m.Name || `Motif ${i + 1}`}</option>)}
              </select>
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={(sheet.Wealth ?? 0) < 1} onClick={train}>Train</button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Pivot — change your Quest, or the Party Goal</div>
            <div className={`tap-row ${styles.row}`}>
              <button type="button" className={`tap-inline ${styles.choice} ${pivotMode === 'personal' ? styles.choiceSelected : ''}`} onClick={() => setPivotMode('personal')}>Personal</button>
              <button type="button" className={`tap-inline ${styles.choice} ${pivotMode === 'party' ? styles.choiceSelected : ''}`} onClick={() => setPivotMode('party')}>Party Goal</button>
            </div>
            {pivotMode === 'personal' ? (
              <div className={styles.actionRow}>
                <select className={`tap-inline ${styles.select}`} value={pivotMotifIndex} onChange={(e) => { const i = Number(e.target.value); setPivotMotifIndex(i); setPivotDraft(sheet.Motifs[i]?.Quest ?? ''); }}>
                  {sheet.Motifs.map((m, i) => <option key={i} value={i}>{m.Name || `Motif ${i + 1}`}</option>)}
                </select>
                <input className={`tap-inline ${styles.textInput}`} value={pivotDraft} onChange={(e) => setPivotDraft(e.target.value)} />
                <button type="button" className={`tap-inline ${styles.choice}`} onClick={pivot}>Pivot</button>
              </div>
            ) : (
              <div className={styles.actionRow}>
                <input className={`tap-inline ${styles.textInput}`} value={partyGoalDraft} onChange={(e) => setPartyGoalDraft(e.target.value)} />
                <button type="button" className={`tap-inline ${styles.choice}`} onClick={pivot}>Pivot</button>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Advance — describe pursuing a long-term project, then roll + an appropriate Virtue</div>
            {clocks.length === 0 ? <p className={styles.empty}>No Clocks yet — the GM defines a new project&rsquo;s Clock.</p> : (
              <>
                <select className={`tap-inline ${styles.select}`} value={advanceClockId} onChange={(e) => setAdvanceClockId(e.target.value)}>
                  <option value="">Choose a project Clock…</option>
                  {clocks.map((c) => <option key={c.Id} value={c.Id}>{c.Title}</option>)}
                </select>
                <TierChoiceRow disabled={!advanceClockId} onChoose={advance} />
              </>
            )}
          </div>

          <button type="button" className={`tap-inline ${modal.secondaryAction} ${styles.close}`} onClick={onClose}>Close</button>
        </div>
      </div>

      {markingBond && (
        <MarkBondModal
          partnerName={markingBond.partnerName}
          onClose={() => setMarkingBond(null)}
          onSubmit={(note) => carouse(markingBond.bondId, note)}
        />
      )}
    </div>
  );
}

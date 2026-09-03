import { useState } from 'react';
import type { CharacterSheet, Clock, Party, RollTier } from '@asohav/shared';
import { campActionsAllowed, newId, nowIso, tickClock } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { TierChoiceRow } from './TierChoiceRow.js';
import modal from '../../styles/modal.module.css';
import styles from './CampActionsModal.module.css';

const PROJECT_CLOCK_SEGMENTS: Record<RollTier, number> = { Tier3: 3, Tier2: 2, Tier1: 1 };

/** The Make Camp pieces not already covered by the "Make Camp" button in `StatusesPanel.tsx`
 *  (`MakeCampModal.tsx`, pre-slice-7 — Status/Condition/Armor/Recoveries/Load reset). This modal
 *  is what slice 7 actually adds: advancing a Bad Guy Clock, a reminder to check Advancement for
 *  a full track, and Camp Actions (Party Level + 1 per player: change the Party Goal, change a
 *  personal Quest, use a Camp Asset, or progress a personal project Clock). */
export function CampActionsModal({
  sheet,
  party,
  clocks,
  commitSheet,
  commitParty,
  onSaveClock,
  onClose,
}: {
  sheet: CharacterSheet;
  party: Party;
  clocks: Clock[];
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  commitParty: (m: (d: Party) => void) => void;
  onSaveClock: (clock: Clock) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState(1);
  const [badGuyClockId, setBadGuyClockId] = useState('');
  const [actionsTaken, setActionsTaken] = useState(0);
  const [goalDraft, setGoalDraft] = useState(party.Goal);
  const [questMotifIndex, setQuestMotifIndex] = useState(0);
  const [questDraft, setQuestDraft] = useState(sheet.Motifs[0]?.Quest ?? '');
  const [assetChoice, setAssetChoice] = useState('');
  const [projectClockId, setProjectClockId] = useState('');

  const actionsAllowed = campActionsAllowed(party.PartyLevel);
  const actionsLeft = actionsAllowed - actionsTaken;
  const openClocks = clocks.filter((c) => c.Status === 'Open');

  function advanceBadGuyClock() {
    const clock = openClocks.find((c) => c.Id === badGuyClockId);
    if (!clock) return;
    const ticks = Math.max(1, days);
    onSaveClock({ ...clock, SuccessMarks: tickClock(clock, ticks), History: [{ Id: newId('h'), At: nowIso(), Text: `Advanced ${ticks} at Make Camp (${days} day${days === 1 ? '' : 's'}).` }, ...clock.History] });
  }

  function spendAction(fn: () => void) {
    if (actionsLeft <= 0) return;
    fn();
    setActionsTaken(actionsTaken + 1);
  }

  function setPartyGoal() {
    spendAction(() => commitParty((d) => { d.Goal = goalDraft.trim(); }));
  }

  function changeQuest() {
    spendAction(() => commitSheet((d) => { d.Motifs[questMotifIndex].Quest = questDraft.trim(); }));
  }

  function useCampAsset() {
    const asset = party.CampAssets.find((a) => a.Id === assetChoice);
    if (!asset) return;
    spendAction(() => commitParty((d) => {
      d.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'used', Name: 'Camp Asset', Effect: asset.Name });
    }));
  }

  function progressProjectClock(tier: RollTier) {
    const clock = clocks.find((c) => c.Id === projectClockId);
    if (!clock) return;
    spendAction(() => onSaveClock({
      ...clock,
      SuccessMarks: tickClock(clock, PROJECT_CLOCK_SEGMENTS[tier]),
      History: [{ Id: newId('h'), At: nowIso(), Text: `Progressed ${PROJECT_CLOCK_SEGMENTS[tier]} as a Camp Action (${tier}).` }, ...clock.History],
    }));
  }

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="camp-actions-title" tabIndex={-1}>
        <div className={modal.head}>
          <h2 id="camp-actions-title" className={modal.title}>Camp Actions</h2>
          <p className={modal.subtitle}>
            Resetting Statuses, Conditions, Armor, and Recoveries? Use the <strong>Make Camp</strong> button in Statuses above — this covers the rest.
          </p>
        </div>
        <div className={modal.body}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Advance a Bad Guy Clock</div>
            {openClocks.length === 0 ? (
              <p className={styles.empty}>No open Clocks — the GM can create one from the Campaign Shell.</p>
            ) : (
              <div className={`tap-row ${styles.row}`}>
                <select className={`tap-inline ${styles.select}`} value={badGuyClockId} onChange={(e) => setBadGuyClockId(e.target.value)}>
                  <option value="">Choose a Clock…</option>
                  {openClocks.map((c) => <option key={c.Id} value={c.Id}>{c.Title}</option>)}
                </select>
                <input type="number" min={1} className={`tap-inline ${styles.numberInput}`} value={days} onChange={(e) => setDays(Math.max(1, parseInt(e.target.value, 10) || 1))} aria-label="Days at Camp" />
                <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={!badGuyClockId} onClick={advanceBadGuyClock}>Advance</button>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Eligible for advancement?</div>
            <p className={styles.hint}>
              A full Motif Potential track, Bond Track, or the party&rsquo;s Rapport can be cleared from Advancement above — Level Up, Forge a Bond, or Progress the Party.
            </p>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Camp Actions — {actionsLeft} of {actionsAllowed} left</div>

            <div className={styles.actionRow}>
              <input className={`tap-inline ${styles.textInput}`} value={goalDraft} placeholder="Party Goal…" onChange={(e) => setGoalDraft(e.target.value)} />
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={actionsLeft <= 0} onClick={setPartyGoal}>Set Party Goal</button>
            </div>

            <div className={styles.actionRow}>
              <select className={`tap-inline ${styles.select}`} value={questMotifIndex} onChange={(e) => { const i = Number(e.target.value); setQuestMotifIndex(i); setQuestDraft(sheet.Motifs[i]?.Quest ?? ''); }}>
                {sheet.Motifs.map((m, i) => <option key={i} value={i}>{m.Name || `Motif ${i + 1}`}</option>)}
              </select>
              <input className={`tap-inline ${styles.textInput}`} value={questDraft} placeholder="Quest…" onChange={(e) => setQuestDraft(e.target.value)} />
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={actionsLeft <= 0} onClick={changeQuest}>Change Quest</button>
            </div>

            <div className={styles.actionRow}>
              <select className={`tap-inline ${styles.select}`} value={assetChoice} onChange={(e) => setAssetChoice(e.target.value)} disabled={party.CampAssets.length === 0}>
                <option value="">{party.CampAssets.length === 0 ? 'No Camp Assets' : 'Choose a Camp Asset…'}</option>
                {party.CampAssets.map((a) => <option key={a.Id} value={a.Id}>{a.Name}</option>)}
              </select>
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={actionsLeft <= 0 || !assetChoice} onClick={useCampAsset}>Use Camp Asset</button>
            </div>

            <div className={styles.actionRow}>
              <select className={`tap-inline ${styles.select}`} value={projectClockId} onChange={(e) => setProjectClockId(e.target.value)} disabled={clocks.length === 0}>
                <option value="">{clocks.length === 0 ? 'No Clocks' : 'Choose a project Clock…'}</option>
                {clocks.map((c) => <option key={c.Id} value={c.Id}>{c.Title}</option>)}
              </select>
              <TierChoiceRow disabled={actionsLeft <= 0 || !projectClockId} onChoose={progressProjectClock} />
            </div>
          </div>

          <button type="button" className={`tap-inline ${modal.secondaryAction} ${styles.close}`} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

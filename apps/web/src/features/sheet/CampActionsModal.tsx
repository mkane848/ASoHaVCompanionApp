import { useState } from 'react';
import type { CharacterSheet, Clock, Party, RollTier } from '@asohav/shared';
import { campActionsAllowed, newId, nowIso, rewriteMotifTag, tickClock } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { TierChoiceRow } from './TierChoiceRow.js';
import modal from '../../styles/modal.module.css';
import styles from './CampActionsModal.module.css';

const PROJECT_CLOCK_SEGMENTS: Record<RollTier, number> = { Tier3: 3, Tier2: 2, Tier1: 1 };

/** The Make Camp pieces not already covered by the "Make Camp" button in `StatusesPanel.tsx`
 *  (`MakeCampModal.tsx` — clearing a Condition, refreshing Armor, and the Load lock). This modal
 *  covers: advancing a Bad Guy Clock, a reminder to check Advancement for a full track, and Camp
 *  Actions (Party Level + 1 per player: change the Party Goal, rewrite or update a Skill or Flaw
 *  Tag, use a Camp Asset, or progress a personal project Clock). The "rewrite a Tag" action
 *  replaced the original "change a personal Quest" one in V0.6 slice 4 (`WorkPlan-V0.6.md`
 *  Section A2: "Change personal Drive/Want" becomes "Rewrite or update any one of your Skill or
 *  Flaw Tags") — a Motif's Quest is still freely editable on the sheet itself, just no longer
 *  spent as a Camp Action of its own. */
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
  const [tagMotifIndex, setTagMotifIndex] = useState(0);
  const [tagCategory, setTagCategory] = useState<'Skill' | 'Flaw'>('Skill');
  const [tagExistingIndex, setTagExistingIndex] = useState<number | null>(null);
  const [tagText, setTagText] = useState('');
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

  const existingTags = tagCategory === 'Skill' ? sheet.Motifs[tagMotifIndex]?.SkillTags ?? [] : sheet.Motifs[tagMotifIndex]?.FlawTags ?? [];

  function rewriteTag() {
    spendAction(() => {
      commitSheet((d) => { rewriteMotifTag(d.Motifs[tagMotifIndex], tagCategory, tagExistingIndex, tagText); });
      setTagText('');
      setTagExistingIndex(null);
    });
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
            Clearing a Condition, refreshing Armor, or Recuperating? Use the <strong>Make Camp</strong> button in Statuses above — this covers the rest.
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
              A full Motif Potential track, Bond Track, or the party&rsquo;s Rapport now advances at your next Make Camp — look for a &ldquo;Ready to advance&rdquo; button on that track in Motifs or Advancement above (or Forge a Bond there, if a Bond Track is full).
            </p>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Camp Actions — {actionsLeft} of {actionsAllowed} left</div>

            <div className={styles.actionRow}>
              <input className={`tap-inline ${styles.textInput}`} value={goalDraft} placeholder="Party Goal…" onChange={(e) => setGoalDraft(e.target.value)} />
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={actionsLeft <= 0} onClick={setPartyGoal}>Set Party Goal</button>
            </div>

            <div className={styles.actionRow}>
              <select className={`tap-inline ${styles.select}`} value={tagMotifIndex} onChange={(e) => { setTagMotifIndex(Number(e.target.value)); setTagExistingIndex(null); }}>
                {sheet.Motifs.map((m, i) => <option key={i} value={i}>{m.Name || `Motif ${i + 1}`}</option>)}
              </select>
              <select className={`tap-inline ${styles.select}`} value={tagCategory} onChange={(e) => { setTagCategory(e.target.value as 'Skill' | 'Flaw'); setTagExistingIndex(null); }}>
                <option value="Skill">Skill Tag</option>
                <option value="Flaw">Flaw Tag</option>
              </select>
              <select className={`tap-inline ${styles.select}`} value={tagExistingIndex ?? ''} onChange={(e) => setTagExistingIndex(e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">Add a new tag</option>
                {existingTags.map((t, i) => <option key={i} value={i}>Replace “{t}”</option>)}
              </select>
              <input className={`tap-inline ${styles.textInput}`} value={tagText} placeholder="Tag text…" onChange={(e) => setTagText(e.target.value)} />
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={actionsLeft <= 0 || !tagText.trim()} onClick={rewriteTag}>Rewrite Tag</button>
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

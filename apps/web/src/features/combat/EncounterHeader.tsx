import { useState } from 'react';
import type { CombatParticipant, Encounter } from '@asohav/shared';
import { endTurn, firstToActFromInitiative, firstToActFromSurprise, nextActor, startNewRound } from '@asohav/shared';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { log } from './encounterLog.js';
import styles from './EncounterView.module.css';

/** The Encounter's head: the Combat Goal, round and acting side, and the GM's turn controls. */
export function EncounterHeader({
  encounter,
  isGM,
  readOnly,
  livingParticipants,
  commitEncounter,
  onRequestEnd,
  onAddParticipant,
}: {
  encounter: Encounter;
  isGM: boolean;
  readOnly: boolean;
  livingParticipants: CombatParticipant[];
  commitEncounter: (m: (d: Encounter) => void) => void;
  onRequestEnd: () => void;
  onAddParticipant: () => void;
}) {
  const matcher = useGlossaryMatcher();
  const [initiativeTotal, setInitiativeTotal] = useState('');
  const [surprisedSide, setSurprisedSide] = useState<'Party' | 'Enemies' | ''>('');
  const actingParticipant = encounter.Participants.find((p) => p.Id === encounter.ActingParticipantId);
  const pairedParticipant = encounter.Participants.find((p) => p.Id === encounter.PairedParticipantId);

  /** V0.5: AP recharges at the end of that Hero's own turn, not at the start of a new round.
   *  Ends the current actor's turn (and their paired partner's, if two Heroes moved together this
   *  turn) via `endTurn`, then suggests who logically goes next via `nextActor` — a default the GM
   *  can always override by picking a different participant from the selects above. */
  function endTurnAction() {
    if (!encounter.ActingParticipantId) return;
    commitEncounter((d) => {
      const actingId = d.ActingParticipantId!;
      const pairedId = d.PairedParticipantId;
      const actorName = d.Participants.find((p) => p.Id === actingId)?.Name ?? 'Someone';
      const partnerName = pairedId ? d.Participants.find((p) => p.Id === pairedId)?.Name : null;
      d.Participants = endTurn(d.Participants, actingId, pairedId);
      d.ActingSide = nextActor(d.Participants, d.ActingSide);
      d.ActingParticipantId = null;
      d.PairedParticipantId = null;
      log(`${actorName}${partnerName ? ` and ${partnerName}` : ''} end${partnerName ? '' : 's'} their turn.`)(d);
    });
  }

  /** V0.6 Combat Loop step 4 (slice 3): declaring one side wholly surprised skips the initiative
   *  roll (step 5) entirely and sets `ActingSide` directly via `firstToActFromSurprise()`. The
   *  doc's further "at the GM's discretion" extra effects (a head-start round, fewer actions,
   *  Disadvantage) are open-ended GM narration, not something this function computes. */
  function declareSurprise() {
    if (!surprisedSide) return;
    const side = surprisedSide;
    commitEncounter((d) => {
      d.ActingSide = firstToActFromSurprise(side);
      log(`${side} surprised — ${d.ActingSide} acts first.`)(d);
    });
    setSurprisedSide('');
  }

  return (
    <div className={styles.header}>
      <h2 className={styles.goal}>
        {encounter.CombatGoal ? <GlossaryText text={encounter.CombatGoal} matcher={matcher} /> : 'No Combat Goal set.'}
      </h2>
      <div className={styles.statusRow}>
        <span>Round {encounter.Round}</span>
        <span>Acting: {encounter.ActingSide ?? 'Not rolled'}</span>
        <span>
          Current actor: {actingParticipant?.Name ?? 'None picked'}
          {pairedParticipant ? ` & ${pairedParticipant.Name}` : ''}
        </span>
      </div>
      {isGM && !readOnly && (
        <>
          <div className={`tap-row ${styles.initiativeRow}`}>
            <label className={styles.initiativeLabel} htmlFor="surprised-side">
              Surprised side
            </label>
            <select
              id="surprised-side"
              className={styles.headerSelect}
              value={surprisedSide}
              onChange={(e) => setSurprisedSide(e.target.value as 'Party' | 'Enemies' | '')}
            >
              <option value="">Neither — roll initiative below</option>
              <option value="Party">Party</option>
              <option value="Enemies">Enemies</option>
            </select>
            <button className={`tap-inline ${styles.headerButton}`} disabled={!surprisedSide} onClick={declareSurprise}>
              Declare Surprise
            </button>
          </div>
          <p className={styles.note}>
            Surprise skips initiative — the other side acts first. Anything beyond that (a
            head-start round, fewer actions, Disadvantage for the surprised side) is the GM's
            own call at the table.
          </p>
          <div className={`tap-row ${styles.initiativeRow}`}>
            <label className={styles.initiativeLabel} htmlFor="initiative-total">
              Initiative (2d6)
            </label>
            <input
              id="initiative-total"
              className={styles.initiativeInput}
              type="number"
              min={2}
              max={12}
              value={initiativeTotal}
              onChange={(e) => setInitiativeTotal(e.target.value)}
            />
            <button
              className={`tap-inline ${styles.headerButton}`}
              disabled={!initiativeTotal}
              onClick={() => {
                commitEncounter((d) => { d.ActingSide = firstToActFromInitiative(parseInt(initiativeTotal, 10)); });
                setInitiativeTotal('');
              }}
            >
              Roll Initiative
            </button>
          </div>
          <div className={`tap-row ${styles.initiativeRow}`}>
            <label className={styles.initiativeLabel} htmlFor="acting-participant">
              Current actor
            </label>
            <select
              id="acting-participant"
              className={styles.headerSelect}
              value={encounter.ActingParticipantId ?? ''}
              onChange={(e) => commitEncounter((d) => { d.ActingParticipantId = e.target.value || null; })}
            >
              <option value="">— pick who's acting —</option>
              {livingParticipants.map((p) => (
                <option key={p.Id} value={p.Id}>
                  {p.Name} ({p.Kind === 'PC' ? 'Party' : 'Enemy'})
                </option>
              ))}
            </select>
            <label className={styles.initiativeLabel} htmlFor="paired-participant">
              Acting together with
            </label>
            <select
              id="paired-participant"
              className={styles.headerSelect}
              value={encounter.PairedParticipantId ?? ''}
              disabled={!encounter.ActingParticipantId}
              onChange={(e) => commitEncounter((d) => { d.PairedParticipantId = e.target.value || null; })}
            >
              <option value="">No pairing</option>
              {livingParticipants
                .filter((p) => p.Id !== encounter.ActingParticipantId)
                .map((p) => (
                  <option key={p.Id} value={p.Id}>
                    {p.Name}
                  </option>
                ))}
            </select>
          </div>
          <div className={`action-grid ${styles.actionsRow}`}>
            <button className={`tap-inline ${styles.headerButton}`} disabled={!encounter.ActingParticipantId} onClick={endTurnAction}>
              End Turn
            </button>
            <button
              className={`tap-inline ${styles.headerButton}`}
              onClick={() =>
                commitEncounter((d) => {
                  d.Participants = startNewRound(d.Participants);
                  d.Round += 1;
                  d.ActingParticipantId = null;
                  d.PairedParticipantId = null;
                  log('New round.')(d);
                })
              }
            >
              Next Round
            </button>
            <button className={`tap-inline ${styles.headerButton}`} onClick={onRequestEnd}>
              End Combat
            </button>
            <button className={`tap-inline ${styles.headerButton}`} onClick={onAddParticipant}>
              Add Participant
            </button>
            <button
              className={`tap-inline ${styles.headerButton} ${encounter.CombatGoalAchieved ? styles.headerButtonActive : ''}`}
              disabled={!encounter.CombatGoal.trim()}
              onClick={() => commitEncounter((d) => {
                d.CombatGoalAchieved = !d.CombatGoalAchieved;
                log(d.CombatGoalAchieved ? 'Combat Goal achieved — everyone may mark Potential.' : 'Combat Goal un-marked.')(d);
              })}
            >
              {encounter.CombatGoalAchieved ? 'Goal Achieved ✓' : 'Mark Goal Achieved'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import type { CombatParticipant, Encounter, Party } from '@asohav/shared';
import { beginTurn, endTurn, nextActor, startNewRound } from '@asohav/shared';
import { GlossaryText } from '../../components/GlossaryText.js';
import { MisfortuneCounter } from '../campaign/MisfortuneCounter.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { log } from './encounterLog.js';
import styles from './EncounterView.module.css';

/** The Encounter's head: the Combat Goal, round and acting side, the GM's Misfortune (slice 2 —
 *  spent on Hard Moves and enemy costs mid-fight, so it sits where the GM runs the turns), and the
 *  GM's turn controls. The GM picks which side acts first (during round 1 only), then marks
 *  individual units as Surprised in round 1; Fortify ends "until the beginning of your next turn"
 *  via `beginTurn()` when the actor is picked or a Team-Up partner is chosen. */
export function EncounterHeader({
  encounter,
  party,
  isGM,
  readOnly,
  livingParticipants,
  commitEncounter,
  onRequestEnd,
  onAddParticipant,
}: {
  encounter: Encounter;
  party: Party;
  isGM: boolean;
  readOnly: boolean;
  livingParticipants: CombatParticipant[];
  commitEncounter: (m: (d: Encounter) => void) => void;
  onRequestEnd: () => void;
  onAddParticipant: () => void;
}) {
  const matcher = useGlossaryMatcher();
  const actingParticipant = encounter.Participants.find((p) => p.Id === encounter.ActingParticipantId);
  const pairedParticipant = encounter.Participants.find((p) => p.Id === encounter.PairedParticipantId);

  /** AP recharges at the end of that unit's own turn, not at the start of a new round.
   *  Ends the current actor's turn (and their Team-Up partner's) via `endTurn`, then suggests which
   *  side logically goes next via `nextActor` — a default the GM can always override by picking a
   *  different participant from the selects above. */
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

  return (
    <div className={styles.header}>
      <h2 className={styles.goal}>
        {encounter.CombatGoal ? <GlossaryText text={encounter.CombatGoal} matcher={matcher} /> : 'No Combat Goal set.'}
      </h2>
      <div className={styles.statusRow}>
        <span>Round {encounter.Round}</span>
        <span>Acting: {encounter.ActingSide ?? 'Not chosen'}</span>
        <span>
          Current actor: {actingParticipant?.Name ?? 'None picked'}
          {pairedParticipant ? ` & ${pairedParticipant.Name}` : ''}
        </span>
        {livingParticipants.some((p) => p.Surprised) && (
          <span>Surprised: {livingParticipants.filter((p) => p.Surprised).map((p) => p.Name).join(', ')}</span>
        )}
      </div>
      <MisfortuneCounter campaignId={encounter.CampaignId} misfortune={party.Misfortune} isGM={isGM} archived={readOnly} compact />
      {isGM && !readOnly && (
        <>
          {encounter.Round === 1 && (
            <div className={`tap-row ${styles.initiativeRow}`}>
              <label className={styles.initiativeLabel} htmlFor="first-side">
                Acts first
              </label>
              <select
                id="first-side"
                className={styles.headerSelect}
                value={encounter.FirstSide ?? ''}
                onChange={(e) =>
                  commitEncounter((d) => {
                    const side = (e.target.value as 'Party' | 'Enemies' | '') || null;
                    d.FirstSide = side;
                    if (!d.ActingSide && side) {
                      d.ActingSide = side;
                    }
                    if (side) {
                      log(`${side} act first.`)(d);
                    }
                  })
                }
              >
                <option value="">— pick —</option>
                <option value="Party">Party</option>
                <option value="Enemies">Enemies</option>
              </select>
            </div>
          )}
          {encounter.Round === 1 && (
            <p className={styles.note}>
              Whichever side is best positioned in the fiction takes the first turn, and acts first
              every round.
            </p>
          )}
          {encounter.Round === 1 && (
            <div className={`tap-row ${styles.initiativeRow}`} role="group" aria-labelledby="surprised-label">
              <span className={styles.initiativeLabel} id="surprised-label">
                Surprised
              </span>
              {livingParticipants.map((p) => (
                <button
                  key={p.Id}
                  type="button"
                  aria-pressed={p.Surprised ?? false}
                  className={`tap-inline ${styles.headerButton} ${p.Surprised ? styles.headerButtonActive : ''}`}
                  onClick={() =>
                    commitEncounter((d) => {
                      const participant = d.Participants.find((x) => x.Id === p.Id);
                      if (participant) {
                        participant.Surprised = !participant.Surprised;
                        log(`${p.Name} is ${participant.Surprised ? 'surprised' : 'no longer surprised'}.`)(d);
                      }
                    })
                  }
                >
                  {p.Name}
                </button>
              ))}
            </div>
          )}
          {encounter.Round === 1 && (
            <p className={styles.note}>
              A surprised unit can't take a turn or use a Reaction during the first round.
            </p>
          )}
          <div className={`tap-row ${styles.initiativeRow}`}>
            <label className={styles.initiativeLabel} htmlFor="acting-participant">
              Current actor
            </label>
            <select
              id="acting-participant"
              className={styles.headerSelect}
              value={encounter.ActingParticipantId ?? ''}
              onChange={(e) =>
                commitEncounter((d) => {
                  d.ActingParticipantId = e.target.value || null;
                  if (d.ActingParticipantId) {
                    d.Participants = beginTurn(d.Participants, [d.ActingParticipantId]);
                  }
                })
              }
            >
              <option value="">— pick who's acting —</option>
              {livingParticipants.map((p) => (
                <option key={p.Id} value={p.Id}>
                  {`${p.Name} (${p.Kind === 'PC' ? 'Party' : 'Enemy'})${p.Surprised ? ' — surprised' : ''}`}
                </option>
              ))}
            </select>
            <label className={styles.initiativeLabel} htmlFor="paired-participant">
              Team-Up with
            </label>
            <select
              id="paired-participant"
              className={styles.headerSelect}
              value={encounter.PairedParticipantId ?? ''}
              disabled={encounter.ActingParticipantId ? actingParticipant?.Kind !== 'PC' : true}
              onChange={(e) =>
                commitEncounter((d) => {
                  d.PairedParticipantId = e.target.value || null;
                  if (d.PairedParticipantId) {
                    d.Participants = beginTurn(d.Participants, [d.PairedParticipantId]);
                  }
                })
              }
            >
              <option value="">No Team-Up</option>
              {livingParticipants
                .filter((p) => p.Kind === 'PC' && p.Id !== encounter.ActingParticipantId)
                .map((p) => (
                  <option key={p.Id} value={p.Id}>
                    {p.Name}
                  </option>
                ))}
            </select>
          </div>
          {encounter.PairedParticipantId && (
            <p className={styles.note}>
              Team-Up: each Hero refreshes and spends AP separately. After both finish, the Enemy
              side takes two consecutive turns — and a Legendary enemy takes two turns in a row.
            </p>
          )}
          {livingParticipants.some((p) => p.IsBoss) && (
            <p className={styles.note}>A Legendary enemy isn't limited to one turn per round.</p>
          )}
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
                  d.ActingSide = d.FirstSide;
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

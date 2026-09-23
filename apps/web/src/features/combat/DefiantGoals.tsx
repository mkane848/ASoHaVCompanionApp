import { useState } from 'react';
import type { CombatParticipant, Encounter } from '@asohav/shared';
import { newId } from '@asohav/shared';
import { GlossaryText } from '../../components/GlossaryText.js';
import { SectionHead } from '../../components/SectionHead.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { log } from './encounterLog.js';
import styles from './EncounterView.module.css';

/** "A minority may declare a Defiant Goal" — any Hero declares their own; the GM marks each one
 *  achieved. If an achieved Defiant Goal supersedes the main Combat Goal, the table can end Combat
 *  for everyone, even if the original Goal is not yet achieved. */
export function DefiantGoals({
  encounter,
  myParticipant,
  isGM,
  readOnly,
  commitEncounter,
}: {
  encounter: Encounter;
  myParticipant: CombatParticipant | undefined;
  isGM: boolean;
  readOnly: boolean;
  commitEncounter: (m: (d: Encounter) => void) => void;
}) {
  const matcher = useGlossaryMatcher();
  const [declareText, setDeclareText] = useState('');

  return (
    <div className={styles.section}>
      <SectionHead title="Defiant Goals" size="sm" />
      <p className={styles.note}>
        A Defiant Goal lets only the Heroes who declared it leave Combat — unless the table agrees it supersedes the Combat Goal.
      </p>
      {encounter.DefiantGoals.length === 0 && <p className={styles.empty}>None declared.</p>}
      {encounter.DefiantGoals.map((g) => {
        const owner = encounter.Participants.find((p) => p.Id === g.ParticipantId);
        return (
          <div key={g.Id} className={styles.goalItem}>
            <span className={g.Achieved ? styles.goalAchieved : ''}>
              {owner?.Name ?? 'Someone'}: <GlossaryText text={g.Text} matcher={matcher} />
            </span>
            {isGM && !readOnly && (
              <>
                <button
                  className={`tap-inline ${styles.lightButton}`}
                  onClick={() => commitEncounter((d) => { const found = d.DefiantGoals.find((x) => x.Id === g.Id); if (found) found.Achieved = !found.Achieved; })}
                >
                  {g.Achieved ? 'Unmark' : 'Mark Achieved'}
                </button>
                {g.Achieved && !encounter.CombatGoalAchieved && (
                  <button
                    className={`tap-inline ${styles.lightButton}`}
                    onClick={() => {
                      commitEncounter((d) => {
                        d.CombatGoalAchieved = true;
                        log(`The table agrees ${owner?.Name ?? 'someone'}'s Defiant Goal supersedes the Combat Goal — Combat ends for everyone.`)(d);
                      });
                    }}
                  >
                    Supersedes the Combat Goal
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
      {myParticipant && !readOnly && (
        <div className={styles.declareRow}>
          <input className={styles.declareInput} value={declareText} onChange={(e) => setDeclareText(e.target.value)} placeholder="Declare your own Defiant Goal…" />
          <button
            className={`tap-inline ${styles.lightButton}`}
            disabled={!declareText.trim()}
            onClick={() => {
              commitEncounter((d) => { d.DefiantGoals.push({ Id: newId('dg'), ParticipantId: myParticipant.Id, Text: declareText.trim(), Achieved: false }); });
              setDeclareText('');
            }}
          >
            Declare
          </button>
        </div>
      )}
    </div>
  );
}

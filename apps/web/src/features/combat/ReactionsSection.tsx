import { useState } from 'react';
import type { CharacterSheet, CombatParticipant, Encounter } from '@asohav/shared';
import { braceForcedMovement, shiftRange } from '@asohav/shared';
import { SectionHead } from '../../components/SectionHead.js';
import { log } from './encounterLog.js';
import styles from './EncounterView.module.css';

/** The viewer's own Reactions outside their turn. Always mounted, so a half-entered push survives
 *  re-renders. */
export function ReactionsSection({
  myParticipant,
  mySheet,
  canOpportunityAttack,
  readOnly,
  commitEncounter,
  onOpportunityAttack,
}: {
  myParticipant: CombatParticipant | undefined;
  mySheet: CharacterSheet | null;
  canOpportunityAttack: boolean;
  readOnly: boolean;
  commitEncounter: (m: (d: Encounter) => void) => void;
  onOpportunityAttack: () => void;
}) {
  const [bracing, setBracing] = useState(false);
  const [pushBandsInput, setPushBandsInput] = useState('');

  /** Brace (V0.6 Reaction Move): reduce forced-movement distance by up to your own Mettle
   *  (minimum 1 band reduction). Manually triggered and self-reported, same as everywhere else
   *  Combat asks "what happened at the table" rather than deriving it — there's no stored record
   *  of "you were just pushed N bands" to react to automatically. Spends 1 AP. */
  function brace() {
    if (!myParticipant) return;
    const pushed = parseInt(pushBandsInput, 10);
    if (!Number.isFinite(pushed) || pushed <= 0) return;
    const mettle = mySheet?.Virtues.find((v) => v.VirtueId === 'v-mettle')?.Score ?? 0;
    const remaining = braceForcedMovement(pushed, mettle);
    const reduction = pushed - remaining;
    commitEncounter((d) => {
      const p = d.Participants.find((x) => x.Id === myParticipant.Id);
      if (p) {
        p.Range = shiftRange(p.Range, -reduction);
        p.ActionPointsRemaining = Math.max(0, p.ActionPointsRemaining - 1);
      }
      log(`${myParticipant.Name} Braces, cutting the push by ${reduction}.`)(d);
    });
    setBracing(false);
    setPushBandsInput('');
  }

  if (!((canOpportunityAttack || myParticipant) && !readOnly)) return null;
  const isSurprised = myParticipant?.Surprised ?? false;
  return (
    <div className={styles.section}>
      <SectionHead title="Reactions" size="sm" />
      {isSurprised && (
        <p className={styles.note}>
          You're surprised — no Reactions this round.
        </p>
      )}
      {canOpportunityAttack && (
        <button
          className={`tap-inline ${styles.actionButton}`}
          disabled={isSurprised || (myParticipant?.ActionPointsRemaining ?? 0) <= 0}
          onClick={onOpportunityAttack}
        >
          Opportunity Attack (1 AP)
        </button>
      )}
      {myParticipant &&
        (bracing ? (
          <div className={styles.offerRow}>
            <input
              className={styles.initiativeInput}
              type="number"
              min={1}
              value={pushBandsInput}
              onChange={(e) => setPushBandsInput(e.target.value)}
              placeholder="Spaces pushed"
              aria-label="Spaces pushed"
            />
            <button className={`tap-inline ${styles.actionButton}`} disabled={!pushBandsInput} onClick={brace}>
              Brace (1 AP)
            </button>
            <button className={`tap-inline ${styles.actionButton}`} onClick={() => { setBracing(false); setPushBandsInput(''); }}>
              Cancel
            </button>
          </div>
        ) : (
          <button className={`tap-inline ${styles.actionButton}`} disabled={isSurprised} onClick={() => setBracing(true)}>
            Brace (1 AP)
          </button>
        ))}
    </div>
  );
}

import { useState } from 'react';
import type { CharacterSheet, CombatParticipant, Encounter } from '@asohav/shared';
import { resistForcedMovementBands, shiftRange } from '@asohav/shared';
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
  const [resistingPush, setResistingPush] = useState(false);
  const [pushBandsInput, setPushBandsInput] = useState('');

  /** Resist (V0.5's remaining unbuilt Reaction Move): reduce forced-movement distance by up to
   *  your own Mettle. Manually triggered and self-reported, same as everywhere else Combat asks
   *  "what happened at the table" rather than deriving it — there's no stored record of "you were
   *  just pushed N bands" to react to automatically. */
  function resistPush() {
    if (!myParticipant) return;
    const pushed = parseInt(pushBandsInput, 10);
    if (!Number.isFinite(pushed) || pushed <= 0) return;
    const mettle = mySheet?.Virtues.find((v) => v.VirtueId === 'v-mettle')?.Score ?? 0;
    const reduction = resistForcedMovementBands(pushed, mettle);
    commitEncounter((d) => {
      const p = d.Participants.find((x) => x.Id === myParticipant.Id);
      if (p) p.Range = shiftRange(p.Range, -reduction);
      log(`${myParticipant.Name} Resists, pulling back ${reduction} band${reduction === 1 ? '' : 's'}.`)(d);
    });
    setResistingPush(false);
    setPushBandsInput('');
  }

  if (!((canOpportunityAttack || myParticipant) && !readOnly)) return null;
  return (
    <div className={styles.section}>
      <SectionHead title="Reactions" size="sm" />
      {canOpportunityAttack && (
        <button className={`tap-inline ${styles.actionButton}`} onClick={onOpportunityAttack}>
          Opportunity Attack
        </button>
      )}
      {myParticipant &&
        (resistingPush ? (
          <div className={styles.offerRow}>
            <input
              className={styles.initiativeInput}
              type="number"
              min={1}
              value={pushBandsInput}
              onChange={(e) => setPushBandsInput(e.target.value)}
              placeholder="Bands pushed"
              aria-label="Bands pushed"
            />
            <button className={`tap-inline ${styles.actionButton}`} disabled={!pushBandsInput} onClick={resistPush}>
              Resist (up to Mettle)
            </button>
            <button className={`tap-inline ${styles.actionButton}`} onClick={() => { setResistingPush(false); setPushBandsInput(''); }}>
              Cancel
            </button>
          </div>
        ) : (
          <button className={`tap-inline ${styles.actionButton}`} onClick={() => setResistingPush(true)}>
            Resist a forced push
          </button>
        ))}
    </div>
  );
}

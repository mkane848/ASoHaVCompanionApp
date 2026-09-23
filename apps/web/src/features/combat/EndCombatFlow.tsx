import { useState } from 'react';
import type { CharacterSheet, CombatParticipant, Encounter, Library } from '@asohav/shared';
import { addMotifPotential } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import styles from './EncounterView.module.css';

/** What each Hero does when the Combat Goal is achieved or their Defiant Goal is achieved — self-serve,
 *  since only a sheet's own owner can write it. Always mounted (and checking its own condition) so the
 *  per-viewer "already claimed" guard survives the GM toggling values off and on. */
export function EndCombatFlow({
  encounter,
  library,
  myParticipant,
  mySheet,
  readOnly,
  commitSheet,
}: {
  encounter: Encounter;
  library: Library;
  myParticipant: CombatParticipant | undefined;
  mySheet: CharacterSheet | null;
  readOnly: boolean;
  commitSheet: (m: (d: CharacterSheet) => void) => void;
}) {
  /** Self-serve, per-viewer: whether *this* player has already claimed Potential for this Encounter.
   *  Not persisted on the Encounter itself — same trust model as everywhere else a player reports their
   *  own action — just a local guard against a double-click. */
  const [potentialClaimed, setPotentialClaimed] = useState(false);
  const [potentialMotifIndex, setPotentialMotifIndex] = useState<number | null>(null);

  const myDefiantGoalAchieved = !!myParticipant && encounter.DefiantGoals.some((g) => g.ParticipantId === myParticipant.Id && g.Achieved);
  const canClaim = myParticipant && mySheet && !readOnly;
  const shouldShow =
    canClaim && (encounter.CombatGoalAchieved || myDefiantGoalAchieved);
  const isDefiantGoalOnly = shouldShow && !encounter.CombatGoalAchieved && myDefiantGoalAchieved;

  /** Mark Potential on one of the player's Motifs and, if leaving via Defiant Goal, clear their Strain. */
  function claimPotential(motifIndex: number) {
    commitSheet((d) => {
      addMotifPotential(d.Motifs[motifIndex], 1, library.settings.PotentialTrackLength);
      // Ruleset-V0.6: when leaving via Defiant Goal, clear Strain (Heroes leaving the fight).
      if (isDefiantGoalOnly) {
        d.Strain = d.Strain.map(() => false);
      }
    });
    setPotentialClaimed(true);
  }

  if (!shouldShow) return null;

  return (
    <div className={`${styles.section} ${styles.offer}`}>
      {potentialClaimed ? (
        <>
          <p className={styles.offerText}>Potential marked.</p>
          <p className={styles.offerText}>
            If you completed a Condition's Clear Action during this scene, clear it on your sheet. Statuses stay until healed.
          </p>
        </>
      ) : (
        <>
          <p className={styles.offerText}>
            {isDefiantGoalOnly ? (
              <><strong>Your Defiant Goal is achieved</strong> — you can leave the Combat.</>
            ) : (
              <><strong>Combat Goal achieved.</strong></>
            )}{' '}
            Mark Potential on one Motif whose Skill or Flaw Tag you used during this Combat.
          </p>
          <div className={styles.offerRow}>
            <select
              className={styles.actionSelect}
              value={potentialMotifIndex ?? ''}
              onChange={(e) => setPotentialMotifIndex(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">— pick a Motif —</option>
              {mySheet.Motifs.map((m, i) => (
                <option key={i} value={i}>
                  {m.Name || `Motif ${i + 1}`}
                </option>
              ))}
            </select>
            <button
              className={`tap-inline ${styles.actionButton}`}
              disabled={potentialMotifIndex === null}
              onClick={() => { if (potentialMotifIndex !== null) claimPotential(potentialMotifIndex); }}
            >
              Mark Potential
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** The GM's "End Combat?" confirmation, opened from the header. */
export function EndCombatConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <ConfirmModal
      title="End Combat?"
      body="This ends the Combat for everyone. Each Hero marks Potential on one Motif they used — only a player can mark their own. Ending it clears every Hero's Strain; Statuses stay until healed."
      confirmLabel="End Combat"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

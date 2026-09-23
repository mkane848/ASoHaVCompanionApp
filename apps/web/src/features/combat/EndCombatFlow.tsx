import { useState } from 'react';
import type { CharacterSheet, CombatParticipant, Encounter, Library } from '@asohav/shared';
import { addMotifPotential } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import styles from './EncounterView.module.css';

/** What each Hero does when the Combat Goal is achieved — self-serve, since only a sheet's own
 *  owner can write it. Always mounted (and checking its own condition) so the per-viewer
 *  "already claimed" guard survives the GM toggling the Goal off and on. */
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
  /** Self-serve, per-viewer: whether *this* player has already claimed the Combat-Goal Potential
   *  mark this Encounter. Not persisted on the Encounter itself — same trust model as everywhere
   *  else a player reports their own action — just a local guard against a double-click, since
   *  `encounter.CombatGoalAchieved` can stay true for the rest of the fight once set. */
  const [potentialClaimed, setPotentialClaimed] = useState(false);
  const [potentialMotifIndex, setPotentialMotifIndex] = useState<number | null>(null);

  /** Combat Loop step 3 (slice 3): "When the Heroes achieve the Combat Goal... Each player marks
   *  Potential." Self-serve — only the viewer's own sheet can be written, same constraint as every
   *  other Combat mutation that touches a PC's own data. */
  function claimCombatGoalPotential(motifIndex: number) {
    commitSheet((d) => { addMotifPotential(d.Motifs[motifIndex], 1, library.settings.PotentialTrackLength); });
    setPotentialClaimed(true);
  }

  if (!(encounter.CombatGoalAchieved && myParticipant && mySheet && !readOnly)) return null;

  return (
    <div className={`${styles.section} ${styles.offer}`}>
      {potentialClaimed ? (
        <p className={styles.offerText}>Potential marked for achieving the Combat Goal.</p>
      ) : (
        <>
          <p className={styles.offerText}>
            <strong>Combat Goal achieved.</strong> Mark Potential on one of your Motifs.
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
              onClick={() => { if (potentialMotifIndex !== null) claimCombatGoalPotential(potentialMotifIndex); }}
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
      body="This closes the Encounter. Everyone should mark Potential on one of their Motifs if the Combat Goal was achieved — that's not automatic, since only a player can mark their own tracks."
      confirmLabel="End Combat"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

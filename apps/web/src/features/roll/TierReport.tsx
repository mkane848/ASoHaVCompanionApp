import { useState } from 'react';
import type { CharacterSheet, Library, Move, RollTier } from '@asohav/shared';
import { addMotifPotential, holdGrantForTier } from '@asohav/shared';
import { useMisfortune } from '../../lib/useMisfortune.js';
import { useRollReported } from './rollReport.js';
import heroStyles from './HeroRollBuilder.module.css';
import styles from './TierReport.module.css';

const TIER_LABELS: Record<RollTier, string> = { Tier3: '10+', Tier2: '7–9', Tier1: '6-' };
const ALL_TIERS: RollTier[] = ['Tier3', 'Tier2', 'Tier1'];

/** After the table rolls, the player reports the tier they hit and the app applies what follows
 *  from it — this app never rolls (CLAUDE.md). On any tier, a Move's Hold grant is applied.
 *  On a 6-, the GM gains 1 Misfortune. On a 6- outside Combat, the player marks Potential on one of
 *  their Motifs. In Combat, no Potential is marked on a 6- (it is marked when the Combat ends instead). */
export interface TierReportProps {
  move: Move;
  sheet: CharacterSheet;
  library: Library;
  commit: (mutator: (draft: CharacterSheet) => void) => void;
  /** A 6- outside Combat marks Potential on a Motif; inside Combat it doesn't (Potential is marked
   *  when Combat ends instead). Nothing mounts this in Combat yet, hence the default. */
  inCombat?: boolean;
}

// `sheet` is the optimistically committed one, so the Hold and Potential shown after a report
// already include what the report just applied.
export function TierReport({ move, sheet, library, commit, inCombat = false }: TierReportProps) {
  const [reportedTier, setReportedTier] = useState<RollTier | null>(null);
  const [markedMotifIndex, setMarkedMotifIndex] = useState<number | null>(null);
  const misfortune = useMisfortune();
  const rollReported = useRollReported();

  function reportTier(tier: RollTier) {
    const holdAmount = holdGrantForTier(move, tier);
    if (holdAmount > 0) {
      commit((d) => { d.Hold = (d.Hold ?? 0) + holdAmount; });
    }
    if (tier === 'Tier1') {
      misfortune.gain(`A 6- on ${move.Name}`);
    }
    rollReported?.();
    setReportedTier(tier);
  }

  function markMotifPotential(motifIndex: number) {
    if (markedMotifIndex !== null) return; // one-way — already marked
    commit((d) => { addMotifPotential(d.Motifs[motifIndex], 1, library.settings.PotentialTrackLength); });
    setMarkedMotifIndex(motifIndex);
  }

  function startNewRoll() {
    setReportedTier(null);
    setMarkedMotifIndex(null);
  }

  return (
    <div className={heroStyles.holdBlock}>
      <div className={heroStyles.holdLabel}>Report your result:</div>
      <div className={`tap-row ${heroStyles.holdRow}`}>
        {ALL_TIERS.map((t) => {
          const holdAmount = holdGrantForTier(move, t);
          const buttonText = holdAmount > 0
            ? `${TIER_LABELS[t]} · +${holdAmount} Hold`
            : TIER_LABELS[t];
          return (
            <button
              key={t}
              type="button"
              className={`tap-inline ${heroStyles.holdButton} ${reportedTier === t ? heroStyles.holdButtonGranted : ''}`}
              onClick={() => reportTier(t)}
              disabled={reportedTier !== null}
              aria-pressed={reportedTier === t}
            >
              {buttonText}
            </button>
          );
        })}
      </div>

      {reportedTier && (
        <>
          {holdGrantForTier(move, reportedTier) > 0 && (
            <div className={heroStyles.holdConfirmed}>
              Granted {holdGrantForTier(move, reportedTier)} Hold — now at {sheet.Hold ?? 0}.
            </div>
          )}

          {reportedTier === 'Tier1' && (
            <div className={heroStyles.holdConfirmed}>
              The GM gains 1 Misfortune.
            </div>
          )}

          {reportedTier === 'Tier1' && !inCombat && (
            <div>
              <div className={heroStyles.holdConfirmed}>You learn from your failures — mark Potential on one of your Motifs:</div>
              <div className={`tap-row ${heroStyles.holdRow}`}>
                {sheet.Motifs.map((motif, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`tap-inline ${heroStyles.holdButton} ${markedMotifIndex === index ? heroStyles.holdButtonGranted : ''}`}
                    onClick={() => markMotifPotential(index)}
                    disabled={markedMotifIndex !== null}
                  >
                    {motif.Name || `Motif ${index + 1}`}
                  </button>
                ))}
              </div>
              {markedMotifIndex !== null && (
                <div className={heroStyles.holdConfirmed}>
                  Marked Potential on {sheet.Motifs[markedMotifIndex].Name || `Motif ${markedMotifIndex + 1}`}.
                  {sheet.Motifs[markedMotifIndex].Potential >= library.settings.PotentialTrackLength && (
                    <> Its Potential track is full — advance it at your next Make Camp.</>
                  )}
                </div>
              )}
            </div>
          )}

          {reportedTier === 'Tier1' && inCombat && (
            <div className={heroStyles.holdConfirmed}>
              No Potential on a 6- in Combat — you mark it when the Combat ends.
            </div>
          )}

          <div className={styles.newRollRow}>
            <button
              type="button"
              className={`tap-inline ${heroStyles.holdButton}`}
              onClick={startNewRoll}
            >
              New roll
            </button>
          </div>
        </>
      )}
    </div>
  );
}

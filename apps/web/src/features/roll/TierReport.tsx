import { useState } from 'react';
import type { CharacterSheet, Library, Move, RollTier } from '@asohav/shared';
import { holdGrantForTier } from '@asohav/shared';
import styles from './HeroRollBuilder.module.css';

const HOLD_TIER_LABELS: Record<RollTier, string> = { Tier3: '10+', Tier2: '7–9', Tier1: 'a miss' };
const HOLD_TIERS: RollTier[] = ['Tier3', 'Tier2', 'Tier1'];

/** After the table rolls, the player reports the tier they hit and the app applies what follows
 *  from it — this app never rolls (CLAUDE.md). Today that is only a Move's Hold grant. */
export interface TierReportProps {
  move: Move;
  sheet: CharacterSheet;
  library: Library;
  commit: (mutator: (draft: CharacterSheet) => void) => void;
  /** A 6- outside Combat marks Potential on a Motif; inside Combat it doesn't (Potential is marked
   *  when Combat ends instead). Nothing mounts this in Combat yet, hence the default. */
  inCombat?: boolean;
}

export function TierReport({ move, sheet, commit }: TierReportProps) {
  const [grantedTier, setGrantedTier] = useState<RollTier | null>(null);
  const holdTiers = HOLD_TIERS.filter((t) => holdGrantForTier(move, t) > 0);
  if (holdTiers.length === 0) return null;

  function grantHold(tier: RollTier) {
    const amount = holdGrantForTier(move, tier);
    if (amount <= 0) return;
    commit((d) => { d.Hold = (d.Hold ?? 0) + amount; });
    setGrantedTier(tier);
  }

  return (
    <div className={styles.holdBlock}>
      <div className={styles.holdLabel}>Hold this Move grants — report which tier you hit:</div>
      <div className={`tap-row ${styles.holdRow}`}>
        {holdTiers.map((t) => (
          <button
            key={t}
            type="button"
            className={`tap-inline ${styles.holdButton} ${grantedTier === t ? styles.holdButtonGranted : ''}`}
            onClick={() => grantHold(t)}
          >
            On {HOLD_TIER_LABELS[t]}: +{holdGrantForTier(move, t)} Hold
          </button>
        ))}
      </div>
      {grantedTier && <div className={styles.holdConfirmed}>Granted {holdGrantForTier(move, grantedTier)} Hold — now at {sheet.Hold ?? 0}.</div>}
    </div>
  );
}

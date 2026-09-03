import type { RollTier } from '@asohav/shared';
import styles from './TierChoiceRow.module.css';

const TIER_LABELS: Record<RollTier, string> = { Tier3: '10+', Tier2: '7–9', Tier1: '6-' };
const TIERS: RollTier[] = ['Tier3', 'Tier2', 'Tier1'];

/** "Report which tier you hit" buttons, shared by every slice-7 guided flow (Make Camp's Project
 *  Clock action, Keep Watch, Undertake a Journey, Enjoy Downtime's Advance) — the same
 *  self-report-then-apply pattern `MoveRollHelper.tsx` already established for Hold grants, just
 *  reused across several distinct flows rather than one Move, so it's factored out here instead
 *  of copied four times. This app never rolls dice itself; the caller decides what a tier means. */
export function TierChoiceRow({ onChoose, chosen, disabled }: { onChoose: (tier: RollTier) => void; chosen?: RollTier | null; disabled?: boolean }) {
  return (
    <div className={`tap-row ${styles.row}`}>
      {TIERS.map((t) => (
        <button
          key={t}
          type="button"
          className={`tap-inline ${styles.button} ${chosen === t ? styles.buttonChosen : ''}`}
          disabled={disabled}
          onClick={() => onChoose(t)}
        >
          {TIER_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

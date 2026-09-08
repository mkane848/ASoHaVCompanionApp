import { useState } from 'react';
import type { CharacterSheet, Library, Move, RollTier } from '@asohav/shared';
import { computeRollBreakdown, holdGrantForTier } from '@asohav/shared';
import { InfoTooltip, TooltipSection } from '../../components/InfoTooltip.js';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import styles from './MoveRollHelper.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

const HOLD_TIER_LABELS: Record<RollTier, string> = { Tier3: '10+', Tier2: '7–9', Tier1: 'a miss' };
const HOLD_TIERS: RollTier[] = ['Tier3', 'Tier2', 'Tier1'];

/** "What to roll" for a Basic Move: 2d6 + Virtue, broken down by source. This app never rolls
 *  the dice itself (see CLAUDE.md) — the player rolls physical dice against this total. Moves
 *  with no fixed Virtue ("Invoke Expertise", "Take a Risk") let the player pick which one fits
 *  the fictional action first. `commit` mutates the viewer's own sheet — Hold-grant reporting and
 *  Follow a Lead's Wealth-for-Advantage spend both go through it, the same optimistic-commit path
 *  every other sheet mutation uses. */
export function MoveRollHelper({
  move,
  sheet,
  library,
  commit,
}: {
  move: Move;
  sheet: CharacterSheet;
  library: Library;
  commit: (mutator: (draft: CharacterSheet) => void) => void;
}) {
  const [pickedVirtueId, setPickedVirtueId] = useState<string | null>(null);
  const [grantedTier, setGrantedTier] = useState<RollTier | null>(null);
  const [advantageActive, setAdvantageActive] = useState(false);
  const virtueId = move.VirtueId ?? pickedVirtueId;

  if (!virtueId) {
    return (
      <div className={styles.rollHelper}>
        <div className={styles.label}>Roll 2d6 + which Virtue fits?</div>
        <div className={`tap-row ${styles.virtueRow}`}>
          {library.virtues.map((v) => (
            <button key={v.Id} type="button" className={`tap-inline ${styles.virtueButton}`} onClick={() => setPickedVirtueId(v.Id)}>
              {v.Name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const breakdown = computeRollBreakdown(sheet, virtueId, library);
  const holdTiers = HOLD_TIERS.filter((t) => holdGrantForTier(move, t) > 0);

  function grantHold(tier: RollTier) {
    const amount = holdGrantForTier(move, tier);
    if (amount <= 0) return;
    commit((d) => { d.Hold = (d.Hold ?? 0) + amount; });
    setGrantedTier(tier);
  }

  function spendWealthForAdvantage() {
    if ((sheet.Wealth ?? 0) < 1) return;
    commit((d) => { d.Wealth = Math.max(0, (d.Wealth ?? 0) - 1); });
    setAdvantageActive(true);
  }

  return (
    <div className={styles.rollHelper}>
      <div className={styles.label}>
        Roll 2d6 + {breakdown.VirtueName}: <span className={styles.total}>{sign(breakdown.Total)}</span>
        {!move.VirtueId && (
          <button type="button" className={`tap-inline ${styles.change}`} onClick={() => setPickedVirtueId(null)}>
            change
          </button>
        )}
      </div>
      <ul className={styles.sources}>
        {breakdown.Sources.map((s, i) => (
          <li key={i}>
            {s.Label} <span className={styles.sourceValue}>{sign(s.Value)}</span>
          </li>
        ))}
      </ul>
      {breakdown.StatusSources.length > 0 && (
        <div className={styles.statusEffects}>
          <div className={styles.statusEffectsLabel}>Also affecting this roll:</div>
          <ul className={styles.sources}>
            {breakdown.StatusSources.map((s, i) => (
              <li key={i}>
                {s.Label} <span className={styles.sourceValue}>{sign(s.Value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {holdTiers.length > 0 && (
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
      )}

      <div className={styles.advantageRow}>
        <span>Advantage / Disadvantage</span>
        {move.AdvantageTrigger === 'wealthSpend' ? (
          <button type="button" className={`tap-inline ${styles.advantageButton}`} disabled={advantageActive || (sheet.Wealth ?? 0) < 1} onClick={spendWealthForAdvantage}>
            {advantageActive ? 'Advantage active' : 'Spend 1 Wealth for Advantage'}
          </button>
        ) : move.AdvantageTrigger === 'selfReport' ? (
          <CheckboxRow checked={advantageActive} onToggle={() => setAdvantageActive(!advantageActive)}>
            I have access to a written record
          </CheckboxRow>
        ) : (
          <InfoTooltip label="Advantage / Disadvantage">
            <TooltipSection label="What it means">
              Roll 3d6 and keep the best two for Advantage, or the worst two for Disadvantage, instead of the usual 2d6.
            </TooltipSection>
            <TooltipSection label="When it applies">
              This app doesn't track it for you — same as everything else that depends on the fiction rather than a fixed
              number. A strong helpful or hindering Status or Condition already shown above might be exactly the
              circumstance that earns it, or something else from the scene entirely. Ask your GM.
            </TooltipSection>
          </InfoTooltip>
        )}
      </div>
      {(move.AdvantageTrigger === 'wealthSpend' || move.AdvantageTrigger === 'selfReport') && advantageActive && (
        <div className={styles.advantageActiveBanner}>Roll 3d6 and keep the best two.</div>
      )}
      <div className={styles.advantageRow}>
        <span>Aid</span>
        <InfoTooltip label="Aid">
          <TooltipSection label="What it means">
            Any teammate can spend 1 Rapport to give you +1 on this roll — and they can do it
            <em> after</em> the dice land. Several teammates can stack Aid on the same roll, but each
            of them can only spend once on it. During Risk Death it costs double: 2 Rapport per +1.
          </TooltipSection>
          <TooltipSection label="How it works here">
            Spending happens on the Rapport track (Advancement panel, or a teammate's Combat card).
            This app can't see &ldquo;a roll,&rdquo; so it doesn't enforce the once-per-teammate
            limit or add the bonus to the total above — that stays with the table, same as
            Advantage. What it does track is the Rapport itself, and who spent it.
          </TooltipSection>
        </InfoTooltip>
      </div>
    </div>
  );
}

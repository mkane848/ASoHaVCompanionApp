import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { CharacterSheet, ChosenGambit, CombatParticipant, EngageKind, GambitKey, Library, RollTier } from '@asohav/shared';
import { applyToughness, computeRollBreakdown, engageBaseRank, GAMBITS, gambitConditionCost } from '@asohav/shared';
import { InfoTooltip, TooltipSection } from '../../components/InfoTooltip.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { Field } from '../../components/form/Field.js';
import { TextInput } from '../../components/form/TextInput.js';
import { Select } from '../../components/form/Select.js';
import fieldStyles from '../../components/form/field.module.css';
import modal from '../../styles/modal.module.css';
import styles from './CombatMoveModal.module.css';

const TIER_BUTTONS: { tier: RollTier; label: string }[] = [
  { tier: 'Tier3', label: '10+' },
  { tier: 'Tier2', label: '7–9' },
  { tier: 'Tier1', label: 'Miss' },
];

const DEFAULT_EXTRA_STATUS: Partial<Record<GambitKey, string>> = { Halt: 'Halted', Impede: 'Impeded' };

export interface CombatMoveResult {
  targetId: string;
  amount: number;
  /** Which of the Enemy's own named Strain tracks (`EnemyStatusLimit.StatusName`) this amount
   *  marks — meaningless (and ignored) for a PC target, whose Strain is a single, unnamed track
   *  on their own sheet. "The single largest invention in the mapping," per `WorkPlan-V0.6.md`
   *  Section B1: V0.6 never actually says how an Enemy holds Strain across several tracks, so
   *  this app keeps the pre-migration shape (a named box row per `EnemyStatusLimit`) rather than
   *  inventing something new. */
  trackName: string;
  gambits: ChosenGambit[];
}

/** targetId is a simple, independent field — react-hook-form-registered, same as
 *  AddParticipantModal's scoping. tier/rolledTwelve/gambits/trackName stay local useState: tier
 *  is a button group (not a native control) whose selection resets the other two as a side
 *  effect, gambits is a genuinely dynamic array with its own per-row VirtueId/ExtraStatusName
 *  fields, and trackName's default has to be re-derived from whichever target is currently
 *  selected (a plain RHF-registered field can't do that without extra wiring) — pulling any of
 *  this apart across two state systems would be a bigger, riskier rework of already-working
 *  Combat logic than this pass calls for. See WorkPlan-0.23.0.md item E3. */
interface FormValues {
  targetId: string;
}

/** Engage in Melee / Engage at Range both roll 2d6 + Might for a PC actor, dealing a fixed amount
 *  of Strain per tier (V0.6 slice 1 / `WorkPlan-V0.6.md` Section B1: "Apply Status N" -> "Deal N
 *  Strain"), blunted by the target's Toughness if it's an Enemy. An Enemy actor has no sheet to
 *  roll against, so the GM just reports the tier directly — Gambits are PC-only for the same
 *  reason (their cost is a Condition, and only PCs have those). Applying the result to an Enemy
 *  writes straight to its own Strain tracks; applying it to a PC creates a `PendingStrainOffer`
 *  for that player to resolve on their own sheet instead (Resist, or take a Status) — see
 *  `PendingStrainOffer`'s doc comment. */
export function CombatMoveModal({
  kind,
  actor,
  actorSheet,
  library,
  targets,
  onApplyToEnemy,
  onOfferToPC,
  onClose,
}: {
  kind: EngageKind;
  actor: CombatParticipant;
  actorSheet: CharacterSheet | null;
  library: Library;
  targets: CombatParticipant[];
  onApplyToEnemy: (result: CombatMoveResult) => void;
  onOfferToPC: (result: CombatMoveResult) => void;
  onClose: () => void;
}) {
  const { register, watch } = useForm<FormValues>({
    defaultValues: { targetId: targets[0]?.Id ?? '' },
  });
  const targetId = watch('targetId');

  const [tier, setTier] = useState<RollTier | null>(null);
  const [rolledTwelve, setRolledTwelve] = useState(false);
  const [gambits, setGambits] = useState<{ Key: GambitKey; VirtueId: string; ExtraStatusName: string; ResistMettle: string }[]>([]);
  const [targetHasCover, setTargetHasCover] = useState(false);
  const [trackNameChoice, setTrackNameChoice] = useState('');

  const target = targets.find((t) => t.Id === targetId);
  const breakdown = actorSheet ? computeRollBreakdown(actorSheet, 'v-might', library) : null;
  const availableTracks = target?.StatusLimits ?? [];
  // Re-derived from the selected target each render rather than reset via an effect: whichever
  // track name is currently chosen if it's still one of the target's own, else the target's
  // first — auto-corrects when the GM switches targets without extra wiring.
  const trackName = availableTracks.some((l) => l.StatusName === trackNameChoice)
    ? trackNameChoice
    : (availableTracks[0]?.StatusName ?? (trackNameChoice || 'Hurt'));

  const baseAmount = tier ? engageBaseRank(kind, tier) : 0;
  const bolsterBonus = gambits.some((g) => g.Key === 'Bolster') ? 1 : 0;
  const toughened = tier && target?.Kind === 'Enemy' && target.Toughness ? applyToughness(baseAmount, tier, kind, target.Toughness) : baseAmount;
  const finalAmount = toughened > 0 ? toughened + bolsterBonus : toughened;

  const canApply = !!target && !!tier && finalAmount > 0;
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  /** Apply disables for three different reasons that used to look identical from the outside —
   *  named here so the player can tell which one still applies to them, rather than a silently
   *  inert button. */
  function applyBlockedReason(): string | null {
    if (!target) return 'Pick a target first.';
    if (!tier) return 'Report which tier you rolled first.';
    if (finalAmount <= 0) return "This tier doesn't deal Strain — nothing to apply.";
    return null;
  }

  function toggleGambit(key: GambitKey) {
    setGambits((prev) => {
      const exists = prev.some((g) => g.Key === key);
      if (exists) return prev.filter((g) => g.Key !== key);
      const next = { Key: key, VirtueId: library.virtues[0]?.Id ?? '', ExtraStatusName: DEFAULT_EXTRA_STATUS[key] ?? '', ResistMettle: '' };
      // On a 7-9 only one Gambit is allowed at all — picking a new one replaces the old.
      return tier === 'Tier2' ? [next] : [...prev, next];
    });
  }

  function buildChosenGambits(): ChosenGambit[] {
    if (!tier) return [];
    return gambits.map((g, i) => ({
      Key: g.Key,
      ConditionVirtueId: gambitConditionCost(tier, i, rolledTwelve) === 0 ? null : g.VirtueId,
      ExtraStatusName: g.ExtraStatusName || undefined,
      ResistMettle: g.Key === 'Repel' && g.ResistMettle ? Number(g.ResistMettle) : undefined,
    }));
  }

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="combat-move-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="combat-move-title" className={modal.title}>{kind === 'Melee' ? 'Engage in Melee' : 'Engage at Range'}</h2>
          <p className={modal.subtitle}>{actor.Name}, roll 2d6 + Might.</p>
        </div>
        <div className={modal.body}>
          {breakdown && (
            <div className={styles.breakdown}>
              Total: <strong>{breakdown.Total > 0 ? `+${breakdown.Total}` : breakdown.Total}</strong>
              <ul>
                {breakdown.Sources.map((s, i) => (
                  <li key={i}>
                    <span>{s.Label}</span>
                    <span>{s.Value > 0 ? `+${s.Value}` : s.Value}</span>
                  </li>
                ))}
              </ul>
              {breakdown.StatusPenalty && (
                <div className={styles.statusEffects}>
                  <div className={styles.statusEffectsLabel}>Also affecting this roll (if relevant):</div>
                  <div>{breakdown.StatusPenalty.Status.Name} ({breakdown.StatusPenalty.Status.Severity}) — {breakdown.StatusPenalty.Penalty.Label}</div>
                </div>
              )}
              <div className={styles.advantageRow}>
                <span>Advantage / Disadvantage</span>
                <InfoTooltip label="Advantage / Disadvantage">
                  <TooltipSection label="What it means">
                    Roll 3d6 and keep the best two for Advantage, or the worst two for Disadvantage, instead of the usual
                    2d6.
                  </TooltipSection>
                  <TooltipSection label="When it applies">
                    More relevant Boons than Banes gives Advantage; more Banes than Boons gives Disadvantage — the GM's
                    call on which apply here, same as everything else that depends on the fiction rather than a fixed
                    number.
                  </TooltipSection>
                </InfoTooltip>
              </div>
            </div>
          )}

          <Field label="Target" htmlFor="combat-move-target">
            <Select id="combat-move-target" {...register('targetId')}>
              {targets.map((t) => (
                <option key={t.Id} value={t.Id}>
                  {t.Name}
                </option>
              ))}
            </Select>
          </Field>

          {target?.Kind === 'Enemy' && (
            <Field label="Which of their Strain tracks?" htmlFor="combat-move-track">
              {availableTracks.length > 0 ? (
                <Select id="combat-move-track" value={trackName} onChange={(e) => setTrackNameChoice(e.target.value)}>
                  {availableTracks.map((l) => (
                    <option key={l.StatusName} value={l.StatusName}>
                      {l.StatusName} (Limit {l.Limit})
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput id="combat-move-track" value={trackNameChoice} onChange={(e) => setTrackNameChoice(e.target.value)} placeholder="Hurt" />
              )}
            </Field>
          )}

          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={targetHasCover} onChange={(e) => setTargetHasCover(e.target.checked)} />
            Target has Cover (an applicable Boon — V0.6: gives you Disadvantage on this roll, the GM's call)
          </label>

          <label className={fieldStyles.label} id="combat-move-tier-label">Which tier did you roll?</label>
          <div className={styles.tierRow} role="group" aria-labelledby="combat-move-tier-label">
            {TIER_BUTTONS.map((t) => (
              <button
                key={t.tier}
                type="button"
                aria-pressed={tier === t.tier}
                className={`tap-inline ${styles.tierButton} ${tier === t.tier ? styles.tierButtonActive : ''}`}
                onClick={() => { setTier(t.tier); setGambits([]); setRolledTwelve(false); }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tier && (
            <p className={styles.note}>
              {baseAmount} Strain
              {toughened !== baseAmount ? ` → ${toughened} after ${target?.Toughness} Toughness` : ''}
              {bolsterBonus ? ` → ${finalAmount} with Bolster` : ''}.
              {targetHasCover && ' The target has Cover — tell them to roll with Disadvantage if this becomes a Resist.'}
              {target?.Kind === 'PC' && ' Offered to their own sheet — they apply it themselves (and may Resist, or take a Status instead).'}
            </p>
          )}

          {actorSheet && tier && tier !== 'Tier1' && (
            <div className={styles.gambitBox}>
              <div className={fieldStyles.label} id="combat-move-gambits-label">Gambits</div>
              {tier === 'Tier3' && (
                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={rolledTwelve} onChange={(e) => setRolledTwelve(e.target.checked)} />
                  Rolled exactly 12+ (first Gambit is free)
                </label>
              )}
              {tier === 'Tier2' && <p className={styles.note}>One Gambit only, costs 2 Conditions.</p>}
              <div className={styles.gambitList} role="group" aria-labelledby="combat-move-gambits-label">
                {GAMBITS.map((g) => {
                  const chosenIndex = gambits.findIndex((x) => x.Key === g.Key);
                  const chosen = chosenIndex >= 0;
                  const cost = chosen ? gambitConditionCost(tier, chosenIndex, rolledTwelve) : 0;
                  return (
                    <div key={g.Key} className={styles.gambitRow}>
                      <button
                        type="button"
                        aria-pressed={chosen}
                        className={`tap-inline ${styles.gambitChip} ${chosen ? styles.gambitChipActive : ''}`}
                        onClick={() => toggleGambit(g.Key)}
                        title={g.Description}
                      >
                        {g.Name} {chosen ? `(${cost === 0 ? 'free' : `${cost} Condition${cost > 1 ? 's' : ''}`})` : ''}
                      </button>
                      {chosen && cost > 0 && (
                        <Select
                          aria-label={`Mark Condition for ${g.Name}`}
                          value={gambits[chosenIndex].VirtueId}
                          onChange={(e) => setGambits((prev) => prev.map((x, i) => (i === chosenIndex ? { ...x, VirtueId: e.target.value } : x)))}
                        >
                          {library.virtues.map((v) => (
                            <option key={v.Id} value={v.Id}>
                              Mark {v.Name}'s Condition
                            </option>
                          ))}
                        </Select>
                      )}
                      {chosen && (g.Key === 'Halt' || g.Key === 'Impede') && (
                        <TextInput
                          aria-label={`Bane name for ${g.Name}`}
                          value={gambits[chosenIndex].ExtraStatusName}
                          onChange={(e) => setGambits((prev) => prev.map((x, i) => (i === chosenIndex ? { ...x, ExtraStatusName: e.target.value } : x)))}
                          placeholder="Bane name"
                        />
                      )}
                      {chosen && g.Key === 'Repel' && (
                        <TextInput
                          type="number"
                          min={0}
                          aria-label="Target's Mettle, if they Resist the push"
                          value={gambits[chosenIndex].ResistMettle}
                          onChange={(e) => setGambits((prev) => prev.map((x, i) => (i === chosenIndex ? { ...x, ResistMettle: e.target.value } : x)))}
                          placeholder="Target's Mettle if they Resist (optional)"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!canApply && <p className={styles.applyHint}>{applyBlockedReason()}</p>}
          <button
            className={`tap-inline ${modal.primaryAction}`}
            disabled={!canApply}
            onClick={() => {
              if (!target || !tier) return;
              const result: CombatMoveResult = { targetId: target.Id, amount: finalAmount, trackName, gambits: buildChosenGambits() };
              if (target.Kind === 'Enemy') onApplyToEnemy(result);
              else onOfferToPC(result);
            }}
          >
            Apply
          </button>
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { CharacterSheet, CharacterStatus, ChosenGambit, CombatParticipant, EngageKind, GambitKey, Library, RollTier } from '@asohav/shared';
import { applyToughness, computeRollBreakdown, engageBaseRank, GAMBITS, gambitConditionCost, statusRank } from '@asohav/shared';
import { InfoTooltip, TooltipSection } from '../../components/InfoTooltip.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { Field } from '../../components/form/Field.js';
import { TextInput } from '../../components/form/TextInput.js';
import { Select } from '../../components/form/Select.js';
import fieldStyles from '../../components/form/field.module.css';
import modal from '../../styles/modal.module.css';
import styles from './CombatMoveModal.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

const TIER_BUTTONS: { tier: RollTier; label: string }[] = [
  { tier: 'Tier3', label: '10+' },
  { tier: 'Tier2', label: '7–9' },
  { tier: 'Tier1', label: 'Miss' },
];

const DEFAULT_EXTRA_STATUS: Partial<Record<GambitKey, string>> = { Halt: 'Halted', Impede: 'Impeded' };

export interface CombatMoveResult {
  targetId: string;
  rank: number;
  statusName: string;
  gambits: ChosenGambit[];
}

/** targetId/statusName are simple, independent fields — react-hook-form-registered, same as
 *  AddParticipantModal's scoping. tier/rolledTwelve/gambits stay local useState: tier is a
 *  button group (not a native control) whose selection resets the other two as a side effect,
 *  and gambits is a genuinely dynamic array with its own per-row VirtueId/ExtraStatusName
 *  fields — pulling that trio apart across two state systems would be a bigger, riskier rework
 *  of already-working Combat logic than this pass calls for. See WorkPlan-0.23.0.md item E3. */
interface FormValues {
  targetId: string;
  statusName: string;
}

/** Engage in Melee / Engage at Range both roll 2d6 + Might for a PC actor, giving a fixed Status
 *  Rank per tier (blunted by the target's Toughness if it's an Enemy). An Enemy actor has no
 *  sheet to roll against, so the GM just reports the tier directly — Gambits are PC-only for the
 *  same reason (their cost is a Condition, and only PCs have those). Applying the result to an
 *  Enemy writes straight to its Statuses; applying it to a PC creates a PendingStatusOffer for
 *  that player to accept on their own sheet instead (see PendingStatusOffer's doc comment). */
export function CombatMoveModal({
  kind,
  actor,
  actorSheet,
  library,
  targets,
  targetStatuses,
  onApplyToEnemy,
  onOfferToPC,
  onClose,
}: {
  kind: EngageKind;
  actor: CombatParticipant;
  actorSheet: CharacterSheet | null;
  library: Library;
  targets: CombatParticipant[];
  targetStatuses: Record<string, CharacterStatus[]>;
  onApplyToEnemy: (result: CombatMoveResult) => void;
  onOfferToPC: (result: CombatMoveResult) => void;
  onClose: () => void;
}) {
  const { register, watch } = useForm<FormValues>({
    defaultValues: { targetId: targets[0]?.Id ?? '', statusName: kind === 'Melee' ? 'Wounded' : 'Struck' },
  });
  const targetId = watch('targetId');
  const statusName = watch('statusName');

  const [tier, setTier] = useState<RollTier | null>(null);
  const [rolledTwelve, setRolledTwelve] = useState(false);
  const [gambits, setGambits] = useState<{ Key: GambitKey; VirtueId: string; ExtraStatusName: string; ResistMettle: string }[]>([]);
  const [coverStatusId, setCoverStatusId] = useState('');

  const target = targets.find((t) => t.Id === targetId);
  const breakdown = actorSheet ? computeRollBreakdown(actorSheet, 'v-might', library) : null;

  // Cover (V0.5, illustrative not exhaustive): any of the target's own Positive Statuses can
  // blunt an incoming hit — shown by name/Rank rather than matched against a fixed list like
  // "Cover"/"Hidden"/"Invisible", since the doc's own examples aren't meant to be the only ones
  // that count (see README.md's judgment-call entry for this pass).
  const coverStatuses = (targetStatuses[targetId] ?? []).filter((s) => s.Polarity === 'Positive');
  const selectedCover = coverStatuses.find((s) => s.Id === coverStatusId);
  const coverReduction = selectedCover ? statusRank(selectedCover) : 0;

  const baseRank = tier ? engageBaseRank(kind, tier) : 0;
  const bolsterBonus = gambits.some((g) => g.Key === 'Bolster') ? 1 : 0;
  const toughened = tier && target?.Kind === 'Enemy' && target.Toughness ? applyToughness(baseRank, tier, kind, target.Toughness) : baseRank;
  const finalRank = toughened > 0 ? toughened + bolsterBonus : toughened;
  const rankAfterCover = Math.max(0, finalRank - coverReduction);

  const canApply = !!target && !!tier && rankAfterCover > 0 && statusName.trim().length > 0;
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  /** Apply disables for four different reasons that used to look identical from the outside —
   *  named here so the player can tell which one still applies to them, rather than a silently
   *  inert button. */
  function applyBlockedReason(): string | null {
    if (!target) return 'Pick a target first.';
    if (!tier) return 'Report which tier you rolled first.';
    if (statusName.trim().length === 0) return 'Give the Status a name.';
    if (rankAfterCover <= 0) return coverReduction > 0 ? 'Cover absorbs the whole hit — nothing to apply.' : "This tier doesn't give a Status — nothing to apply.";
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
              Total: <strong>{sign(breakdown.Total)}</strong>
              <ul>
                {breakdown.Sources.map((s, i) => (
                  <li key={i}>
                    <span>{s.Label}</span>
                    <span>{sign(s.Value)}</span>
                  </li>
                ))}
              </ul>
              {breakdown.StatusSources.length > 0 && (
                <div className={styles.statusEffects}>
                  <div className={styles.statusEffectsLabel}>Also affecting this roll:</div>
                  <ul>
                    {breakdown.StatusSources.map((s, i) => (
                      <li key={i}>
                        <span>{s.Label}</span>
                        <span>{sign(s.Value)}</span>
                      </li>
                    ))}
                  </ul>
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
                    This app doesn't track it for you — same as everything else that depends on the fiction rather than
                    a fixed number. A strong helpful or hindering Status already shown above might be exactly the
                    circumstance that earns it, or something else from the fight entirely. The GM's call.
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

          {coverStatuses.length > 0 && (
            <Field label="Target's Cover" htmlFor="combat-move-cover">
              <Select id="combat-move-cover" value={coverStatusId} onChange={(e) => setCoverStatusId(e.target.value)}>
                <option value="">None</option>
                {coverStatuses.map((s) => (
                  <option key={s.Id} value={s.Id}>
                    {s.Name} {statusRank(s)}
                  </option>
                ))}
              </Select>
            </Field>
          )}

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

          <Field label="Status to give" htmlFor="combat-move-status-name">
            <TextInput id="combat-move-status-name" placeholder="Wounded, Hobbled, Scared…" {...register('statusName')} />
          </Field>

          {tier && (
            <p className={styles.note}>
              Rank {baseRank}
              {toughened !== baseRank ? ` → ${toughened} after ${target?.Toughness} Toughness` : ''}
              {bolsterBonus ? ` → ${finalRank} with Bolster` : ''}
              {coverReduction ? ` → ${rankAfterCover} after ${selectedCover?.Name} ${coverReduction} Cover` : ''}.
              {target?.Kind === 'PC' && ' Offered to their own sheet — they apply it themselves (and may Resist first).'}
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
                          aria-label={`Status name for ${g.Name}`}
                          value={gambits[chosenIndex].ExtraStatusName}
                          onChange={(e) => setGambits((prev) => prev.map((x, i) => (i === chosenIndex ? { ...x, ExtraStatusName: e.target.value } : x)))}
                          placeholder="Status name"
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
              const result: CombatMoveResult = { targetId: target.Id, rank: rankAfterCover, statusName: statusName.trim(), gambits: buildChosenGambits() };
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

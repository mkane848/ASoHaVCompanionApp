import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { CharacterSheet, ChosenGambit, CombatParticipant, EngageKind, GambitKey, Library, RollTier } from '@asohav/shared';
import { applyToughness, engageStrain, GAMBITS, gambitConditionCost } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { useMisfortune } from '../../lib/useMisfortune.js';
import { HeroRollBuilder } from '../roll/HeroRollBuilder.js';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import { Field } from '../../components/form/Field.js';
import { TextInput } from '../../components/form/TextInput.js';
import { Select } from '../../components/form/Select.js';
import fieldStyles from '../../components/form/field.module.css';
import modal from '../../styles/modal.module.css';
import styles from './CombatMoveModal.module.css';

const TIER_BUTTONS: { tier: RollTier; label: string }[] = [
  { tier: 'Tier3', label: '10+' },
  { tier: 'Tier2', label: '7–9' },
  { tier: 'Tier1', label: '6-' },
];

const DEFAULT_EXTRA_STATUS: Partial<Record<GambitKey, string>> = { Impede: '' };

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
 *  Strain"), blunted by the target's Toughness if it's an Enemy. A PC actor uses HeroRollBuilder
 *  to build the roll; an Enemy actor types a Strain amount directly. Gambits are PC-only (their
 *  cost is a Condition, and only PCs have those). Applying the result to an Enemy writes straight
 *  to its own Strain tracks; applying it to a PC creates a `PendingStrainOffer` for that player to
 *  resolve on their own sheet instead (Resist, or take a Status) — see `PendingStrainOffer`'s doc
 *  comment. */
export function CombatMoveModal({
  kind,
  actor,
  actorSheet,
  library,
  targets,
  commitSheet,
  onApplyToEnemy,
  onOfferToPC,
  onClose,
}: {
  kind: EngageKind;
  actor: CombatParticipant;
  actorSheet: CharacterSheet | null;
  library: Library;
  targets: CombatParticipant[];
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  onApplyToEnemy: (result: CombatMoveResult) => void;
  onOfferToPC: (result: CombatMoveResult) => void;
  onClose: () => void;
}) {
  const misfortune = useMisfortune();
  const { register, watch } = useForm<FormValues>({
    defaultValues: { targetId: targets[0]?.Id ?? '' },
  });
  const targetId = watch('targetId');

  const [tier, setTier] = useState<RollTier | null>(null);
  const [rolledTwelve, setRolledTwelve] = useState(false);
  const [gambits, setGambits] = useState<{ Key: GambitKey; VirtueId: string; ExtraStatusName: string; ResistMettle: string }[]>([]);
  const [targetHasCover, setTargetHasCover] = useState(false);
  const [trackNameChoice, setTrackNameChoice] = useState('');
  const [enemyStrainAmount, setEnemyStrainAmount] = useState('3');

  const target = targets.find((t) => t.Id === targetId);
  const availableTracks = target?.StatusLimits ?? [];
  // Re-derived from the selected target each render rather than reset via an effect: whichever
  // track name is currently chosen if it's still one of the target's own, else the target's
  // first — auto-corrects when the GM switches targets without extra wiring.
  const trackName = availableTracks.some((l) => l.StatusName === trackNameChoice)
    ? trackNameChoice
    : (availableTracks[0]?.StatusName ?? (trackNameChoice || 'Hurt'));

  // PC actor: amount from tier via engageStrain, possibly reduced by Toughness (unless Pierce),
  // then enhanced by Bolster. Enemy actor: amount directly from the typed number.
  const isPCActing = !!actorSheet;
  const baseAmount = tier ? engageStrain(kind, tier) : 0;
  const hasPierce = gambits.some((g) => g.Key === 'Pierce');
  const bolsterBonus = gambits.some((g) => g.Key === 'Bolster') ? 1 : 0;
  const toughened = tier && !hasPierce && target?.Kind === 'Enemy' && target.Toughness
    ? applyToughness(baseAmount, tier, kind, target.Toughness)
    : baseAmount;
  const pcAmount = toughened > 0 ? toughened + bolsterBonus : toughened;

  const parsedEnemyStrain = parseInt(enemyStrainAmount, 10);
  const enemyAmount = Number.isFinite(parsedEnemyStrain) ? Math.max(0, parsedEnemyStrain) : 0;

  const finalAmount = isPCActing ? pcAmount : enemyAmount;
  const canApply = !!target && (isPCActing ? (!!tier && finalAmount > 0) : (finalAmount > 0));
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  /** Apply disables for two different reasons that used to look identical from the outside —
   *  named here so the player can tell which one still applies to them, rather than a silently
   *  inert button. */
  function applyBlockedReason(): string | null {
    if (!target) return 'Pick a target first.';
    if (isPCActing && !tier) return 'Report which tier you rolled first.';
    if (finalAmount <= 0) return 'No Strain to apply.';
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
          <p className={modal.subtitle}>{isPCActing ? `${actor.Name}, roll 2d6 + Might.` : `${actor.Name} attacks.`}</p>
        </div>
        <div className={modal.body}>
          {isPCActing && (
            <HeroRollBuilder
              mode="Engage"
              virtueId="v-might"
              sheet={actorSheet}
              library={library}
              commit={commitSheet}
              inCombat
              priorStrainMoves={actor.StrainMovesSinceRefresh ?? 0}
              extraBanes={targetHasCover ? 1 : 0}
            />
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

          {isPCActing && (
            <CheckboxRow checked={targetHasCover} onToggle={() => setTargetHasCover((v) => !v)}>
              Target has Cover (a Bane on your roll)
            </CheckboxRow>
          )}

          {!isPCActing && (
            <Field label="Strain" htmlFor="combat-move-strain">
              <TextInput
                id="combat-move-strain"
                type="number"
                min={0}
                max={6}
                value={enemyStrainAmount}
                onChange={(e) => setEnemyStrainAmount(e.target.value)}
              />
              <p className={styles.note}>1 nuisance · 2 light · 3 standard · 4 heavy · 5 dire · 6 exceptional. Enemies don&rsquo;t roll — the Hero Resists it.</p>
            </Field>
          )}

          {isPCActing && (
            <>
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
                  {baseAmount} Strain{hasPierce ? ' (Pierce ignores Toughness)' : toughened !== baseAmount ? ` → ${toughened} after ${target?.Toughness} Toughness` : ''}{bolsterBonus ? ` → ${finalAmount} with Bolster` : ''}.{tier === 'Tier1' ? ' The GM gains 1 Misfortune.' : ''}
                  {target?.Kind === 'PC' && ' Offered to their own sheet — they apply it themselves (and may Resist, or take a Status instead).'}
                </p>
              )}
            </>
          )}

          {isPCActing && tier && tier !== 'Tier1' && (
            <div className={styles.gambitBox}>
              <div className={fieldStyles.label} id="combat-move-gambits-label">Gambits</div>
              {tier === 'Tier3' && (
                <CheckboxRow checked={rolledTwelve} onToggle={() => setRolledTwelve((v) => !v)}>
                  Rolled exactly 12+ (first Gambit is free)
                </CheckboxRow>
              )}
              {tier === 'Tier2' && <p className={styles.note}>One Gambit only, costs 2 Conditions.</p>}
              <div className={styles.gambitList} role="group" aria-labelledby="combat-move-gambits-label">
                {GAMBITS.map((g) => {
                  const chosenIndex = gambits.findIndex((x) => x.Key === g.Key);
                  const chosen = chosenIndex >= 0;
                  const cost = chosen ? gambitConditionCost(tier, chosenIndex, rolledTwelve) : 0;
                  return (
                    <div key={g.Key} className={styles.gambitRow}>
                      <div>
                        <button
                          type="button"
                          aria-pressed={chosen}
                          className={`tap-inline ${styles.gambitChip} ${chosen ? styles.gambitChipActive : ''}`}
                          onClick={() => toggleGambit(g.Key)}
                        >
                          {g.Name} {chosen ? `(${cost === 0 ? 'free' : `${cost} Condition${cost > 1 ? 's' : ''}`})` : ''}
                        </button>
                        {chosen && <div className={styles.gambitDescription}>{g.Description}</div>}
                      </div>
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
                      {chosen && g.Key === 'Impede' && (
                        <TextInput
                          aria-label={`Bane name for ${g.Name}`}
                          value={gambits[chosenIndex].ExtraStatusName}
                          onChange={(e) => setGambits((prev) => prev.map((x, i) => (i === chosenIndex ? { ...x, ExtraStatusName: e.target.value } : x)))}
                          placeholder="Grappled, Distracted, Provoked…"
                        />
                      )}
                      {chosen && g.Key === 'Repel' && (
                        <TextInput
                          type="number"
                          min={0}
                          aria-label="Target's Mettle, if it Braces"
                          value={gambits[chosenIndex].ResistMettle}
                          onChange={(e) => setGambits((prev) => prev.map((x, i) => (i === chosenIndex ? { ...x, ResistMettle: e.target.value } : x)))}
                          placeholder="Target's Mettle, if it Braces (optional)"
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
              if (!target) return;
              if (isPCActing && !tier) return;
              const result: CombatMoveResult = { targetId: target.Id, amount: finalAmount, trackName, gambits: buildChosenGambits() };
              if (isPCActing && tier === 'Tier1') {
                const title = kind === 'Melee' ? 'Engage in Melee' : 'Engage at Range';
                misfortune.gain(`A 6- on ${title}`);
              }
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

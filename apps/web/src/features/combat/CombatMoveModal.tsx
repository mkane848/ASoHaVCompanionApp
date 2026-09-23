import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { CharacterSheet, ChosenGambit, CombatParticipant, EngageKind, GambitKey, Library, RollTier } from '@asohav/shared';
import { engageStrain, GAMBITS, gambitConditionCost, guardedStrain, enemyVirtueRollHints } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { useMisfortune } from '../../lib/useMisfortune.js';
import { HeroRollBuilder, type HeroRollBuilderHandle } from '../roll/HeroRollBuilder.js';
import { EnemyVirtueSection } from '../roll/EnemyVirtueSection.js';
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
  gambits: ChosenGambit[];
}

/** targetId is a simple, independent field — react-hook-form-registered, same as
 *  AddParticipantModal's scoping. tier/rolledTwelve/gambits/virtueChoice stay local useState: tier
 *  is a button group (not a native control) whose selection resets the Gambits, gambits is a
 *  genuinely dynamic array with its own per-row fields, and virtueChoice belongs to whichever
 *  target is currently selected — pulling any of this apart across two state systems would be a
 *  bigger, riskier rework of already-working Combat logic than this pass calls for. See
 *  WorkPlan-0.23.0.md item E3. */
interface FormValues {
  targetId: string;
}

/** A Hero's Engage in Melee / Engage at Range: 2d6 + Might through `HeroRollBuilder`, dealing a
 *  fixed amount of Strain per tier (`engageStrain`), plus Bolster's 1, less the target's Guard to a
 *  minimum of 1 — unless Pierce ignores it (`guardedStrain`). An enemy Virtue this roll opposes or
 *  exploits adds its Banes or Boons (`EnemyVirtueSection`). The target is always an enemy: enemies
 *  attack through `EnemyAttackModal` since slice 7, and the caller decides whether the hit waits for
 *  the GM's Status-slot call or lands now. */
export function CombatMoveModal({
  kind,
  actor,
  actorSheet,
  library,
  targets,
  commitSheet,
  onApplyToEnemy,
  onClose,
}: {
  kind: EngageKind;
  actor: CombatParticipant;
  actorSheet: CharacterSheet;
  library: Library;
  targets: CombatParticipant[];
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  onApplyToEnemy: (result: CombatMoveResult) => void;
  onClose: () => void;
}) {
  const misfortune = useMisfortune();
  const builderRef = useRef<HeroRollBuilderHandle>(null);
  const { register, watch } = useForm<FormValues>({
    defaultValues: { targetId: targets[0]?.Id ?? '' },
  });
  const targetId = watch('targetId');

  const [tier, setTier] = useState<RollTier | null>(null);
  const [rolledTwelve, setRolledTwelve] = useState(false);
  const [gambits, setGambits] = useState<{ Key: GambitKey; VirtueId: string; ExtraStatusName: string; ResistMettle: string }[]>([]);
  const [targetHasCover, setTargetHasCover] = useState(false);
  const [virtueChoice, setVirtueChoice] = useState<{ targetId: string; ids: string[] }>({ targetId: '', ids: [] });

  const target = targets.find((t) => t.Id === targetId);
  const selectedVirtues = new Set(virtueChoice.targetId === targetId ? virtueChoice.ids : []);

  // The Move's Strain (Bolster included), then the target's Guard unless Pierce ignores it.
  const baseAmount = tier ? engageStrain(kind, tier) : 0;
  const hasPierce = gambits.some((g) => g.Key === 'Pierce');
  const bolsterBonus = gambits.some((g) => g.Key === 'Bolster') ? 1 : 0;
  const guard = target?.Stats?.Guard ?? 0;
  const finalAmount = tier ? guardedStrain(baseAmount + bolsterBonus, guard, hasPierce) : 0;

  const chosenHints = (target ? enemyVirtueRollHints(target) : []).filter((h) => selectedVirtues.has(h.VirtueId));
  const enemyBanes = chosenHints.reduce((sum, h) => sum + h.Banes, 0);
  const enemyBoons = chosenHints.reduce((sum, h) => sum + h.Boons, 0);

  const canApply = !!target && !!tier && finalAmount > 0;
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  /** Apply disables for three different reasons that used to look identical from the outside —
   *  named here so the player can tell which one still applies to them, rather than a silently
   *  inert button. */
  function applyBlockedReason(): string | null {
    if (!target) return 'Pick a target first.';
    if (!tier) return 'Report which tier you rolled first.';
    if (finalAmount <= 0) return 'No Strain to apply.';
    return null;
  }

  function toggleVirtue(virtueId: string) {
    setVirtueChoice((prev) => {
      const current = prev.targetId === targetId ? prev.ids : [];
      const next = new Set(current);
      if (next.has(virtueId)) next.delete(virtueId); else next.add(virtueId);
      return { targetId, ids: [...next] };
    });
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
          <Field label="Target" htmlFor="combat-move-target">
            <Select id="combat-move-target" {...register('targetId')}>
              {targets.map((t) => (
                <option key={t.Id} value={t.Id}>
                  {t.Name}
                </option>
              ))}
            </Select>
          </Field>

          <CheckboxRow checked={targetHasCover} onToggle={() => setTargetHasCover((v) => !v)}>
            Target has Cover (a Bane on your roll)
          </CheckboxRow>

          {target && <EnemyVirtueSection enemy={target} library={library} selected={selectedVirtues} onToggle={toggleVirtue} />}

          <HeroRollBuilder
            ref={builderRef}
            mode="Engage"
            virtueId="v-might"
            sheet={actorSheet}
            library={library}
            commit={commitSheet}
            inCombat
            priorStrainMoves={actor.StrainMovesSinceRefresh ?? 0}
            extraBanes={(targetHasCover ? 1 : 0) + enemyBanes}
            extraBoons={enemyBoons}
          />

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
              {bolsterBonus ? ` → ${baseAmount + bolsterBonus} with Bolster` : ''}
              {guard > 0 ? (hasPierce ? ` (Pierce ignores Guard ${guard})` : ` → ${finalAmount} after Guard ${guard}`) : ''}.
              {tier === 'Tier1' ? ' The GM gains 1 Misfortune.' : ''}
            </p>
          )}

          {tier && tier !== 'Tier1' && (
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
              if (!target || !tier) return;
              const result: CombatMoveResult = { targetId: target.Id, amount: finalAmount, gambits: buildChosenGambits() };
              if (tier === 'Tier1') {
                const title = kind === 'Melee' ? 'Engage in Melee' : 'Engage at Range';
                misfortune.gain(`A 6- on ${title}`);
              }
              builderRef.current?.tierReported();
              onApplyToEnemy(result);
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

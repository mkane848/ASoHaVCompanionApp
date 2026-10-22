import { useState } from 'react';
import type { CombatParticipant, EnemyAttack, Library, StrainTag } from '@asohav/shared';
import { groupMinionAttack } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { useDrama } from '../../lib/useDrama.js';
import { Field } from '../../components/form/Field.js';
import { Select } from '../../components/form/Select.js';
import { TextInput } from '../../components/form/TextInput.js';
import { StrainTagFields, cleanStrainTag } from '../../components/StrainTagFields.js';
import modal from '../../styles/modal.module.css';
import styles from './CombatMoveModal.module.css';

const EFFECT_TRIGGER_LABELS: Record<string, string> = {
  OnStrain: 'if they mark any Strain',
  Regardless: 'regardless of Resistance',
  OnMissedResist: 'on a 6- Resistance Roll',
  InsteadOfStrain: 'instead of Strain',
};

export interface EnemyAttackOffer {
  targetId: string;
  amount: number;
  attack: EnemyAttack;
  /** How the GM tagged the hit for the Armor rules (V0.7 slice 7); absent when left untagged. */
  tag?: StrainTag;
}

/** The GM builds an enemy's attack (revised V0.6, slice 7): pick one from its stat block, or type
 *  another's Strain, and a target. Everything the rule says to tell the player "before they decide
 *  how to defend" is shown; a Minion group combines into one attack capped at 5, and an attack's
 *  Drama cost is spent on confirming. The attack becomes an offer the Hero resolves.
 *
 *  V0.7 slice 7: the GM may also tag the hit (on the body, and an effect) so the Hero's Armor
 *  choices follow the rules: Heavy Armor needs a hit on the body, Special Armor a listed effect. */
export function EnemyAttackModal({
  attacker,
  targets,
  library,
  dramaAvailable,
  onOffer,
  onClose,
}: {
  attacker: CombatParticipant;
  targets: CombatParticipant[];
  library: Library;
  /** The party's current Drama, so an attack the GM can't pay for can't be offered. */
  dramaAvailable: number;
  onOffer: (offer: EnemyAttackOffer) => void;
  onClose: () => void;
}) {
  const drama = useDrama();
  const [attackKind, setAttackKind] = useState<'preset' | 'custom'>(attacker.Stats?.Attacks && attacker.Stats.Attacks.length > 0 ? 'preset' : 'custom');
  const [presetAttackName, setPresetAttackName] = useState(attacker.Stats?.Attacks?.[0]?.Name ?? '');
  const [targetId, setTargetId] = useState(targets[0]?.Id ?? '');
  const [customName, setCustomName] = useState('Attack');
  const [customStrain, setCustomStrain] = useState('3');
  const [tag, setTag] = useState<StrainTag | undefined>(undefined);

  const presetAttack =
    attackKind === 'preset' && attacker.Stats
      ? attacker.Stats.Attacks.find((a) => a.Name === presetAttackName)
      : null;
  const currentAttack =
    attackKind === 'preset'
      ? presetAttack
      : {
          Name: customName.trim() || 'Attack',
          Target: '',
          Range: 1,
          Strain: parseInt(customStrain, 10) || 0,
          ResistVirtueIds: [],
          ConditionVirtueId: null,
          AdditionalEffect: '',
          EffectTrigger: 'OnStrain' as const,
          DramaCost: 0,
          Notes: '',
        };

  const target = targets.find((t) => t.Id === targetId);
  const isMinionGroup = attacker.Stats?.Profile === 'Minion' && (attacker.MinionCount ?? 1) > 1;
  const strainAmount =
    !currentAttack || currentAttack.EffectTrigger === 'InsteadOfStrain'
      ? 0
      : isMinionGroup
        ? groupMinionAttack(currentAttack.Strain, attacker.MinionCount ?? 1)
        : currentAttack.Strain;

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  const cost = currentAttack?.DramaCost ?? 0;
  const canAfford = cost <= dramaAvailable;
  const canApply = !!target && !!currentAttack && canAfford;

  function buildConditionName(virtueId: string | null): string | undefined {
    if (!virtueId) return undefined;
    const condition = library.conditions.find((c) => c.VirtueId === virtueId);
    return condition?.Name;
  }

  function getEffectTriggerLabel(trigger?: string): string {
    return EFFECT_TRIGGER_LABELS[trigger ?? 'OnStrain'] ?? trigger ?? '';
  }

  async function apply() {
    if (!target || !currentAttack) return;

    // Spend Drama before offering
    if (currentAttack.DramaCost > 0) {
      for (let i = 0; i < currentAttack.DramaCost; i++) {
        await drama.spend(`${currentAttack.Name} (${attacker.Name})`);
      }
    }

    onOffer({
      targetId: target.Id,
      amount: strainAmount,
      attack: currentAttack,
      tag: cleanStrainTag(tag),
    });
  }

  const resistVirtueNames = currentAttack?.ResistVirtueIds
    ?.map((vid) => library.virtues.find((v) => v.Id === vid)?.Name)
    .filter(Boolean)
    .join(' or ') || 'none listed';

  const conditionName = currentAttack ? buildConditionName(currentAttack.ConditionVirtueId) : undefined;

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="enemy-attack-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="enemy-attack-title" className={modal.title}>
            {attacker.Name} attacks
          </h2>
        </div>
        <div className={modal.body}>
          {/* Attack picker */}
          {attacker.Stats?.Attacks && attacker.Stats.Attacks.length > 0 && (
            <Field label="Attack" htmlFor="enemy-attack-kind">
              <Select id="enemy-attack-kind" value={attackKind} onChange={(e) => setAttackKind(e.target.value as 'preset' | 'custom')}>
                <option value="preset">Choose from attacks</option>
                <option value="custom">Another attack (type the Strain)</option>
              </Select>
            </Field>
          )}

          {attackKind === 'preset' && attacker.Stats?.Attacks && attacker.Stats.Attacks.length > 0 && (
            <Field label="Which attack?" htmlFor="enemy-attack-preset">
              <Select id="enemy-attack-preset" value={presetAttackName} onChange={(e) => setPresetAttackName(e.target.value)}>
                {attacker.Stats.Attacks.map((a) => (
                  <option key={a.Name} value={a.Name}>
                    {a.Name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {attackKind === 'custom' && (
            <>
              <Field label="Attack name" htmlFor="enemy-attack-custom-name">
                <TextInput
                  id="enemy-attack-custom-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Attack"
                />
              </Field>
              <Field label="Strain" htmlFor="enemy-attack-custom-strain">
                <TextInput
                  id="enemy-attack-custom-strain"
                  type="number"
                  min={0}
                  max={6}
                  value={customStrain}
                  onChange={(e) => setCustomStrain(e.target.value)}
                />
              </Field>
            </>
          )}

          {/* Target picker */}
          <Field label="Target" htmlFor="enemy-attack-target">
            <Select id="enemy-attack-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {targets.map((t) => (
                <option key={t.Id} value={t.Id}>
                  {t.Name}
                </option>
              ))}
            </Select>
          </Field>

          <StrainTagFields value={tag} onChange={setTag} idPrefix="enemy-attack-tag" />

          {/* Attack details */}
          {currentAttack && (
            <div className={styles.note}>
              <p>
                <strong>Strain:</strong> {strainAmount}
                {isMinionGroup && <> ({attacker.MinionCount} Minions combine into one attack, at most 5)</>}
              </p>
              {currentAttack.ResistVirtueIds.length > 0 && (
                <p>
                  <strong>Resist with:</strong> {resistVirtueNames}
                </p>
              )}
              {conditionName && <p><strong>Condition:</strong> {conditionName}</p>}
              {currentAttack.AdditionalEffect && (
                <p>
                  <strong>Additional Effect:</strong> {currentAttack.AdditionalEffect} ({getEffectTriggerLabel(currentAttack.EffectTrigger)})
                </p>
              )}
              {currentAttack.Notes && <p><strong>Notes:</strong> {currentAttack.Notes}</p>}
              {currentAttack.DramaCost > 0 && (
                <p>
                  <strong>Costs {currentAttack.DramaCost} Drama</strong> (you have {dramaAvailable})
                  {!canAfford && ' — not enough to use this attack.'}
                </p>
              )}
              {strainAmount === 0 && currentAttack.EffectTrigger === 'InsteadOfStrain' && (
                <p><em>No Strain — the effect happens instead.</em></p>
              )}
            </div>
          )}

          <button
            className={`tap-inline ${modal.primaryAction}`}
            disabled={!canApply}
            onClick={apply}
          >
            Attack
          </button>
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

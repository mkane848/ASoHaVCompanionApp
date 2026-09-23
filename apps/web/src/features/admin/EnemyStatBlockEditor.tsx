import { useState } from 'react';
import type { EnemyAttack, EnemyProfile, EnemySize, EnemyStatBlock, EffectTrigger } from '@asohav/shared';
import { ENEMY_PROFILE_DEFAULTS, defaultStatBlock } from '@asohav/shared';
import { useLibrary } from '../../lib/useLibrary.js';
import shared from './adminShared.module.css';
import styles from './EnemyStatBlockEditor.module.css';

interface EnemyStatBlockEditorProps {
  fieldId: string;
  value: EnemyStatBlock | null | undefined;
  onChange: (v: EnemyStatBlock | null) => void;
}

const PROFILES: EnemyProfile[] = ['Minion', 'Standard', 'Elite', 'Legendary'];
const SIZES = ['1/2', '1x1', '2x2', '3x3', '4x4'] as const;
const EFFECT_TRIGGERS: EffectTrigger[] = ['OnStrain', 'Regardless', 'OnMissedResist', 'InsteadOfStrain'];

function triggerLabel(trigger: EffectTrigger): string {
  switch (trigger) {
    case 'OnStrain': return 'Only if Strain is marked';
    case 'Regardless': return 'Regardless of Resistance';
    case 'OnMissedResist': return 'On a 6− Resistance Roll';
    case 'InsteadOfStrain': return 'Instead of Strain';
  }
}

function EnemyAttackRow({
  idPrefix,
  attack,
  onChange,
  onRemove,
  virtueOptions,
  conditionsByVirtueId,
}: {
  idPrefix: string;
  attack: EnemyAttack;
  onChange: (a: EnemyAttack) => void;
  onRemove: () => void;
  virtueOptions: { value: string; label: string }[];
  conditionsByVirtueId: Map<string, { Id: string; Name: string }[]>;
}) {
  const num = (field: 'Range' | 'Strain' | 'MisfortuneCost', label: string) => (
    <div className={styles.field}>
      <label htmlFor={`${idPrefix}-${field}`} className={shared.hint}>
        {label}
      </label>
      <input
        id={`${idPrefix}-${field}`}
        className={styles.number}
        type="number"
        value={attack[field]}
        min="0"
        onChange={(e) => onChange({ ...attack, [field]: parseInt(e.target.value, 10) || 0 })}
      />
    </div>
  );
  const text = (field: 'Name' | 'Target' | 'AdditionalEffect' | 'Notes', label: string) => (
    <div className={styles.field}>
      <label htmlFor={`${idPrefix}-${field}`} className={shared.hint}>
        {label}
      </label>
      <input
        id={`${idPrefix}-${field}`}
        className={styles.input}
        value={attack[field]}
        onChange={(e) => onChange({ ...attack, [field]: e.target.value })}
      />
    </div>
  );

  return (
    <div className={styles.attackRow}>
      <div className={styles.row}>
        {text('Name', 'Attack name')}
        {text('Target', 'Target')}
        {num('Range', 'Range')}
        {num('Strain', 'Strain')}
        {num('MisfortuneCost', 'Misfortune cost')}
      </div>

      <div className={styles.field}>
        <span className={shared.hint}>Resisted with</span>
        <div className={styles.virtueButtons}>
          {virtueOptions.map((v) => {
            const on = attack.ResistVirtueIds.includes(v.value);
            return (
              <button
                key={v.value}
                type="button"
                aria-pressed={on}
                className={`${styles.virtueButton} ${on ? styles.virtueButtonOn : ''}`}
                onClick={() =>
                  onChange({
                    ...attack,
                    ResistVirtueIds: on ? attack.ResistVirtueIds.filter((x) => x !== v.value) : [...attack.ResistVirtueIds, v.value],
                  })
                }
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-condition`} className={shared.hint}>
            Condition
          </label>
          <select
            id={`${idPrefix}-condition`}
            className={styles.enumSelect}
            value={attack.ConditionVirtueId ?? ''}
            onChange={(e) => onChange({ ...attack, ConditionVirtueId: e.target.value || null })}
          >
            <option value="">None</option>
            {Array.from(conditionsByVirtueId.entries()).map(([virtueId, conditions]) =>
              conditions.map((cond) => (
                <option key={cond.Id} value={virtueId}>
                  {cond.Name}
                </option>
              ))
            )}
          </select>
        </div>
        {text('AdditionalEffect', 'Additional Effect')}
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-trigger`} className={shared.hint}>
            Effect applies
          </label>
          <select
            id={`${idPrefix}-trigger`}
            className={styles.enumSelect}
            value={attack.EffectTrigger}
            onChange={(e) => onChange({ ...attack, EffectTrigger: e.target.value as EffectTrigger })}
          >
            {EFFECT_TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {triggerLabel(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {text('Notes', 'Notes')}

      <div>
        <button type="button" className={`tap-inline ${styles.bool}`} onClick={onRemove}>
          Remove attack
        </button>
      </div>
    </div>
  );
}

export function EnemyStatBlockEditor({ fieldId, value, onChange }: EnemyStatBlockEditorProps) {
  const { data: library } = useLibrary();
  const [showNewProfile, setShowNewProfile] = useState<EnemyProfile | null>(null);

  if (!library) return <div>Loading library...</div>;

  const virtues = library.virtues ?? [];
  const conditions = library.conditions ?? [];
  const conditionsByVirtueId = new Map<string, { Id: string; Name: string }[]>();
  for (const cond of conditions) {
    if (!conditionsByVirtueId.has(cond.VirtueId)) {
      conditionsByVirtueId.set(cond.VirtueId, []);
    }
    conditionsByVirtueId.get(cond.VirtueId)!.push({ Id: cond.Id, Name: cond.Name });
  }

  const virtueOptions = virtues.map((v) => ({ value: v.Id, label: v.Name }));

  if (!value) {
    return (
      <div id={fieldId} className={styles.container}>
        <div className={styles.noValueSection}>
          <select
            className={styles.enumSelect}
            aria-label="Profile"
            value={showNewProfile ?? ''}
            onChange={(e) => setShowNewProfile(e.target.value as EnemyProfile)}
          >
            <option value="">Pick a profile</option>
            {PROFILES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`tap-inline ${styles.bool}`}
            disabled={!showNewProfile}
            onClick={() => {
              if (showNewProfile) {
                onChange(defaultStatBlock(showNewProfile));
                setShowNewProfile(null);
              }
            }}
          >
            Add stat block
          </button>
        </div>
      </div>
    );
  }

  const profile = ENEMY_PROFILE_DEFAULTS[value.Profile];
  const isLegendary = value.Profile === 'Legendary';

  return (
    <div id={fieldId} className={styles.container}>
      <div className={styles.section}>
        <label htmlFor={`${fieldId}-profile`} className={shared.hint}>
          Profile
        </label>
        <select
          id={`${fieldId}-profile`}
          className={styles.enumSelect}
          value={value.Profile}
          onChange={(e) => {
            const newProfile = e.target.value as EnemyProfile;
            const newDefaults = ENEMY_PROFILE_DEFAULTS[newProfile];
            onChange({
              ...value,
              Profile: newProfile,
              Threat: newDefaults.Threat,
              StrainBoxes: newDefaults.StrainBoxes,
              StatusSlots: newDefaults.StatusSlots,
              ConditionSlots: newDefaults.ConditionSlots,
              LastStandBoxes: newDefaults.LastStandBoxes,
            });
          }}
        >
          {PROFILES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className={shared.hint} style={{ marginTop: 'var(--sp-2)' }}>
          {profile.Turn} Typical Attack: {profile.TypicalAttack[0]}–{profile.TypicalAttack[1]} Strain.
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${fieldId}-threat`} className={shared.hint}>
            Threat
          </label>
          <input
            id={`${fieldId}-threat`}
            type="number"
            className={styles.number}
            value={value.Threat}
            step="0.5"
            min="0"
            onChange={(e) => onChange({ ...value, Threat: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${fieldId}-speed`} className={shared.hint}>
            Speed
          </label>
          <input
            id={`${fieldId}-speed`}
            type="number"
            className={styles.number}
            value={value.Speed}
            min="0"
            onChange={(e) => onChange({ ...value, Speed: parseInt(e.target.value, 10) || 0 })}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${fieldId}-range`} className={shared.hint}>
            Range
          </label>
          <input
            id={`${fieldId}-range`}
            type="number"
            className={styles.number}
            value={value.Range}
            min="0"
            onChange={(e) => onChange({ ...value, Range: parseInt(e.target.value, 10) || 0 })}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${fieldId}-guard`} className={shared.hint}>
            Guard
          </label>
          <input
            id={`${fieldId}-guard`}
            type="number"
            className={styles.number}
            value={value.Guard}
            min="0"
            onChange={(e) => onChange({ ...value, Guard: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${fieldId}-strain`} className={shared.hint}>
            Strain Boxes
          </label>
          <input
            id={`${fieldId}-strain`}
            type="number"
            className={styles.number}
            value={value.StrainBoxes}
            min="1"
            onChange={(e) => onChange({ ...value, StrainBoxes: parseInt(e.target.value, 10) || 1 })}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${fieldId}-statusSlots`} className={shared.hint}>
            Status Slots
          </label>
          <input
            id={`${fieldId}-statusSlots`}
            type="number"
            className={styles.number}
            value={value.StatusSlots}
            min="0"
            onChange={(e) => onChange({ ...value, StatusSlots: parseInt(e.target.value, 10) || 0 })}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${fieldId}-conditionSlots`} className={shared.hint}>
            Condition Slots
          </label>
          <input
            id={`${fieldId}-conditionSlots`}
            type="number"
            className={styles.number}
            value={value.ConditionSlots}
            min="0"
            onChange={(e) => onChange({ ...value, ConditionSlots: parseInt(e.target.value, 10) || 0 })}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${fieldId}-gambit`} className={shared.hint}>
            Gambit Charges
          </label>
          <input
            id={`${fieldId}-gambit`}
            type="number"
            className={styles.number}
            value={value.GambitCharges}
            min="0"
            onChange={(e) => onChange({ ...value, GambitCharges: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${fieldId}-size`} className={shared.hint}>
            Size
          </label>
          <select
            id={`${fieldId}-size`}
            className={styles.enumSelect}
            value={value.Size}
            onChange={(e) => onChange({ ...value, Size: e.target.value as EnemySize })}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor={`${fieldId}-unshakable`} className={shared.hint}>
            Unshakable
          </label>
          <button
            id={`${fieldId}-unshakable`}
            type="button"
            className={styles.bool}
            aria-pressed={value.Unshakable}
            onClick={() => onChange({ ...value, Unshakable: !value.Unshakable })}
          >
            {value.Unshakable ? 'Yes' : 'No'}
          </button>
        </div>

        {isLegendary && (
          <div className={styles.field}>
            <label htmlFor={`${fieldId}-lastStand`} className={shared.hint}>
              Last Stand (N)
            </label>
            <input
              id={`${fieldId}-lastStand`}
              type="number"
              className={styles.number}
              value={value.LastStandBoxes}
              min="0"
              onChange={(e) => onChange({ ...value, LastStandBoxes: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
        )}
      </div>

      <div className={styles.section}>
        <label className={shared.hint}>Virtues</label>
        <div className={styles.virtuesList}>
          {virtues.map((virtue) => {
            const entry = value.Virtues.find((v) => v.VirtueId === virtue.Id);
            return (
              <div key={virtue.Id} className={styles.virtueRow}>
                <span className={styles.virtueName}>{virtue.Name}</span>
                <select
                  className={styles.enumSelect}
                  aria-label={`${virtue.Name} rating`}
                  value={entry?.Rating ?? ''}
                  onChange={(e) => {
                    const rating = e.target.value;
                    if (rating === '') {
                      // Remove
                      onChange({
                        ...value,
                        Virtues: value.Virtues.filter((v) => v.VirtueId !== virtue.Id),
                      });
                    } else {
                      const num = parseInt(rating, 10);
                      if (entry) {
                        onChange({
                          ...value,
                          Virtues: value.Virtues.map((v) =>
                            v.VirtueId === virtue.Id ? { ...v, Rating: num } : v
                          ),
                        });
                      } else {
                        onChange({
                          ...value,
                          Virtues: [...value.Virtues, { VirtueId: virtue.Id, Rating: num }],
                        });
                      }
                    }
                  }}
                >
                  <option value="">Not listed</option>
                  <option value="0">Neutral</option>
                  <option value="1">+</option>
                  <option value="2">++</option>
                  <option value="-1">−</option>
                  <option value="-2">−−</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <label className={shared.hint}>Attacks</label>
        <div className={styles.attacks}>
          {value.Attacks.map((attack, i) => (
            <EnemyAttackRow
              key={i}
              idPrefix={`${fieldId}-attack-${i}`}
              attack={attack}
              onChange={(a) => {
                const newAttacks = [...value.Attacks];
                newAttacks[i] = a;
                onChange({ ...value, Attacks: newAttacks });
              }}
              onRemove={() => {
                onChange({ ...value, Attacks: value.Attacks.filter((_, idx) => idx !== i) });
              }}
              virtueOptions={virtueOptions}
              conditionsByVirtueId={conditionsByVirtueId}
            />
          ))}
          <button
            type="button"
            className={`tap-inline ${styles.bool}`}
            onClick={() => {
              onChange({
                ...value,
                Attacks: [
                  ...value.Attacks,
                  {
                    Name: '',
                    Target: '',
                    Range: 0,
                    Strain: 0,
                    ResistVirtueIds: [],
                    ConditionVirtueId: null,
                    AdditionalEffect: '',
                    EffectTrigger: 'OnStrain' as const,
                    MisfortuneCost: 0,
                    Notes: '',
                  },
                ],
              });
            }}
          >
            Add attack
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <label htmlFor={`${fieldId}-abilities`} className={shared.hint}>
          Abilities
        </label>
        <textarea
          id={`${fieldId}-abilities`}
          className={styles.textarea}
          value={value.Abilities}
          onChange={(e) => onChange({ ...value, Abilities: e.target.value })}
          rows={4}
        />
      </div>

      <button type="button" className={`tap-inline ${styles.bool}`} onClick={() => onChange(null)}>
        Remove stat block
      </button>
    </div>
  );
}

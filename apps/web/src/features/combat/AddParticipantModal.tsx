import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Character, EnemyStatusLimit, EnemyTemplate, Library, ToughnessTier } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { Field } from '../../components/form/Field.js';
import { TextInput } from '../../components/form/TextInput.js';
import { Select } from '../../components/form/Select.js';
import { NumberInput } from '../../components/form/NumberInput.js';
import fieldStyles from '../../components/form/field.module.css';
import modal from '../../styles/modal.module.css';
import styles from './AddParticipantModal.module.css';

type Tab = 'pc' | 'template' | 'adhoc';

/** The Library/Ad-hoc tabs' simple fields (templateId, name, toughness, saveToLibrary) are
 *  react-hook-form-registered; Status Limits stays local useState — it's a genuinely dynamic
 *  array whose rows carry their own two-field shape, and this app's existing setLimits(prev =>
 *  ...) pattern for it already works well, so it wasn't rebuilt on useFieldArray just to say
 *  every field went through RHF. See WorkPlan-0.23.0.md item E3. */
interface FormValues {
  templateId: string;
  name: string;
  toughness: ToughnessTier;
  isBoss: boolean;
  gambitCharges: number;
  saveToLibrary: boolean;
}

export function AddParticipantModal({
  library,
  availableCharacters,
  onAddPC,
  onAddEnemyFromTemplate,
  onAddAdhocEnemy,
  onClose,
}: {
  library: Library;
  availableCharacters: Character[];
  onAddPC: (character: Character) => void;
  onAddEnemyFromTemplate: (template: EnemyTemplate) => void;
  onAddAdhocEnemy: (name: string, toughness: ToughnessTier, statusLimits: EnemyStatusLimit[], isBoss: boolean, gambitCharges: number, saveToLibrary: boolean) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(availableCharacters.length > 0 ? 'pc' : 'template');
  const [limits, setLimits] = useState<EnemyStatusLimit[]>([{ StatusName: 'Hurt', Limit: 4 }]);

  const { register, watch, handleSubmit } = useForm<FormValues>({
    defaultValues: { templateId: library.enemies[0]?.Id ?? '', name: '', toughness: 'None', isBoss: false, gambitCharges: 3, saveToLibrary: false },
  });
  const templateId = watch('templateId');
  const name = watch('name');
  const isBoss = watch('isBoss');

  function setLimit(i: number, patch: Partial<EnemyStatusLimit>) {
    setLimits((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submitTemplate() {
    const t = library.enemies.find((e) => e.Id === templateId);
    if (t) onAddEnemyFromTemplate(t);
  }

  function submitAdhoc(data: FormValues) {
    onAddAdhocEnemy(data.name.trim(), data.toughness, limits.filter((l) => l.StatusName.trim()), data.isBoss, data.gambitCharges, data.saveToLibrary);
  }

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-participant-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="add-participant-title" className={modal.title}>Add to Combat</h2>
        </div>
        <div className={modal.body}>
          <div className={styles.tabs} role="tablist" aria-label="Add to Combat">
            <button
              type="button"
              id="add-participant-tab-pc"
              role="tab"
              aria-selected={tab === 'pc'}
              aria-controls="add-participant-panel-pc"
              className={`tap-inline ${styles.tab} ${tab === 'pc' ? styles.tabActive : ''}`}
              onClick={() => setTab('pc')}
            >
              Character
            </button>
            <button
              type="button"
              id="add-participant-tab-template"
              role="tab"
              aria-selected={tab === 'template'}
              aria-controls="add-participant-panel-template"
              className={`tap-inline ${styles.tab} ${tab === 'template' ? styles.tabActive : ''}`}
              onClick={() => setTab('template')}
            >
              From Library
            </button>
            <button
              type="button"
              id="add-participant-tab-adhoc"
              role="tab"
              aria-selected={tab === 'adhoc'}
              aria-controls="add-participant-panel-adhoc"
              className={`tap-inline ${styles.tab} ${tab === 'adhoc' ? styles.tabActive : ''}`}
              onClick={() => setTab('adhoc')}
            >
              Ad-hoc Enemy
            </button>
          </div>

          {tab === 'pc' && (
            <div role="tabpanel" id="add-participant-panel-pc" aria-labelledby="add-participant-tab-pc">
              {availableCharacters.length === 0 ? (
                <p className={styles.empty}>Every character is already in this fight.</p>
              ) : (
                <>
                  <label className={fieldStyles.label} id="add-participant-pc-label">Which character?</label>
                  <div role="group" aria-labelledby="add-participant-pc-label">
                    {availableCharacters.map((c) => (
                      <button key={c.Id} type="button" className={`tap-inline ${modal.secondaryAction}`} onClick={() => onAddPC(c)}>
                        {c.Name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'template' && (
            <div role="tabpanel" id="add-participant-panel-template" aria-labelledby="add-participant-tab-template">
              {library.enemies.length === 0 ? (
                <p className={styles.empty}>No Enemies authored yet — add one in Content Admin, or use Ad-hoc Enemy.</p>
              ) : (
                <>
                  <Field label="Enemy template" htmlFor="add-participant-template">
                    <Select id="add-participant-template" {...register('templateId')}>
                      {library.enemies.map((e) => (
                        <option key={e.Id} value={e.Id}>
                          {e.Name}
                          {e.IsBoss ? ' (Boss)' : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <button className={`tap-inline ${modal.primaryAction}`} disabled={!templateId} onClick={submitTemplate}>
                    Add
                  </button>
                </>
              )}
            </div>
          )}

          {tab === 'adhoc' && (
            <div role="tabpanel" id="add-participant-panel-adhoc" aria-labelledby="add-participant-tab-adhoc">
              <Field label="Name" htmlFor="add-participant-name">
                <TextInput id="add-participant-name" placeholder="Brigand, Cave Bear…" autoFocus {...register('name')} />
              </Field>

              <Field label="Toughness" htmlFor="add-participant-toughness">
                <Select id="add-participant-toughness" {...register('toughness')}>
                  <option value="None">None</option>
                  <option value="Medium">Medium (&minus;2 to incoming Ranks)</option>
                  <option value="Heavy">Heavy (treat as one tier lower)</option>
                </Select>
              </Field>

              <label className={fieldStyles.label} id="add-participant-limits-label">Status Limits (defeated at any one)</label>
              <div role="group" aria-labelledby="add-participant-limits-label">
                {limits.map((l, i) => (
                  <div key={i} className={styles.row}>
                    <TextInput
                      aria-label="Status name"
                      className={styles.field}
                      value={l.StatusName}
                      onChange={(e) => setLimit(i, { StatusName: e.target.value })}
                      placeholder="Hurt"
                    />
                    <NumberInput
                      aria-label="Limit"
                      className={styles.limitInput}
                      min={1}
                      value={l.Limit}
                      onChange={(e) => setLimit(i, { Limit: parseInt(e.target.value, 10) || 1 })}
                    />
                  </div>
                ))}
              </div>
              <button type="button" className={`tap-inline ${modal.secondaryAction}`} onClick={() => setLimits((prev) => [...prev, { StatusName: '', Limit: 4 }])}>
                Add another Limit
              </button>

              <label className={styles.checkboxRow}>
                <input type="checkbox" {...register('isBoss')} />
                Boss (acts after every Hero's turn, doesn't auto-drop at its Limit)
              </label>

              {isBoss && (
                <Field label="Gambit Charges" htmlFor="add-participant-gambit-charges">
                  <NumberInput id="add-participant-gambit-charges" min={0} {...register('gambitCharges', { valueAsNumber: true })} />
                </Field>
              )}

              <label className={styles.checkboxRow}>
                <input type="checkbox" {...register('saveToLibrary')} />
                Save this Enemy to the library for reuse
              </label>

              <button className={`tap-inline ${modal.primaryAction}`} disabled={!name.trim()} onClick={handleSubmit(submitAdhoc)}>
                Add
              </button>
            </div>
          )}

          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

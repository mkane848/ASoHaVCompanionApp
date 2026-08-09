import { useState } from 'react';
import type { Character, EnemyStatusLimit, EnemyTemplate, Library, ToughnessTier } from '@asohav/shared';
import modal from '../../styles/modal.module.css';
import styles from './AddParticipantModal.module.css';

type Tab = 'pc' | 'template' | 'adhoc';

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
  onAddAdhocEnemy: (name: string, toughness: ToughnessTier, statusLimits: EnemyStatusLimit[], saveToLibrary: boolean) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(availableCharacters.length > 0 ? 'pc' : 'template');
  const [templateId, setTemplateId] = useState(library.enemies[0]?.Id ?? '');
  const [name, setName] = useState('');
  const [toughness, setToughness] = useState<ToughnessTier>('None');
  const [limits, setLimits] = useState<EnemyStatusLimit[]>([{ StatusName: 'Hurt', Limit: 4 }]);
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  function setLimit(i: number, patch: Partial<EnemyStatusLimit>) {
    setLimits((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 className={modal.title}>Add to Combat</h2>
        </div>
        <div className={modal.body}>
          <div className={styles.tabs}>
            <button type="button" className={`tap-inline ${styles.tab} ${tab === 'pc' ? styles.tabActive : ''}`} onClick={() => setTab('pc')}>
              Character
            </button>
            <button type="button" className={`tap-inline ${styles.tab} ${tab === 'template' ? styles.tabActive : ''}`} onClick={() => setTab('template')}>
              From Library
            </button>
            <button type="button" className={`tap-inline ${styles.tab} ${tab === 'adhoc' ? styles.tabActive : ''}`} onClick={() => setTab('adhoc')}>
              Ad-hoc Enemy
            </button>
          </div>

          {tab === 'pc' &&
            (availableCharacters.length === 0 ? (
              <p className={styles.empty}>Every character is already in this fight.</p>
            ) : (
              <>
                <label className={styles.label}>Which character?</label>
                {availableCharacters.map((c) => (
                  <button key={c.Id} type="button" className={`tap-inline ${modal.secondaryAction}`} onClick={() => onAddPC(c)}>
                    {c.Name}
                  </button>
                ))}
              </>
            ))}

          {tab === 'template' &&
            (library.enemies.length === 0 ? (
              <p className={styles.empty}>No Enemies authored yet — add one in Content Admin, or use Ad-hoc Enemy.</p>
            ) : (
              <>
                <label className={styles.label}>Enemy template</label>
                <select className={styles.select} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {library.enemies.map((e) => (
                    <option key={e.Id} value={e.Id}>
                      {e.Name}
                      {e.IsBoss ? ' (Boss)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  className={`tap-inline ${modal.primaryAction}`}
                  disabled={!templateId}
                  onClick={() => {
                    const t = library.enemies.find((e) => e.Id === templateId);
                    if (t) onAddEnemyFromTemplate(t);
                  }}
                >
                  Add
                </button>
              </>
            ))}

          {tab === 'adhoc' && (
            <>
              <label className={styles.label}>Name</label>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brigand, Cave Bear…" autoFocus />

              <label className={styles.label}>Toughness</label>
              <select className={styles.select} value={toughness} onChange={(e) => setToughness(e.target.value as ToughnessTier)}>
                <option value="None">None</option>
                <option value="Medium">Medium (&minus;2 to incoming Ranks)</option>
                <option value="Heavy">Heavy (treat as one tier lower)</option>
              </select>

              <label className={styles.label}>Status Limits (defeated at any one)</label>
              {limits.map((l, i) => (
                <div key={i} className={styles.row}>
                  <input className={`${styles.input} ${styles.field}`} value={l.StatusName} onChange={(e) => setLimit(i, { StatusName: e.target.value })} placeholder="Hurt" />
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    style={{ maxWidth: 80 }}
                    value={l.Limit}
                    onChange={(e) => setLimit(i, { Limit: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
              ))}
              <button type="button" className={`tap-inline ${modal.secondaryAction}`} onClick={() => setLimits((prev) => [...prev, { StatusName: '', Limit: 4 }])}>
                Add another Limit
              </button>

              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} />
                Save this Enemy to the library for reuse
              </label>

              <button
                className={`tap-inline ${modal.primaryAction}`}
                disabled={!name.trim()}
                onClick={() => onAddAdhocEnemy(name.trim(), toughness, limits.filter((l) => l.StatusName.trim()), saveToLibrary)}
              >
                Add
              </button>
            </>
          )}

          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

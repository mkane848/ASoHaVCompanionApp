import { useState } from 'react';
import type { Character, EnemyStatusLimit, EnemyTemplate, Library, ToughnessTier } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
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
                  <label className={styles.label} id="add-participant-pc-label">Which character?</label>
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
                  <label className={styles.label} htmlFor="add-participant-template">Enemy template</label>
                  <select id="add-participant-template" className={styles.select} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
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
              )}
            </div>
          )}

          {tab === 'adhoc' && (
            <div role="tabpanel" id="add-participant-panel-adhoc" aria-labelledby="add-participant-tab-adhoc">
              <label className={styles.label} htmlFor="add-participant-name">Name</label>
              <input id="add-participant-name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brigand, Cave Bear…" autoFocus />

              <label className={styles.label} htmlFor="add-participant-toughness">Toughness</label>
              <select id="add-participant-toughness" className={styles.select} value={toughness} onChange={(e) => setToughness(e.target.value as ToughnessTier)}>
                <option value="None">None</option>
                <option value="Medium">Medium (&minus;2 to incoming Ranks)</option>
                <option value="Heavy">Heavy (treat as one tier lower)</option>
              </select>

              <label className={styles.label} id="add-participant-limits-label">Status Limits (defeated at any one)</label>
              <div role="group" aria-labelledby="add-participant-limits-label">
                {limits.map((l, i) => (
                  <div key={i} className={styles.row}>
                    <input aria-label="Status name" className={`${styles.input} ${styles.field}`} value={l.StatusName} onChange={(e) => setLimit(i, { StatusName: e.target.value })} placeholder="Hurt" />
                    <input
                      aria-label="Limit"
                      className={`${styles.input} ${styles.limitInput}`}
                      type="number"
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

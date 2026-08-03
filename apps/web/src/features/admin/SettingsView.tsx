import { useState } from 'react';
import { settingsFields, type GameSettings } from '@asohav/shared';
import shared from './adminShared.module.css';
import styles from './SettingsView.module.css';

export function SettingsView({ settings, onSave }: { settings: GameSettings; onSave: (values: Partial<GameSettings>) => void }) {
  const [draft, setDraft] = useState<GameSettings>(settings);

  return (
    <div>
      <h2 className={shared.viewTitle}>Game settings</h2>
      <p className={shared.viewIntro}>
        Values the rules depend on, kept out of the code so they can be tuned during playtesting.
      </p>
      {settingsFields.map((f) => (
        <div key={f.name} className={styles.field}>
          <label className={shared.fieldLabel}>{f.label}</label>
          <input
            className={styles.number}
            type="number"
            value={(draft as any)[f.name] ?? ''}
            onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
          />
          {f.hint && <div className={shared.hint}>{f.hint}</div>}
        </div>
      ))}
      <button className={shared.primaryButton} onClick={() => onSave(draft)}>
        Save settings
      </button>
    </div>
  );
}

import { useState } from 'react';
import { settingsFields, type GameSettings } from '@asohav/shared';

export function SettingsView({ settings, onSave }: { settings: GameSettings; onSave: (values: Partial<GameSettings>) => void }) {
  const [draft, setDraft] = useState<GameSettings>(settings);

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, margin: '0 0 4px' }}>Game settings</h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-55)', fontStyle: 'italic', margin: '0 0 18px' }}>
        Values the rules depend on, kept out of the code so they can be tuned during playtesting.
      </p>
      {settingsFields.map((f) => (
        <div key={f.name} style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', fontSize: 10.5, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--ink-45)', marginBottom: 4 }}>{f.label}</label>
          <input
            type="number"
            value={(draft as any)[f.name] ?? ''}
            onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
            style={{ width: 120, background: 'var(--panel)', border: '1px solid var(--rule-field)', fontSize: 13.5, padding: '7px 9px', outline: 'none' }}
          />
          {f.hint && <div style={{ fontSize: 11.5, color: 'var(--ink-45)', marginTop: 3, fontStyle: 'italic' }}>{f.hint}</div>}
        </div>
      ))}
      <button onClick={() => onSave(draft)} style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: '9px 16px' }}>
        Save settings
      </button>
    </div>
  );
}

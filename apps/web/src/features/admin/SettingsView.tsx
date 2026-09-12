import { useState } from 'react';
import { settingsFields, type GameSettings } from '@asohav/shared';
import { FieldEditor } from './FieldEditor.js';
import shared from './adminShared.module.css';

/** Game settings, rendered through the same `FieldEditor` every library collection uses.
 *
 *  Until 0.51.0 this file hand-rolled its own `<input type="number">` for *every* field,
 *  unconditionally, ignoring the `type` each one declares in `schema.ts`. That made
 *  `GlossaryAutoLink` — declared `type: 'bool'` since 0.24.0 — both unreadable and destructive:
 *  a boolean rendered into a number input shows blank, and editing it ran the value through
 *  `parseInt()` to `NaN`, which JSON-serialises to `null`. `PUT /library/settings` shallow-merged
 *  the body with no validation, so there was nothing to stop that reaching the stored library and
 *  silently disabling glossary auto-linking app-wide.
 *
 *  Routing through `FieldEditor` means this view now supports every FieldType for free, so a
 *  future setting doesn't need this file touched at all — only `settingsFields`. */
export function SettingsView({ settings, onSave }: { settings: GameSettings; onSave: (values: Partial<GameSettings>) => void }) {
  const [draft, setDraft] = useState<GameSettings>(settings);

  return (
    <div>
      <h2 className={shared.viewTitle}>Game settings</h2>
      <p className={shared.viewIntro}>
        Values the rules depend on, kept out of the code so they can be tuned during playtesting.
      </p>
      {settingsFields.map((f) => (
        <FieldEditor
          key={f.name}
          field={f}
          value={(draft as unknown as Record<string, unknown>)[f.name]}
          options={[]}
          onChange={(v) => setDraft({ ...draft, [f.name]: v } as GameSettings)}
        />
      ))}
      <button className={shared.primaryButton} onClick={() => onSave(draft)}>
        Save settings
      </button>
    </div>
  );
}

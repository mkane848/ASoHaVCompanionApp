import type { CharacterSheet } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';

export function LooksPanel({ sheet, commit }: { sheet: CharacterSheet; commit: (m: (d: CharacterSheet) => void) => void }) {
  return (
    <Panel>
      <PanelHeader>Looks</PanelHeader>
      <textarea
        defaultValue={sheet.Looks}
        onBlur={(e) => commit((d) => { d.Looks = e.target.value; })}
        rows={3}
        placeholder="How your character reads at a glance…"
        style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule-field)', fontSize: 13.5, lineHeight: 1.6, resize: 'vertical', padding: '0 0 6px', outline: 'none' }}
      />
    </Panel>
  );
}

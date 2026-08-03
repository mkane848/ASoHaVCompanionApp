import type { CharacterSheet } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import styles from './LooksPanel.module.css';

export function LooksPanel({ sheet, commit }: { sheet: CharacterSheet; commit: (m: (d: CharacterSheet) => void) => void }) {
  return (
    <Panel collapseId="looks">
      <PanelHeader>Looks</PanelHeader>
      <textarea
        className={styles.looks}
        defaultValue={sheet.Looks}
        onBlur={(e) => commit((d) => { d.Looks = e.target.value; })}
        rows={3}
        placeholder="How your character reads at a glance…"
      />
    </Panel>
  );
}

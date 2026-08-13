import { useState } from 'react';
import type { CharacterSheet } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import styles from './LooksPanel.module.css';

function splitLooks(raw: string): string[] {
  return raw.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Looks used to be one freeform textarea — this renders what the player actually entered as a
 *  row of small editable tags instead, mirroring CreateCharacterPage.tsx's repeatable-list
 *  pattern for the same field so creating and later editing Looks feel like the same idea. Still
 *  backed by the one `\n`-joined CharacterSheet.Looks string — see CLAUDE.md's JSONB-blob note —
 *  this just changes how that string is edited, not its shape on the wire. */
export function LooksPanel({ sheet, commit }: { sheet: CharacterSheet; commit: (m: (d: CharacterSheet) => void) => void }) {
  const [looks, setLooks] = useState<string[]>(() => splitLooks(sheet.Looks));

  function commitLooks(next: string[]) {
    commit((d) => { d.Looks = next.map((l) => l.trim()).filter(Boolean).join('\n'); });
  }

  function updateLook(i: number, value: string) {
    setLooks((prev) => prev.map((l, idx) => (idx === i ? value : l)));
  }

  function removeLook(i: number) {
    const next = looks.filter((_, idx) => idx !== i);
    setLooks(next);
    commitLooks(next);
  }

  return (
    <Panel collapseId="looks">
      <PanelHeader>Looks</PanelHeader>
      <p className={styles.hint}>How your character reads at a glance.</p>
      <div className={styles.chips}>
        {looks.map((look, i) => (
          <div key={i} className={styles.chip}>
            <input
              aria-label={`Look ${i + 1}`}
              className={`tap-inline ${styles.chipInput}`}
              value={look}
              onChange={(e) => updateLook(i, e.target.value)}
              onBlur={() => commitLooks(looks)}
              placeholder="A look…"
              size={Math.max(6, look.length + 1)}
            />
            <button
              type="button"
              className={`tap-inline ${styles.chipRemove}`}
              onClick={() => removeLook(i)}
              aria-label={`Remove "${look || 'this look'}"`}
            >
              &times;
            </button>
          </div>
        ))}
        <button type="button" className={`tap-inline ${styles.addChip}`} onClick={() => setLooks((prev) => [...prev, ''])}>
          + Add a look
        </button>
      </div>
    </Panel>
  );
}

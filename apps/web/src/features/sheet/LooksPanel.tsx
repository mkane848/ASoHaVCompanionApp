import { useState } from 'react';
import type { CharacterSheet } from '@asohav/shared';
import styles from './LooksPanel.module.css';

function splitLooks(raw: string): string[] {
  return raw.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Looks used to be one freeform textarea — this renders what the player actually entered as a
 *  row of small editable tags instead, mirroring CreateCharacterPage.tsx's repeatable-list
 *  pattern for the same field so creating and later editing Looks feel like the same idea. Still
 *  backed by the one `\n`-joined CharacterSheet.Looks string — see CLAUDE.md's JSONB-blob note —
 *  this just changes how that string is edited, not its shape on the wire.
 *
 *  As of 0.24.0 this is a plain section (a `.groupLabel`-style heading, no `Panel`/`PanelHeader`),
 *  rendered first inside `BackgroundPanel` — the same "demote to an integrated sub-section"
 *  pattern `ArmorSection` used inside `StatusesPanel` in 0.22.0. */
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
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Looks</div>
      <p className={styles.hint}>How your character reads at a glance.</p>
      <div className={`board ${styles.chips}`}>
        {looks.map((look, i) => (
          <div key={i} className={`posting tilt ${styles.chip}`}>
            <input
              aria-label={`Look ${i + 1}`}
              className={`tap-inline ${styles.chipInput}`}
              value={look}
              onChange={(e) => updateLook(i, e.target.value)}
              onBlur={() => commitLooks(looks)}
              placeholder="A look…"
              // +4, not +1: `size` is "N average character widths" for whichever
              // --font-display is currently active, and Notice Board's Cinzel (WorkPlan-0.26.0)
              // runs noticeably wider per character than Parchment's Cormorant Garamond — a
              // longer Look was visibly clipping ("Hands that never stop movin[g].") under
              // Cinzel with the old +1 margin. A little extra empty space in the box under
              // Parchment is a much smaller problem than clipped text under Notice Board.
              size={Math.max(6, look.length + 4)}
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
    </div>
  );
}

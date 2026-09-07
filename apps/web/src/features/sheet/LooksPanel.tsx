import type { CharacterSheet } from '@asohav/shared';
import { TagList } from '../../components/TagList.js';
import styles from './LooksPanel.module.css';
import typography from '../../styles/typography.module.css';

function splitLooks(raw: string): string[] {
  return raw.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Looks used to be one freeform textarea — this renders what the player actually entered as a
 *  row of small tags instead, mirroring CreateCharacterPage.tsx's repeatable-list pattern for the
 *  same field so creating and later editing Looks feel like the same idea. Still backed by the
 *  one `\n`-joined CharacterSheet.Looks string — see CLAUDE.md's JSONB-blob note — this just
 *  changes how that string is edited, not its shape on the wire.
 *
 *  As of 0.24.0 this is a plain section (a `.groupLabel`-style heading, no `Panel`/`PanelHeader`),
 *  rendered inside `BackgroundPanel` — the same "demote to an integrated sub-section" pattern
 *  `ArmorSection` used inside `StatusesPanel` in 0.22.0.
 *
 *  **0.40.0**: the hand-rolled chip row became a `TagList` call site. Three Looks used to occupy
 *  three rows with the add button on a fourth, because each chip carried two 44px controls (a
 *  live input and its own remove) and the add button sat outside the wrap flow entirely. The
 *  local `useState` mirror went with it — it only existed so a chip could be typed into
 *  character-by-character without a write per keystroke, and `TagList` commits whole values. */
export function LooksPanel({ sheet, commit }: { sheet: CharacterSheet; commit: (m: (d: CharacterSheet) => void) => void }) {
  const looks = splitLooks(sheet.Looks);

  return (
    <div className={styles.section}>
      <div className={typography.sectionLabel}>Looks</div>
      <p className={`${typography.hint} ${styles.hint}`}>How your character reads at a glance.</p>
      <TagList
        items={looks}
        onChange={(next) => commit((d) => { d.Looks = next.map((l) => l.trim()).filter(Boolean).join('\n'); })}
        addLabel="+ Add a look"
        placeholder="A look…"
        ariaPrefix="Look"
        boardClassName="board"
        /* Looks keeps the pinned-paper tilt; the denser tag groups elsewhere don't. Per
           surfaces.css, `.tilt` is a per-call-site opt-in and never something a shared
           component decides for its consumers. */
        chipClassName={`posting tilt ${styles.chip}`}
      />
    </div>
  );
}

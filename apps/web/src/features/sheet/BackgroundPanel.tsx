import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { LooksPanel } from './LooksPanel.js';
import { MotifPanel } from './MotifPanel.js';
import styles from './BackgroundPanel.module.css';

/** Consolidates Looks and the three Motifs under one "Background" section (0.24.0, re-homed to
 *  Motifs in 0.29.0). As of 0.39.0 (WorkPlan-0.39.0.md item 4, an explicit repo-owner layout
 *  call), the body is a two-column grid once the panel measures wide enough — Motifs 2fr on the
 *  left, Looks 1fr on the right — reusing `Panel`'s own `sheet-panel` container query rather than
 *  establishing a second one. **JSX order is Motifs-then-Looks, not `order:`** — the wide layout
 *  puts Looks on the right, and reordering the source (rather than flipping visual order with
 *  `order:`) keeps tab order matching visual order for a keyboard user. Below the threshold this
 *  just stacks, Motifs first, matching the wide layout's own reading order. Same "one Panel wraps
 *  demoted sub-sections" shape ArmorSection/StatusesPanel already established in 0.22.0. */
export function BackgroundPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  return (
    <Panel id="p-background" collapseId="background" primary>
      <PanelHeader>Background</PanelHeader>
      <div className={styles.body}>
        <div className={styles.motifs}>
          <MotifPanel sheet={sheet} library={library} commit={commit} />
        </div>
        <div className={styles.looks}>
          <LooksPanel sheet={sheet} commit={commit} />
        </div>
      </div>
    </Panel>
  );
}

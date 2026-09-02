import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { LooksPanel } from './LooksPanel.js';
import { MotifPanel } from './MotifPanel.js';

/** Consolidates Looks and the three Motifs under one "Background" section (0.24.0, re-homed to
 *  Motifs in 0.29.0) — Looks first, then the Motifs. Same "one Panel wraps two demoted
 *  sub-sections" shape ArmorSection/StatusesPanel already established in 0.22.0. */
export function BackgroundPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  return (
    <Panel id="p-background" collapseId="background" primary>
      <PanelHeader>Background</PanelHeader>
      <LooksPanel sheet={sheet} commit={commit} />
      <MotifPanel sheet={sheet} library={library} commit={commit} />
    </Panel>
  );
}

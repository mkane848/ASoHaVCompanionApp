import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { LooksPanel } from './LooksPanel.js';
import { ThemePanel } from './ThemePanel.js';

/** Consolidates Theme and Looks under one "Background" section (0.24.0), per the repo owner's
 *  markup — Looks first, then Theme and its Quests. Frees `.sheet-pair` (which 0.23.0 built for
 *  Theme | Looks) for the Abilities & Skills | Load pairing instead. Same "one Panel wraps two
 *  demoted sub-sections" shape ArmorSection/StatusesPanel already established in 0.22.0. */
export function BackgroundPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  return (
    <Panel id="p-background" collapseId="background" primary>
      <PanelHeader>Background</PanelHeader>
      <LooksPanel sheet={sheet} commit={commit} />
      <ThemePanel sheet={sheet} library={library} commit={commit} />
    </Panel>
  );
}

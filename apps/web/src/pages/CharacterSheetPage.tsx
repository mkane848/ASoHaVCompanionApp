import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useStickyHeaderHeight } from '../lib/useMediaQuery.js';
import { usePanelCollapseStore } from '../store/panelCollapseStore.js';
import { useParams } from 'react-router-dom';
import type { CharacterSheet, MeResponse } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useCommitSheet, useCommitParty, useBondActions } from '../lib/mutations.js';
import { useSheetUiStore } from '../store/sheetUiStore.js';
import { VirtuesPanel } from '../features/sheet/VirtuesPanel.js';
import { LooksPanel } from '../features/sheet/LooksPanel.js';
import { AbilitiesSkillsPanel } from '../features/sheet/AbilitiesSkillsPanel.js';
import { StatusesPanel } from '../features/sheet/StatusesPanel.js';
import { ArmorPanel } from '../features/sheet/ArmorPanel.js';
import { ThemePanel } from '../features/sheet/ThemePanel.js';
import { LoadPanel } from '../features/sheet/LoadPanel.js';
import { AdvancementPanel } from '../features/sheet/AdvancementPanel.js';
import { MovesDrawer } from '../features/sheet/MovesDrawer.js';
import { AdvancementPicker } from '../features/sheet/AdvancementPicker.js';

export default function CharacterSheetPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading: bootLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const commitSheet = useCommitSheet(campaignId, boot?.membership.CharacterId ?? undefined);
  const commitParty = useCommitParty(campaignId);
  const bondActions = useBondActions(campaignId);

  const { drawerOpen, toggleDrawer, closeDrawer, picker, openPicker, closePicker, saveNote, setSaveNote } = useSheetUiStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  /* Publishes the header's real height as --sticky-h so the section nav's anchor
     jumps clear it. It wraps on narrow screens, so it can't be a constant. */
  useStickyHeaderHeight(headerRef);

  const collapsedMap = usePanelCollapseStore((st) => st.collapsed);
  const setAllCollapsed = usePanelCollapseStore((st) => st.setAll);
  const allCollapsed = PANEL_IDS.every((pid) => collapsedMap[pid]);

  if (bootLoading || libLoading || !library) {
    return <Centered>Loading…</Centered>;
  }
  if (!boot) {
    return <Centered>Couldn't load that campaign.</Centered>;
  }
  const { membership, mySheet: sheet, characters, party, bonds } = boot;

  if (membership.Role !== 'Player' || !membership.CharacterId || !sheet) {
    return (
      <Centered>
        <p style={{ fontStyle: 'italic', color: 'var(--ink-55)', maxWidth: 420, textAlign: 'center' }}>
          {membership.Role === 'GM'
            ? "GMs don't keep a character sheet — use the Campaign view to peek at your players' sheets."
            : "You don't have a character on this campaign yet."}
        </p>
      </Centered>
    );
  }

  const character = characters.find((c) => c.Id === membership.CharacterId)!;
  const theme = library.themes.find((t) => t.Id === sheet.Theme.ThemeId);

  function wrappedCommit(mutator: (d: CharacterSheet) => void) {
    commitSheet(mutator);
    setSaveNote(`Saved ${new Date().toLocaleTimeString()}`);
  }

  function doExport() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: 'asohav-character-sheet', sheet }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${character.Name.toLowerCase()}-sheet.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function doImportFile(file: File) {
    file
      .text()
      .then((txt) => {
        const parsed = JSON.parse(txt);
        const incoming = parsed.sheet ?? parsed;
        if (!incoming.Virtues) throw new Error('Not an ASoHaV sheet export.');
        wrappedCommit((d) => Object.assign(d, incoming, { CharacterId: d.CharacterId, Id: d.Id }));
        setSaveNote('Imported.');
      })
      .catch((err) => setSaveNote(`Import failed: ${err.message}`));
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <div ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(239,232,218,.94)', backdropFilter: 'blur(6px)', borderBottom: '1px solid var(--rule)' }}>
        <div className="sheet-header">
          <div className="wrap-anywhere" style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0 10px', marginRight: 'auto', minWidth: 0 }}>
            <span className="sheet-header__title" style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '.01em' }}>{character.Name}</span>
            <span style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>{theme?.Name}</span>
          </div>
          <nav className="sheet-nav">
            {[
              ['#p-virtues', 'Virtues'],
              ['#p-status', 'Status'],
              ['#p-theme', 'Theme'],
              ['#p-load', 'Kit'],
              ['#p-growth', 'Growth'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="tap-inline" style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', textDecoration: 'none', color: 'var(--ink-62)', padding: '6px 10px', whiteSpace: 'nowrap' }}>
                {label}
              </a>
            ))}
          </nav>
          <button className="tap-inline" onClick={toggleDrawer} style={{ fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: '8px 14px' }}>
            Moves
          </button>
        </div>
      </div>

      <div className="sheet-grid">
        <div className="sheet-col">
          <VirtuesPanel sheet={sheet} library={library} commit={wrappedCommit} />
          <LooksPanel sheet={sheet} commit={wrappedCommit} />
          <AbilitiesSkillsPanel sheet={sheet} library={library} />
        </div>

        <div className="sheet-col">
          <StatusesPanel sheet={sheet} commit={wrappedCommit} onNotYet={() => setSaveNote('Status links are not wired up yet.')} />
          <ArmorPanel sheet={sheet} library={library} commit={wrappedCommit} />
          <ThemePanel sheet={sheet} library={library} commit={wrappedCommit} />
          <LoadPanel sheet={sheet} library={library} commit={wrappedCommit} />
          <AdvancementPanel
            sheet={sheet}
            party={party}
            bonds={bonds}
            characters={characters}
            myCharacterId={character.Id}
            commitSheet={wrappedCommit}
            commitParty={(m) => { commitParty(m); setSaveNote(`Saved ${new Date().toLocaleTimeString()}`); }}
            onPropose={(bondId, type, note) => bondActions.propose(bondId, type, { Delta: 1 }, note)}
            openPicker={openPicker}
          />

          <div className="tap-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 2px' }}>
            <button className="tap-inline" onClick={doExport} style={ghostBtn}>Export JSON</button>
            <button className="tap-inline" onClick={() => fileInputRef.current?.click()} style={ghostBtn}>Import JSON</button>
            <button className="tap-inline" onClick={() => setAllCollapsed(PANEL_IDS, !allCollapsed)} style={ghostBtn}>
              {allCollapsed ? 'Expand all' : 'Fold all'}
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) doImportFile(f); e.target.value = ''; }} />
            <span style={{ alignSelf: 'center', fontSize: 11.5, color: 'var(--ink-45)', fontStyle: 'italic' }}>{saveNote}</span>
          </div>
        </div>
      </div>

      <MovesDrawer library={library} open={drawerOpen} onClose={closeDrawer} />
      <AdvancementPicker
        picker={picker}
        library={library}
        sheet={sheet}
        party={party}
        commitSheet={wrappedCommit}
        commitParty={commitParty}
        onProposeForge={(bondId, text) => {
          bondActions.propose(bondId, 'ForgeBond', { Text: text }, "Let's forge it.");
          closePicker();
        }}
        onClose={closePicker}
      />
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 20 }}>{children}</div>;
}

/** Every panel that can fold, in render order — the keys the collapse state
 *  persists under. Kept here so "Fold all" and the panels can't drift apart. */
const PANEL_IDS = ['virtues', 'looks', 'abilities', 'status', 'armor', 'theme', 'load', 'growth'];

const ghostBtn: CSSProperties = {
  fontSize: 11,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  background: 'transparent',
  border: '1px solid var(--ink-28)',
  color: 'rgba(42,32,26,.7)',
  padding: '8px 14px',
};

import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { useStickyHeaderHeight, useScrollEdgeFade } from '../lib/useMediaQuery.js';
import { usePanelCollapseStore } from '../store/panelCollapseStore.js';
import styles from './CharacterSheetPage.module.css';
import { useParams } from 'react-router';
import type { CharacterSheet, MeResponse, Party } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useCommitSheet, useCommitParty, useBondActions } from '../lib/mutations.js';
import { useSheetUiStore } from '../store/sheetUiStore.js';
import { VirtuesPanel } from '../features/sheet/VirtuesPanel.js';
import { StatusesPanel } from '../features/sheet/StatusesPanel.js';
import { BackgroundPanel } from '../features/sheet/BackgroundPanel.js';
import { LoadPanel } from '../features/sheet/LoadPanel.js';
import { AdvancementPanel } from '../features/sheet/AdvancementPanel.js';
import { EndSessionModal } from '../features/sheet/EndSessionModal.js';
import { useClockActions } from '../lib/mutations.js';

// Lazy, same reasoning CampaignPage.tsx already applies to CombatPanel/ClocksPanel (PR #70):
// this slice's new sheet content pushed the budget from 207.13 kB to 221.04 kB gzip against the
// 208 kB cap — CLAUDE.md's slice-6 note flagged there was under 1 kB of headroom left. The four
// guided-flow modals are rarely opened, so those are the obvious cut; `PartyPlaybookPanel` is
// always rendered (like `AdvancementPanel`) but still lazy-loaded with no render condition at
// all, the same "always shown, still deferred" shape `CombatPanel` uses in `GmView` — the
// bundle-budget script excludes any `React.lazy()` chunk regardless of whether it's conditionally
// rendered, and that was the difference between landing under budget and not.
const PartyPlaybookPanel = lazy(() => import('../features/sheet/PartyPlaybookPanel.js').then((m) => ({ default: m.PartyPlaybookPanel })));
const CampActionsModal = lazy(() => import('../features/sheet/CampActionsModal.js').then((m) => ({ default: m.CampActionsModal })));
const KeepWatchModal = lazy(() => import('../features/sheet/KeepWatchModal.js').then((m) => ({ default: m.KeepWatchModal })));
const SetOutModal = lazy(() => import('../features/sheet/SetOutModal.js').then((m) => ({ default: m.SetOutModal })));
const EnjoyDowntimeModal = lazy(() => import('../features/sheet/EnjoyDowntimeModal.js').then((m) => ({ default: m.EnjoyDowntimeModal })));
import { MovesDrawer } from '../features/sheet/MovesDrawer.js';
import { GlossaryDrawer } from '../components/GlossaryDrawer.js';
import { useGlossaryUiStore } from '../store/glossaryUiStore.js';
import { ForgeBondPicker } from '../features/sheet/ForgeBondPicker.js';
import { ConfirmModal } from '../components/ConfirmModal.js';

export default function CharacterSheetPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading: bootLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const commitSheet = useCommitSheet(campaignId, boot?.membership.CharacterId ?? undefined);
  const commitParty = useCommitParty(campaignId);
  const bondActions = useBondActions(campaignId);
  const clockActions = useClockActions(campaignId);

  const { drawerOpen, toggleDrawer, closeDrawer, picker, openPicker, closePicker, saveNote, setSaveNote } = useSheetUiStore();
  const openGlossary = useGlossaryUiStore((s) => s.openDrawer);
  const [pendingImport, setPendingImport] = useState<CharacterSheet | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const [takingCampActions, setTakingCampActions] = useState(false);
  const [keepingWatch, setKeepingWatch] = useState(false);
  const [settingOut, setSettingOut] = useState(false);
  const [enjoyingDowntime, setEnjoyingDowntime] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  /* Publishes the header's real height as --sticky-h so the section nav's anchor
     jumps clear it. It wraps on narrow screens, so it can't be a constant. */
  useStickyHeaderHeight(headerRef);
  /* Below 768px .sheet-nav is a horizontal scroll strip with no other affordance that it
     scrolls; this drives the edge-fade mask in layout.css. */
  useScrollEdgeFade(navRef);

  const collapsedMap = usePanelCollapseStore((st) => st.collapsed);
  const setAllCollapsed = usePanelCollapseStore((st) => st.setAll);
  const allCollapsed = PANEL_IDS.every((pid) => collapsedMap[pid]);

  if (bootLoading || libLoading || !library) {
    return <Centered>Loading…</Centered>;
  }
  if (!boot) {
    return <Centered>Couldn't load that campaign.</Centered>;
  }
  const { membership, mySheet: sheet, characters, party, bonds, clocks } = boot;

  if (membership.Role !== 'Player' || !membership.CharacterId || !sheet) {
    return (
      <Centered>
        <p className={styles.centeredMessage}>
          {membership.Role === 'GM'
            ? "GMs don't keep a character sheet — use the Campaign view to peek at your players' sheets."
            : "You don't have a character on this campaign yet."}
        </p>
      </Centered>
    );
  }

  const character = characters.find((c) => c.Id === membership.CharacterId)!;
  const motifs = sheet.Motifs.map((m) => m.Name).filter(Boolean);
  const archived = boot.campaign.Status === 'Archived';

  function wrappedCommit(mutator: (d: CharacterSheet) => void) {
    commitSheet(mutator);
    setSaveNote(`Saved ${new Date().toLocaleTimeString()}`);
  }

  function wrappedCommitParty(mutator: (d: Party) => void) {
    commitParty(mutator);
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
        setPendingImport(incoming);
      })
      .catch((err) => setSaveNote(`Import failed: ${err.message}`));
  }

  function confirmImport() {
    if (!pendingImport) return;
    const incoming = pendingImport;
    wrappedCommit((d) => Object.assign(d, incoming, { CharacterId: d.CharacterId, Id: d.Id }));
    setSaveNote('Imported.');
    setPendingImport(null);
  }

  return (
    <div className={styles.page}>
      <div ref={headerRef} className={styles.stickyBar}>
        <div className="sheet-header">
          <div className={`wrap-anywhere ${styles.identity}`}>
            <h1 className={`sheet-header__title ${styles.characterName}`}>{character.Name}</h1>
            {character.Pronouns && <span className={styles.pronouns}>{character.Pronouns}</span>}
            {motifs.length > 0 && <span className={styles.themeName}>{motifs.join(' · ')}</span>}
            {archived && <span className={styles.archivedBadge}>Campaign archived</span>}
          </div>
          <nav ref={navRef} className="sheet-nav">
            {[
              ['#p-virtues', 'Virtues'],
              ['#p-status', 'Status'],
              ['#p-background', 'Background'],
              ['#p-load', 'Kit'],
              ['#p-growth', 'Growth'],
              ['#p-party', 'Party'],
            ].map(([href, label]) => (
              <a key={href} href={href} className={styles.navLink}>
                {label}
              </a>
            ))}
          </nav>
          <div className={styles.headerButtons}>
            <button className={`tap-inline ${styles.movesButton}`} onClick={() => openGlossary()}>
              Glossary
            </button>
            <button className={`tap-inline ${styles.movesButton}`} onClick={toggleDrawer}>
              Moves
            </button>
          </div>
        </div>
      </div>

      <div className="sheet-stack">
        <div className="sheet-grid">
          <div className="sheet-col">
            <VirtuesPanel sheet={sheet} library={library} commit={wrappedCommit} />
          </div>
          <div className="sheet-col">
            <StatusesPanel sheet={sheet} library={library} commit={wrappedCommit} />
          </div>
        </div>

        <BackgroundPanel sheet={sheet} library={library} commit={wrappedCommit} />

        <LoadPanel sheet={sheet} library={library} commit={wrappedCommit} />

        <AdvancementPanel
          library={library}
          party={party}
          bonds={bonds}
          characters={characters}
          myCharacterId={character.Id}
          archived={archived}
          commitParty={wrappedCommitParty}
          onPropose={(bondId, type, note) => bondActions.propose(bondId, type, { Delta: 1 }, note)}
          onAccept={(bondId) => bondActions.accept(bondId)}
          onReject={(bondId, withdrawn) => bondActions.reject(bondId, withdrawn)}
          openPicker={openPicker}
        />

        <Suspense fallback={<div className={styles.panelLoading}>Loading…</div>}>
          <PartyPlaybookPanel party={party} library={library} commitParty={wrappedCommitParty} />
        </Suspense>

        <div className={`action-grid ${styles.footerRow}`}>
          <button className={`tap-inline ${styles.ghost}`} onClick={() => setTakingCampActions(true)}>Camp Actions</button>
          <button className={`tap-inline ${styles.ghost}`} onClick={() => setKeepingWatch(true)}>Keep Watch</button>
          <button className={`tap-inline ${styles.ghost}`} onClick={() => setSettingOut(true)}>Set Out</button>
          <button className={`tap-inline ${styles.ghost}`} onClick={() => setEnjoyingDowntime(true)}>Enjoy Downtime</button>
          <button className={`tap-inline ${styles.ghost}`} onClick={() => setEndingSession(true)}>End the Session</button>
          <button className={`tap-inline ${styles.ghost}`} onClick={doExport}>Export JSON</button>
          <button className={`tap-inline ${styles.ghost}`} onClick={() => fileInputRef.current?.click()}>Import JSON</button>
          <button className={`tap-inline ${styles.ghost}`} onClick={() => setAllCollapsed(PANEL_IDS, !allCollapsed)}>
            {allCollapsed ? 'Expand all' : 'Fold all'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className={styles.hiddenInput} onChange={(e) => { const f = e.target.files?.[0]; if (f) doImportFile(f); e.target.value = ''; }} />
          <span className={`span-all ${styles.saveNote}`}>{saveNote}</span>
        </div>
      </div>

      <MovesDrawer
        library={library}
        sheet={sheet}
        open={drawerOpen}
        onClose={closeDrawer}
        commit={commitSheet}
        party={party}
        commitParty={wrappedCommitParty}
        myName={character.Name}
      />
      <GlossaryDrawer library={library} />
      <ForgeBondPicker
        picker={picker}
        onProposeForge={(bondId, text) => {
          bondActions.propose(bondId, 'ForgeBond', { Text: text }, "Let's forge it.");
          closePicker();
        }}
        onClose={closePicker}
      />
      {endingSession && (
        <EndSessionModal
          sheet={sheet}
          library={library}
          bonds={bonds}
          characters={characters}
          myCharacterId={character.Id}
          commitSheet={wrappedCommit}
          commitParty={wrappedCommitParty}
          onPropose={(bondId, type, note) => bondActions.propose(bondId, type, { Delta: 1 }, note)}
          onClose={() => setEndingSession(false)}
        />
      )}
      <Suspense fallback={null}>
        {takingCampActions && (
          <CampActionsModal
            sheet={sheet}
            party={party}
            clocks={clocks}
            commitSheet={wrappedCommit}
            commitParty={wrappedCommitParty}
            onSaveClock={clockActions.save}
            onClose={() => setTakingCampActions(false)}
          />
        )}
        {keepingWatch && (
          <KeepWatchModal sheet={sheet} library={library} commitSheet={wrappedCommit} commitParty={wrappedCommitParty} onClose={() => setKeepingWatch(false)} />
        )}
        {settingOut && (
          <SetOutModal sheet={sheet} library={library} commitSheet={wrappedCommit} onClose={() => setSettingOut(false)} />
        )}
        {enjoyingDowntime && (
          <EnjoyDowntimeModal
            sheet={sheet}
            library={library}
            party={party}
            bonds={bonds}
            characters={characters}
            myCharacterId={character.Id}
            clocks={clocks}
            commitSheet={wrappedCommit}
            commitParty={wrappedCommitParty}
            onPropose={(bondId, note) => bondActions.propose(bondId, 'MarkBond', { Delta: 1 }, note)}
            onSaveClock={clockActions.save}
            onClose={() => setEnjoyingDowntime(false)}
          />
        )}
      </Suspense>
      {pendingImport && (
        <ConfirmModal
          title="Import this sheet?"
          body="This replaces every Virtue, Status, Armor, Load, Motif, and Advancement on this sheet with what's in the file. Your current sheet can't be recovered afterward unless you've exported it first."
          confirmLabel="Import & overwrite"
          onConfirm={confirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className={styles.centered}>{children}</div>;
}

/** Every panel that can fold, in render order — the keys the collapse state
 *  persists under. Kept here so "Fold all" and the panels can't drift apart.
 *
 *  0.24.0: Theme and Looks merged into one Background panel/collapse key —
 *  the old separate 'theme'/'looks' keys are gone. Any zustand-persisted
 *  client still carrying one of those two old keys just leaves it as a
 *  harmless unused entry in its collapse-state store; no migration needed. */
const PANEL_IDS = ['virtues', 'status', 'background', 'load', 'growth', 'party'];

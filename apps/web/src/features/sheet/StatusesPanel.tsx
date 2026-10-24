import { lazy, Suspense, useState } from 'react';
import type { CharacterSheet, Clock, Library, Party, RollTier, StatusSeverity } from '@asohav/shared';
import {
  applyRecuperateEffect,
  applyStrainToSheet,
  clearDyingState,
  freeStatusSlots,
  canRecoverStatuses,
  isHeroOut,
  newId,
  refreshPartyTags,
  secondStrainOpen,
  statusSeverityCounts,
  strainTrackLength,
  takeStatus,
} from '@asohav/shared';
import type { DeathActions } from '../../lib/mutations.js';
import { Panel, PanelHeader, PlayLockedNote, StaticTags, sheetWriter, type SheetWriteProps } from './Panel.js';
import { StatusBoxes } from './StatusBoxes.js';
import { Pips } from './Pips.js';
import { ArmorSection } from './ArmorSection.js';
import { MakeCampModal } from './MakeCampModal.js';
import type { TakenStatus } from './TakeStrainModal.js';
import type { CampAdvanceContext } from './CampAdvanceSteps.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { InlineEdit } from '../../components/InlineEdit.js';
import { TagList } from '../../components/TagList.js';
import styles from './StatusesPanel.module.css';

// Lazy since the revised V0.6 slice 1 mounted the whole Hero Roll builder inside it: it opens only
// when Strain arrives, and the sheet's first load is what the bundle budget measures.
const TakeStrainModal = lazy(() => import('./TakeStrainModal.js').then((m) => ({ default: m.TakeStrainModal })));
// Lazy for the same reason (revised V0.6, slices 2 and 6): it opens only on Recuperate, and it grew
// a Drama gain and Combat's clear-a-Condition option. Combat imports it eagerly, but Combat is
// itself a lazy route chunk.
const CampAdvanceSteps = lazy(() => import('./CampAdvanceSteps.js').then((m) => ({ default: m.CampAdvanceSteps })));
const DyingNotices = lazy(() => import('./DyingNotices.js').then((m) => ({ default: m.DyingNotices })));
const RecuperateModal = lazy(() => import('./RecuperateModal.js').then((m) => ({ default: m.RecuperateModal })));

const SEVERITIES: StatusSeverity[] = ['Minor', 'Major', 'Severe'];
const SEVERITY_COLOR: Record<StatusSeverity, string> = { Minor: 'var(--ink-text-muted)', Major: 'var(--danger)', Severe: 'var(--danger)' };

/** V0.6 slice 1's rebuild of this panel — the single biggest UI change in the migration (see
 *  `WorkPlan-V0.6.md` Section E). The three polarity groups (Positive/Neutral/Negative, each an
 *  unbounded list of ranked-box rows) become three fixed severity groups (Minor/Major/Severe,
 *  each a bounded number of slots — `GameSettings.MinorStatusSlots` etc.); the resource row loses
 *  Recoveries and gains a Strain track (`StatusBoxes`, repurposed — its sparse box-row geometry
 *  is exactly the Strain track's own shape) and a Healing Track (`Pips`, a genuine cumulative
 *  clock, unlike a Status row); Boons/Banes are new, freeform tag lists (`TagList`, the same
 *  primitive Looks/Skill Tags/Flaw Tags already use). `GiveStatusModal`/`HealStatusModal` become
 *  `TakeStrainModal`/`RecuperateModal`; `SubduedModal`'s three-way Scar/Risk Death/Blaze of Glory
 *  choice retired in V0.6. V0.7 slice 8a replaces a Hero's Subdued with **Dying** (`sheet.Dying`,
 *  set when a Strain hit has nothing left to absorb it): a standing banner here, Speed 0, and
 *  Recuperate / Status removal disabled. Slice 8b adds the non-blocking Dying-choice prompt
 *  (`DyingChoiceModal`, through `death`), the second Strain row it unlocks, Scar removal, and the
 *  Dead / Retired banner that makes the whole panel read-only.
 *
 *  Nearly everything here changes only in play — Strain, the Healing Track, Statuses, Boons and
 *  Banes, Wealth, Treasure, Hold, Armor, Make Camp — so `playLocked` disables it all behind one
 *  PlayLockedNote, with Statuses and Boons/Banes shown as plain text and their add controls
 *  disabled. `readOnly` (the GM's peek) goes further and drops every control. */
export function StatusesPanel(props: {
  sheet: CharacterSheet;
  library: Library;
  /** Opens the Hold spend modal, which CharacterSheetPage owns — it needs the Bond list and
   *  the propose callback, neither of which this panel has. The trigger lives here because
   *  this is where the number is shown. Optional so the panel still renders standalone. */
  onSpendHold?: () => void;
  /** Make Camp hook to refresh Party Tags on camp. Optional so the panel still renders
   *  standalone. Revised V0.6, slice 4: refreshes the Party's used tags list. */
  commitParty?: (m: (d: Party) => void) => void;
  /** What the Make Camp advance steps need beyond `commitParty` (V0.7; owner rulings D4/D7): the party
   *  row, this campaign's Bonds and a way to propose a Forge. Omitted where there is no such context. */
  campAdvance?: Omit<CampAdvanceContext, 'commitParty'>;
  playLocked?: boolean;
  /** The Dying choice and Scar removal for this Hero (V0.7 slice 8b). Given to the Hero's own player
   *  and to the GM's peek; omitted on an archived campaign. */
  death?: DeathActions;
  /** The campaign's Clocks, for a Dead Hero's Resurrection Clock (V0.7 slice 8c). */
  clocks?: Clock[];
  /** The Hero's name, for the Dying-choice dialog. */
  heroName?: string;
} & SheetWriteProps) {
  const { sheet, library, onSpendHold, commitParty, campAdvance, death } = props;
  /** A Dead or Retired Hero's sheet is read-only (V0.7 slice 8b), by the same lock as before play. */
  const ended = isHeroOut(sheet);
  const playLockedBeforePlay = props.playLocked === true;
  const playLocked = playLockedBeforePlay || ended;
  const readOnly = props.readOnly === true;
  const commit = sheetWriter(props);
  /** Statuses and Boons/Banes render as text rather than editors whenever they can't be edited. */
  const locked = readOnly || playLocked;
  const [confirmingCamp, setConfirmingCamp] = useState(false);
  const [takingStrain, setTakingStrain] = useState(false);
  const [recuperating, setRecuperating] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const heroName = props.heroName ?? 'This Hero';
  const [removingScar, setRemovingScar] = useState<{ id: string; text: string } | null>(null);
  /** The Status just added via an empty slot's "+ Add" — opens straight into its own name editor,
   *  same one-tap convention `TagList` already established for a freshly appended tag. */
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const mettleScore = sheet.Virtues.find((v) => v.VirtueId === 'v-mettle')?.Score ?? 0;
  const slotCaps: Record<StatusSeverity, number> = {
    Minor: library.settings.MinorStatusSlots,
    Major: library.settings.MajorStatusSlots,
    Severe: library.settings.SevereStatusSlots,
  };
  const counts = statusSeverityCounts(sheet.Statuses);
  const freeSlots: Record<StatusSeverity, boolean> = {
    Minor: counts.Minor < slotCaps.Minor,
    Major: counts.Major < slotCaps.Major,
    Severe: counts.Severe < slotCaps.Severe,
  };
  const freeSlotCounts = freeStatusSlots(sheet.Statuses, slotCaps);
  const tempStrain = sheet.TempStrain ?? 0;
  const dying = sheet.Dying === true && !ended;
  const secondOpen = secondStrainOpen(sheet) && !ended;
  const canRecover = canRecoverStatuses(sheet);

  const markedConditions = sheet.Virtues
    .filter((v) => v.ConditionMarked)
    .map((v) => ({ virtueId: v.VirtueId, name: library.conditions.find((c) => c.VirtueId === v.VirtueId)?.Name ?? v.VirtueId }));

  function makeCamp(clearedVirtueId: string | null) {
    commit((d) => {
      d.Armor.forEach((a) => { a.Used = false; });
      // V0.7 slice 7: "All Temporary Strain boxes are removed when you Make Camp."
      d.TempStrain = 0;
      d.Load.LatchedUntilCamp = false;
      // Slice 5: ordinary wildcard Load declarations return to the ether at Camp; a
      // named/magical/plot-relevant one (Persistent) keeps permanently consuming its box.
      d.WildcardDeclarations = d.WildcardDeclarations.filter((w) => w.Persistent);
      if (clearedVirtueId) {
        const v = d.Virtues.find((x) => x.VirtueId === clearedVirtueId);
        if (v) v.ConditionMarked = false;
      }
      // Make Camp starts a new set of Camp Actions (slice 8).
      d.CampActionsUsed = 0;
    });
    // V0.6 slice 4: refresh Party Tags at Make Camp (those that were used become available again).
    if (commitParty) {
      commitParty((d) => refreshPartyTags(d));
    }
    setConfirmingCamp(false);
  }

  function adjustWealth(delta: number) {
    commit((d) => { d.Wealth = Math.max(0, (d.Wealth ?? 0) + delta); });
  }

  function adjustTreasure(delta: number) {
    commit((d) => { d.Treasure = Math.max(0, (d.Treasure ?? 0) + delta); });
  }

  function toggleStrainBox(boxIndex: number) {
    commit((d) => {
      const next = [...d.Strain];
      next[boxIndex - 1] = !next[boxIndex - 1];
      d.Strain = next;
    });
  }

  function setHealingTrack(n: number) {
    commit((d) => { d.HealingTrack = Math.max(0, Math.min(library.settings.HealingTrackLength, n)); });
  }

  function setTempStrain(n: number) {
    commit((d) => { d.TempStrain = Math.max(0, Math.min(99, Math.floor(n))); });
  }

  function applyTakeStrain(finalStrain: number, takenStatuses: TakenStatus[], armorId: string | null) {
    commit((d) => {
      // Several Statuses may be taken at once (V0.7 L531), each in its own slot.
      for (const t of takenStatuses) d.Statuses = takeStatus(d.Statuses, t);
      if (armorId) {
        const armor = d.Armor.find((a) => a.Id === armorId);
        if (armor) armor.Used = true;
      }
      // Dying is an event: a hit with nothing left to take it, even with lower boxes still free. A
      // Temporary Strain box is spent first and takes the whole hit; once the Dying choice is recorded
      // a second mark can take it, and past that the Hero dies (`applyStrainToSheet`).
      applyStrainToSheet(d, finalStrain, strainTrackLength(d, library.settings));
    });
    setTakingStrain(false);
  }

  /** The manual clear (V0.7 is silent on how Dying ends outside Risk Death 10+). */
  function clearDying() {
    commit((d) => { clearDyingState(d); });
  }

  function toggleSecondBox(boxIndex: number) {
    commit((d) => {
      const next = [...d.StrainSecond];
      next[boxIndex - 1] = !next[boxIndex - 1];
      d.StrainSecond = next;
    });
  }

  function applyRecuperate(removeStatusId: string | null, tier: RollTier) {
    commit((d) => {
      const result = applyRecuperateEffect(d, removeStatusId, tier, slotCaps, library.settings);
      d.Strain = result.Strain;
      d.Statuses = result.Statuses;
      d.HealingTrack = result.HealingTrack;
    });
    setRecuperating(false);
  }

  function addStatus(severity: StatusSeverity) {
    const id = newId('st');
    commit((d) => { d.Statuses = [...d.Statuses, { Id: id, Severity: severity, Name: '', Description: '' }]; });
    setJustAddedId(id);
  }
  function renameStatus(id: string, name: string) {
    setJustAddedId(null);
    commit((d) => { const s = d.Statuses.find((x) => x.Id === id); if (s) s.Name = name; });
  }
  function describeStatus(id: string, description: string) {
    commit((d) => { const s = d.Statuses.find((x) => x.Id === id); if (s) s.Description = description; });
  }
  function removeStatus(id: string) {
    commit((d) => { d.Statuses = d.Statuses.filter((x) => x.Id !== id); });
  }

  const minorStatuses = sheet.Statuses.filter((s) => s.Severity === 'Minor');

  return (
    <Panel id="p-status" collapseId="status" localCollapse={readOnly} primary grain>
      <PanelHeader
        extra={
          readOnly ? undefined : (
            <button className={`tap ${styles.camp}`} disabled={playLocked} onClick={() => setConfirmingCamp(true)}>
              Make Camp
            </button>
          )
        }
      >
        Statuses
      </PanelHeader>
      <p className={styles.intro}>
        {'Strain clears at the end of a scene or Combat; Temporary Strain at Make Camp. A Status penalizes any relevant roll by severity — Minor −1, Major Disadvantage, Severe roll 1d6 — until it heals.'}
      </p>

      {(dying || ended) && (
        <Suspense fallback={null}>
          <DyingNotices sheet={sheet} heroName={heroName} readOnly={readOnly} playLocked={playLocked} death={death} clocks={props.clocks} onClearDying={clearDying} />
        </Suspense>
      )}

      {playLockedBeforePlay && !readOnly && <PlayLockedNote />}

      {!readOnly && (
        <div className={`action-grid ${styles.actionRow}`}>
          <button className={`tap-inline ${styles.actionButton}`} disabled={playLocked} onClick={() => setTakingStrain(true)}>
            Take Strain&hellip;
          </button>
          <button className={`tap-inline ${styles.actionButton}`} disabled={playLocked || !canRecover} title={canRecover ? undefined : 'A Dying Hero can’t take Recuperate'} onClick={() => setRecuperating(true)}>
            Recuperate&hellip;
          </button>
        </div>
      )}

      <div className={`action-grid ${styles.resourceRow}`}>
        <div className={styles.resource}>
          <span className={styles.resourceLabel}>Wealth</span>
          {readOnly ? (
            <span className={styles.resourceValue}>{sheet.Wealth ?? 0}</span>
          ) : (
            <div className={styles.stepper}>
              <button className={`tap-inline ${styles.step}`} disabled={playLocked} onClick={() => adjustWealth(-1)} aria-label="Decrease Wealth">&minus;</button>
              <span className={styles.resourceValue}>{sheet.Wealth ?? 0}</span>
              <button className={`tap-inline ${styles.step}`} disabled={playLocked} onClick={() => adjustWealth(1)} aria-label="Increase Wealth">+</button>
            </div>
          )}
        </div>
        <div className={styles.resource}>
          <span className={styles.resourceLabel}>Treasure</span>
          {readOnly ? (
            <span className={styles.resourceValue}>{sheet.Treasure ?? 0}</span>
          ) : (
            <div className={styles.stepper}>
              <button className={`tap-inline ${styles.step}`} disabled={playLocked} onClick={() => adjustTreasure(-1)} aria-label="Decrease Treasure">&minus;</button>
              <span className={styles.resourceValue}>{sheet.Treasure ?? 0}</span>
              <button className={`tap-inline ${styles.step}`} disabled={playLocked} onClick={() => adjustTreasure(1)} aria-label="Increase Treasure">+</button>
            </div>
          )}
        </div>
        <div className={styles.resource}>
          <span className={styles.resourceLabel}>Hold</span>
          {onSpendHold && !readOnly ? (
            <button
              className={`tap-inline ${styles.resourceReadout} ${styles.holdSpend}`}
              disabled={playLocked}
              onClick={onSpendHold}
              aria-label={`Spend Hold — you have ${sheet.Hold ?? 0}`}
            >
              {sheet.Hold ?? 0}
            </button>
          ) : (
            <span className={styles.resourceReadout}>{sheet.Hold ?? 0}</span>
          )}
        </div>
      </div>

      <ArmorSection sheet={sheet} library={library} commit={commit} readOnly={readOnly} playLocked={playLocked} />

      <div className={styles.trackSection}>
        <div className={styles.groupLabel}>Strain</div>
        <StatusBoxes marks={sheet.Strain} color="var(--danger)" onToggle={toggleStrainBox} label="Strain" disabled={playLocked} readOnly={readOnly} />
      </div>

      {(secondOpen || sheet.StrainSecond.some(Boolean)) && (
        <div className={styles.trackSection}>
          <div className={styles.groupLabel}>Second Strain</div>
          <StatusBoxes marks={sheet.StrainSecond} color="var(--danger)" onToggle={toggleSecondBox} label="Second Strain" disabled={playLocked || !secondOpen} readOnly={readOnly} />
          <span className={styles.tempHelp}>A second mark in each box, open while Dying after a choice. A hit with no higher box here either kills.</span>
        </div>
      )}

      {(!readOnly || tempStrain > 0) && (
        <div className={styles.trackSection}>
          <div className={styles.groupLabel}>Temporary Strain</div>
          <div className={styles.tempRow}>
            {readOnly ? (
              <span className={styles.resourceValue}>{tempStrain}</span>
            ) : (
              <div className={styles.stepper}>
                <button className={`tap-inline ${styles.step}`} disabled={playLocked || tempStrain <= 0} onClick={() => setTempStrain(tempStrain - 1)} aria-label="Remove a Temporary Strain box">&minus;</button>
                <span className={styles.resourceValue} aria-live="polite">{tempStrain}</span>
                <button className={`tap-inline ${styles.step}`} disabled={playLocked} onClick={() => setTempStrain(tempStrain + 1)} aria-label="Add a Temporary Strain box">+</button>
              </div>
            )}
            <span className={styles.tempHelp}>Extra boxes marked first, one per hit; each disappears once checked. All removed at Make Camp.</span>
          </div>
        </div>
      )}

      <div className={styles.trackSection}>
        <div className={styles.groupLabel}>Healing Track — {sheet.HealingTrack} / {library.settings.HealingTrackLength}</div>
        <Pips
          count={library.settings.HealingTrackLength}
          filled={sheet.HealingTrack}
          color="var(--positive)"
          onSet={setHealingTrack}
          label="Healing Track"
          disabled={playLocked}
          readOnly={readOnly}
        />
      </div>

      {/* Severity groups as columns once genuinely wide, same auto-fit "distributing peers" rule
          the old Positive/Neutral/Negative columns used (CLAUDE.md). A full group still renders
          its board; an empty one shows a muted "None" line so a column never collapses to just a
          label mid-grid. */}
      <div className={styles.statusGroups}>
        {SEVERITIES.map((sev) => (
          <div key={sev} className={styles.statusGroup}>
            <div className={styles.groupLabel} style={{ color: SEVERITY_COLOR[sev] }}>
              {sev} ({counts[sev]} / {slotCaps[sev]})
            </div>
            <div className="board">
              {/* The read-only peek has no "+ Add" slot to fill an empty group, so it says None. */}
              {sheet.Statuses.filter((s) => s.Severity === sev).length === 0 && (readOnly || !freeSlots[sev]) && (
                <div className={styles.emptyGroup}>None</div>
              )}
              {sheet.Statuses
                .filter((s) => s.Severity === sev)
                .map((s) =>
                  locked ? (
                    <div key={s.Id} className={`posting ${styles.row}`}>
                      <div className={styles.rowHead}>
                        <span className={`${styles.name} ${s.Name ? '' : styles.unnamed}`}>{s.Name || 'Unnamed Status'}</span>
                      </div>
                      {s.Description && <span className={styles.description}>{s.Description}</span>}
                    </div>
                  ) : (
                    <div key={s.Id} className={`posting ${styles.row}`}>
                      <div className={styles.rowHead}>
                        <InlineEdit
                          className={styles.name}
                          value={s.Name}
                          placeholder="Name this Status…"
                          ariaLabel="Status name"
                          startEditing={s.Id === justAddedId}
                          onCommit={(next) => renameStatus(s.Id, next)}
                        />
                        <button
                          className={`tap-inline ${styles.remove}`}
                          disabled={!canRecover}
                          onClick={() => setRemoving({ id: s.Id, name: s.Name || 'this Status' })}
                          title={canRecover ? 'Remove status' : 'A Dying Hero can’t recover Statuses'}
                          aria-label={`Remove status: ${s.Name || 'unnamed'}`}
                        >
                          &times;
                        </button>
                      </div>
                      <InlineEdit
                        className={styles.description}
                        value={s.Description}
                        placeholder="Lasting effect — what happened, and how it shows."
                        ariaLabel="Status description"
                        onCommit={(next) => describeStatus(s.Id, next)}
                      />
                    </div>
                  ),
                )}
              {freeSlots[sev] && !readOnly && (
                <button type="button" className={`tap-inline ${styles.addSlot}`} disabled={playLocked} onClick={() => addStatus(sev)}>
                  + Add {sev} Status
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.boonsBanesRow}>
        <div className={styles.boonsBanesCol}>
          <div className={styles.groupLabel}>Boons</div>
          {locked ? (
            <StaticTags
              items={sheet.Boons}
              boardClassName="board"
              chipClassName="posting tilt"
              emptyText="None"
              lockedAddLabel={readOnly ? undefined : '+ Add Boon'}
            />
          ) : (
            <TagList
              items={sheet.Boons}
              onChange={(next) => commit((d) => { d.Boons = next; })}
              addLabel="+ Add Boon"
              placeholder="Alert, blessed, hidden…"
              ariaPrefix="Boon"
              boardClassName="board"
              chipClassName="posting tilt"
              emptyText="None"
            />
          )}
        </div>
        <div className={styles.boonsBanesCol}>
          <div className={styles.groupLabel}>Banes</div>
          {locked ? (
            <StaticTags
              items={sheet.Banes}
              boardClassName="board"
              chipClassName="posting tilt"
              emptyText="None"
              lockedAddLabel={readOnly ? undefined : '+ Add Bane'}
            />
          ) : (
            <TagList
              items={sheet.Banes}
              onChange={(next) => commit((d) => { d.Banes = next; })}
              addLabel="+ Add Bane"
              placeholder="Intoxicated, exposed, surprised…"
              ariaPrefix="Bane"
              boardClassName="board"
              chipClassName="posting tilt"
              emptyText="None"
            />
          )}
        </div>
      </div>

      {(sheet.Scars ?? []).length > 0 && (
        <div className={styles.scars}>
          <div className={styles.groupLabel}>Scars</div>
          {(sheet.Scars ?? []).map((s) => (
            <div key={s.Id} className={styles.scar}>
              <span>{s.Text}</span>
              {death && !ended && (
                <button type="button" className={`tap-inline ${styles.remove}`} onClick={() => setRemovingScar({ id: s.Id, text: s.Text })} aria-label={`Remove Scar: ${s.Text}`}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmingCamp && (
        <MakeCampModal
          markedConditions={markedConditions}
          advances={
            campAdvance && !readOnly ? (
              <Suspense fallback={null}>
                <CampAdvanceSteps sheet={sheet} commitSheet={commit} ctx={{ ...campAdvance, commitParty }} />
              </Suspense>
            ) : undefined
          }
          onApply={makeCamp}
          onClose={() => setConfirmingCamp(false)}
        />
      )}

      <Suspense fallback={null}>
        {takingStrain && (
          <TakeStrainModal
            sheet={sheet}
            library={library}
            commit={commit}
            freeSlots={freeSlotCounts}
            onApply={applyTakeStrain}
            onClose={() => setTakingStrain(false)}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {recuperating && (
          <RecuperateModal
            minorStatuses={minorStatuses}
            mettleScore={mettleScore}
            onApply={applyRecuperate}
            onClose={() => setRecuperating(false)}
          />
        )}
      </Suspense>

      {removingScar && death && (
        <ConfirmModal
          title="Remove this Scar?"
          body={`"${removingScar.text}" will be removed from this Hero. Use this when the table agrees the Scar has been reversed.`}
          confirmLabel="Remove"
          onConfirm={() => { void death.removeScar(removingScar.id); setRemovingScar(null); }}
          onCancel={() => setRemovingScar(null)}
        />
      )}

      {removing && (
        <ConfirmModal
          title="Remove this Status?"
          body={`${removing.name} will be removed from this sheet.`}
          confirmLabel="Remove"
          onConfirm={() => { removeStatus(removing.id); setRemoving(null); }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </Panel>
  );
}

import { useState } from 'react';
import type { CharacterSheet, Library, RollTier, StatusSeverity } from '@asohav/shared';
import {
  applyRecuperateEffect,
  isSubdued,
  markStrain,
  newId,
  statusSeverityCounts,
  takeStatus,
} from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { StatusBoxes } from './StatusBoxes.js';
import { Pips } from './Pips.js';
import { ArmorSection } from './ArmorSection.js';
import { TakeStrainModal } from './TakeStrainModal.js';
import { RecuperateModal } from './RecuperateModal.js';
import { MakeCampModal } from './MakeCampModal.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { InlineEdit } from '../../components/InlineEdit.js';
import { TagList } from '../../components/TagList.js';
import styles from './StatusesPanel.module.css';

const SEVERITIES: StatusSeverity[] = ['Minor', 'Major', 'Severe'];
const SEVERITY_COLOR: Record<StatusSeverity, string> = { Minor: 'var(--ink-55)', Major: 'var(--danger)', Severe: 'var(--danger)' };

/** V0.6 slice 1's rebuild of this panel — the single biggest UI change in the migration (see
 *  `WorkPlan-V0.6.md` Section E). The three polarity groups (Positive/Neutral/Negative, each an
 *  unbounded list of ranked-box rows) become three fixed severity groups (Minor/Major/Severe,
 *  each a bounded number of slots — `GameSettings.MinorStatusSlots` etc.); the resource row loses
 *  Recoveries and gains a Strain track (`StatusBoxes`, repurposed — its sparse box-row geometry
 *  is exactly the Strain track's own shape) and a Healing Track (`Pips`, a genuine cumulative
 *  clock, unlike a Status row); Boons/Banes are new, freeform tag lists (`TagList`, the same
 *  primitive Looks/Skill Tags/Flaw Tags already use). `GiveStatusModal`/`HealStatusModal` become
 *  `TakeStrainModal`/`RecuperateModal`; `SubduedModal`'s three-way Scar/Risk Death/Blaze of Glory
 *  choice retires from the trigger path entirely (V0.6 deletes the whole "Limits, Scars, & Death"
 *  section) — Subdued is now a derived, informational badge (`isSubdued`), not a modal. */
export function StatusesPanel({
  sheet,
  library,
  commit,
  onSpendHold,
}: {
  sheet: CharacterSheet;
  library: Library;
  commit: (m: (d: CharacterSheet) => void) => void;
  /** Opens the Hold spend modal, which CharacterSheetPage owns — it needs the Bond list and
   *  the propose callback, neither of which this panel has. The trigger lives here because
   *  this is where the number is shown. Optional so the panel still renders standalone. */
  onSpendHold?: () => void;
}) {
  const [confirmingCamp, setConfirmingCamp] = useState(false);
  const [takingStrain, setTakingStrain] = useState(false);
  const [recuperating, setRecuperating] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
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
  const subdued = isSubdued(sheet.Strain, sheet.Statuses, slotCaps);

  const markedConditions = sheet.Virtues
    .filter((v) => v.ConditionMarked)
    .map((v) => ({ virtueId: v.VirtueId, name: library.conditions.find((c) => c.VirtueId === v.VirtueId)?.Name ?? v.VirtueId }));

  function makeCamp(clearedVirtueId: string | null) {
    commit((d) => {
      d.Armor.forEach((a) => { a.Used = false; });
      d.Load.LatchedUntilCamp = false;
      // Slice 5: ordinary wildcard Load declarations return to the ether at Camp; a
      // named/magical/plot-relevant one (Persistent) keeps permanently consuming its box.
      d.WildcardDeclarations = d.WildcardDeclarations.filter((w) => w.Persistent);
      if (clearedVirtueId) {
        const v = d.Virtues.find((x) => x.VirtueId === clearedVirtueId);
        if (v) v.ConditionMarked = false;
      }
    });
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

  function applyTakeStrain(finalStrain: number, takenStatus: { Severity: StatusSeverity; Name: string; Description: string } | null) {
    commit((d) => {
      if (takenStatus) d.Statuses = takeStatus(d.Statuses, takenStatus);
      if (finalStrain > 0) d.Strain = markStrain(d.Strain, finalStrain, library.settings.StrainTrackLength);
    });
    setTakingStrain(false);
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
    <Panel id="p-status" collapseId="status" primary grain>
      <PanelHeader
        extra={
          <button className={`tap ${styles.camp}`} onClick={() => setConfirmingCamp(true)}>
            Make Camp
          </button>
        }
      >
        Statuses
      </PanelHeader>
      <p className={styles.intro}>
        {subdued
          ? 'Subdued — no Strain box free, and no Status slot open to absorb the rest. The table narrates what happens next.'
          : 'Strain clears at the end of a scene or Combat. A Status penalizes any relevant roll by severity — Minor −1, Major Disadvantage, Severe roll 1d6 — until it heals.'}
      </p>

      <div className={`action-grid ${styles.actionRow}`}>
        <button className={`tap-inline ${styles.actionButton}`} onClick={() => setTakingStrain(true)}>
          Take Strain&hellip;
        </button>
        <button className={`tap-inline ${styles.actionButton}`} onClick={() => setRecuperating(true)}>
          Recuperate&hellip;
        </button>
      </div>

      <div className={`action-grid ${styles.resourceRow}`}>
        <div className={styles.resource}>
          <span className={styles.resourceLabel}>Wealth</span>
          <div className={styles.stepper}>
            <button className={`tap-inline ${styles.step}`} onClick={() => adjustWealth(-1)} aria-label="Decrease Wealth">&minus;</button>
            <span className={styles.resourceValue}>{sheet.Wealth ?? 0}</span>
            <button className={`tap-inline ${styles.step}`} onClick={() => adjustWealth(1)} aria-label="Increase Wealth">+</button>
          </div>
        </div>
        <div className={styles.resource}>
          <span className={styles.resourceLabel}>Treasure</span>
          <div className={styles.stepper}>
            <button className={`tap-inline ${styles.step}`} onClick={() => adjustTreasure(-1)} aria-label="Decrease Treasure">&minus;</button>
            <span className={styles.resourceValue}>{sheet.Treasure ?? 0}</span>
            <button className={`tap-inline ${styles.step}`} onClick={() => adjustTreasure(1)} aria-label="Increase Treasure">+</button>
          </div>
        </div>
        <div className={styles.resource}>
          <span className={styles.resourceLabel}>Hold</span>
          {onSpendHold ? (
            <button
              className={`tap-inline ${styles.resourceReadout} ${styles.holdSpend}`}
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

      <ArmorSection sheet={sheet} library={library} commit={commit} />

      <div className={styles.trackSection}>
        <div className={styles.groupLabel}>Strain</div>
        <StatusBoxes marks={sheet.Strain} color="var(--danger)" onToggle={toggleStrainBox} />
      </div>

      <div className={styles.trackSection}>
        <div className={styles.groupLabel}>Healing Track — {sheet.HealingTrack} / {library.settings.HealingTrackLength}</div>
        <Pips count={library.settings.HealingTrackLength} filled={sheet.HealingTrack} color="var(--positive)" onSet={setHealingTrack} />
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
              {sheet.Statuses.filter((s) => s.Severity === sev).length === 0 && !freeSlots[sev] && (
                <div className={styles.emptyGroup}>None</div>
              )}
              {sheet.Statuses
                .filter((s) => s.Severity === sev)
                .map((s) => (
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
                        onClick={() => setRemoving({ id: s.Id, name: s.Name || 'this Status' })}
                        title="Remove status"
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
                ))}
              {freeSlots[sev] && (
                <button type="button" className={`tap-inline ${styles.addSlot}`} onClick={() => addStatus(sev)}>
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
        </div>
        <div className={styles.boonsBanesCol}>
          <div className={styles.groupLabel}>Banes</div>
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
        </div>
      </div>

      {(sheet.Scars ?? []).length > 0 && (
        <div className={styles.scars}>
          <div className={styles.groupLabel}>Scars</div>
          {(sheet.Scars ?? []).map((s) => (
            <div key={s.Id} className={styles.scar}>{s.Text}</div>
          ))}
        </div>
      )}

      {confirmingCamp && (
        <MakeCampModal
          markedConditions={markedConditions}
          onApply={makeCamp}
          onClose={() => setConfirmingCamp(false)}
        />
      )}

      {takingStrain && (
        <TakeStrainModal
          virtues={library.virtues}
          virtueValues={sheet.Virtues}
          freeSlots={freeSlots}
          onApply={applyTakeStrain}
          onClose={() => setTakingStrain(false)}
        />
      )}

      {recuperating && (
        <RecuperateModal
          minorStatuses={minorStatuses}
          mettleScore={mettleScore}
          onApply={applyRecuperate}
          onClose={() => setRecuperating(false)}
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

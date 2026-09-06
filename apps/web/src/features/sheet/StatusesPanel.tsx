import { useState } from 'react';
import type { CharacterSheet, Library, RiskDeathOutcome, StatusPolarity } from '@asohav/shared';
import {
  applyOpposingStatus,
  emptyMarks,
  giveStatus,
  healStatus,
  makeScar,
  markRank,
  newId,
  nowIso,
  reduceRank,
  resolveRiskDeath,
  spendRecovery,
  statusRank,
} from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { StatusBoxes } from './StatusBoxes.js';
import { ArmorSection } from './ArmorSection.js';
import { GiveStatusModal } from './GiveStatusModal.js';
import { HealStatusModal } from './HealStatusModal.js';
import { MakeCampModal } from './MakeCampModal.js';
import { SubduedModal } from './SubduedModal.js';
import { CrumbleModal } from './CrumbleModal.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import styles from './StatusesPanel.module.css';

export function StatusesPanel({
  sheet,
  library,
  commit,
}: {
  sheet: CharacterSheet;
  library: Library;
  commit: (m: (d: CharacterSheet) => void) => void;
}) {
  const [newName, setNewName] = useState('');
  const [newPolarity, setNewPolarity] = useState<StatusPolarity>('Neutral');
  // Raw text, not the clamped number, is what the input is controlled by — clamping the value
  // itself on every keystroke fights the user mid-edit (backspacing to clear the field snaps it
  // back to "1" before they can type a replacement digit, so the next digit lands on top of that
  // "1" instead of starting fresh). `newRank` is derived fresh each render for display/submit;
  // the box's own text is only ever normalized on blur.
  const [newRankText, setNewRankText] = useState('1');
  const [confirmingCamp, setConfirmingCamp] = useState(false);
  const [giving, setGiving] = useState(false);
  const [healing, setHealing] = useState(false);
  const [subdued, setSubdued] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  /** A Crumble that fired from this panel — today only by running out of Recoveries, which
   *  gives the Exhausted Condition with Might already marked. `VirtuesPanel` owns the
   *  table-declared case. */
  const [crumbling, setCrumbling] = useState(false);

  const mettleScore = sheet.Virtues.find((v) => v.VirtueId === 'v-mettle')?.Score ?? 0;
  const maxRank = library.settings.StatusMaxRank;
  /** The Virtue the Exhausted Condition hangs off — read from the library rather than
   *  hardcoding `'v-might'`, so retuning content can't silently break the Recoveries-0 rule. */
  const exhaustedVirtueId = library.conditions.find((c) => c.Id === 'c-exhausted')?.VirtueId ?? 'v-might';
  const parsedNewRank = parseInt(newRankText, 10);
  const newRank = Number.isFinite(parsedNewRank) ? Math.max(1, Math.min(maxRank, parsedNewRank)) : 1;

  function makeCamp(clearedVirtueIds: string[]) {
    commit((d) => {
      // Differential clear per the design doc ("2D6 Negative / 1D6 Positive"), simplified to a
      // flat -2/-1 like the rest of this app's no-dice-rolling engine. Neutral Statuses fall into
      // the -2 bucket here, same as Negative — left as-is deliberately: unlike the Subdued/
      // hindering/damage-tier fixes elsewhere in this pass, there's no doc text saying whether a
      // Neutral Status should fade like a wound, like a buff, or not at all at Camp. Flagging
      // rather than guessing; revisit if that's ever actually specified.
      d.Statuses.forEach((x) => { x.Marks = reduceRank(x.Marks, x.Polarity === 'Positive' ? 1 : 2); });
      d.Statuses = d.Statuses.filter((x) => statusRank(x) > 0);
      d.Armor.forEach((a) => { a.Used = false; });
      d.Load.LatchedUntilCamp = false;
      d.Recoveries = library.settings.RecoveriesMax;
      for (const virtueId of clearedVirtueIds) {
        const v = d.Virtues.find((x) => x.VirtueId === virtueId);
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

  const markedConditions = sheet.Virtues
    .filter((v) => v.ConditionMarked)
    .map((v) => ({ virtueId: v.VirtueId, name: library.conditions.find((c) => c.VirtueId === v.VirtueId)?.Name ?? v.VirtueId }));

  function applyGive(incoming: { Name: string; Polarity: StatusPolarity; Rank: number }, opposingId: string | null) {
    // Both paths return a StatusApplyResult now. Before `0.28.0` the opposing path returned a
    // bare array and was called without a cap, so a polarity flip could land past the Subdued
    // box and never run the Subdued flow — handled here the same as a plain give.
    const result = opposingId
      ? applyOpposingStatus(sheet.Statuses, incoming, opposingId, library.settings.StatusMaxRank)
      : giveStatus(sheet.Statuses, incoming, library.settings.StatusMaxRank);
    commit((d) => { d.Statuses = result.Statuses; });
    setGiving(false);
    if (result.Subdued) {
      const landed = result.Statuses.find((s) => s.Name.toLowerCase() === incoming.Name.toLowerCase() && s.Polarity === incoming.Polarity);
      if (landed) setSubdued({ id: landed.Id, name: landed.Name });
    }
  }

  function applyHeal(statusId: string, amount: number) {
    let crumbled = false;
    commit((d) => {
      d.Statuses = healStatus(d.Statuses, statusId, amount);
      // V0.5: spending your last Recovery gives you the Exhausted Condition — which, if Might is
      // already marked, is itself a Condition you can't mark, and so a Crumble.
      const outcome = spendRecovery(d, exhaustedVirtueId);
      crumbled = outcome.Crumbled;
    });
    setHealing(false);
    if (crumbled) setCrumbling(true);
  }

  /** Sets a Status to exactly `rank` — used by the Scar/Risk Death outcomes, which name a Rank
   *  rather than toggling boxes. Rebuilds the row from empty so the result is unambiguous. */
  function setStatusRank(statusId: string, rank: number) {
    commit((d) => {
      const s = d.Statuses.find((x) => x.Id === statusId);
      if (!s) return;
      if (rank <= 0) { d.Statuses = d.Statuses.filter((x) => x.Id !== statusId); }
      else { s.Marks = markRank(emptyMarks(maxRank), Math.min(rank, maxRank), maxRank); }
    });
  }

  function takeScar(text: string) {
    if (!subdued) return;
    commit((d) => {
      d.Scars.push(makeScar(text, nowIso()));
    });
    setStatusRank(subdued.id, library.settings.StatusMaxRank - 1);
    setSubdued(null);
  }

  function riskDeath(outcome: RiskDeathOutcome, scarText?: string) {
    if (!subdued) return;
    const result = resolveRiskDeath(outcome);
    if (scarText) {
      commit((d) => { d.Scars.push(makeScar(scarText, nowIso())); });
    }
    if (result.SubduingRankAfter !== null) {
      setStatusRank(subdued.id, result.SubduingRankAfter);
    }
    setSubdued(null);
  }

  const neg = sheet.Statuses.filter((s) => s.Polarity === 'Negative');
  const neutral = sheet.Statuses.filter((s) => s.Polarity === 'Neutral');
  const pos = sheet.Statuses.filter((s) => s.Polarity === 'Positive');

  /** Direct manual correction of one box. Toggling the last remaining mark clears the Status. */
  function toggleBox(id: string, boxIndex: number) {
    commit((d) => {
      const s = d.Statuses.find((x) => x.Id === id);
      if (!s) return;
      const next = [...s.Marks];
      next[boxIndex - 1] = !next[boxIndex - 1];
      s.Marks = next;
      if (statusRank(s) <= 0) d.Statuses = d.Statuses.filter((x) => x.Id !== id);
    });
  }
  function rename(id: string, name: string) {
    commit((d) => {
      const s = d.Statuses.find((x) => x.Id === id);
      if (s) s.Name = name;
    });
  }
  function remove(id: string) {
    commit((d) => { d.Statuses = d.Statuses.filter((x) => x.Id !== id); });
  }

  function row(s: (typeof sheet.Statuses)[number], color: string) {
    return (
      <div key={s.Id} className={`posting ${styles.row}`}>
        <div className={`tap-row ${styles.rowHead}`}>
          <input
            aria-label={`Status name: ${s.Name}`}
            className={`tap-inline text-lg wrap-anywhere ${styles.name}`}
            defaultValue={s.Name}
            onBlur={(e) => rename(s.Id, e.target.value)}
          />
          <div className={styles.pipsCell}>
            <StatusBoxes
              marks={s.Marks}
              color={color}
              subduedFrom={s.Polarity === 'Negative' ? maxRank : undefined}
              onToggle={(box) => toggleBox(s.Id, box)}
            />
          </div>
          {/* Polarity colour is data-driven, so it stays inline. */}
          <span className={styles.rank} style={{ color }}>{statusRank(s)}</span>
          <button
            className={`tap-inline ${styles.remove}`}
            onClick={() => setRemoving({ id: s.Id, name: s.Name })}
            title="Remove status"
            aria-label={`Remove status: ${s.Name}`}
          >
            &times;
          </button>
        </div>
      </div>
    );
  }

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
        Rank runs 1 to 5 normally — a Negative Status reaching 6 means Subdued, not just "more of the same." Tap a pip to set the rank; tap the filled pip again to drop it.
      </p>

      <div className={`action-grid ${styles.actionRow}`}>
        <button className={`tap-inline ${styles.actionButton}`} onClick={() => setGiving(true)}>
          Give a Status&hellip;
        </button>
        <button className={`tap-inline ${styles.actionButton}`} onClick={() => setHealing(true)}>
          Heal a Status&hellip;
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
          <span className={styles.resourceLabel}>Recoveries</span>
          <span className={styles.resourceReadout}>{sheet.Recoveries ?? 0} / {library.settings.RecoveriesMax}</span>
        </div>
        <div className={styles.resource}>
          <span className={styles.resourceLabel}>Hold</span>
          <span className={styles.resourceReadout}>{sheet.Hold ?? 0}</span>
        </div>
      </div>

      <ArmorSection sheet={sheet} library={library} commit={commit} />

      {/* Polarity groups as columns once genuinely wide (0.39.0 item 5) — each group is one grid
          cell (label + its own board), `auto-fit` distributing however many fit rather than a
          hand-picked breakpoint (CLAUDE.md's "distributing peers" rule). An empty group still
          renders its board with a muted "None" line so a column doesn't collapse to just a label
          mid-grid. */}
      <div className={styles.statusGroups}>
        <div className={styles.statusGroup}>
          <div className={`${styles.groupLabel} ${styles.groupPositive}`}>Positive</div>
          <div className={`board ${styles.groupBoard}`}>
            {pos.length > 0 ? pos.map((s) => row(s, 'var(--positive)')) : <div className={styles.emptyGroup}>None</div>}
          </div>
        </div>

        <div className={styles.statusGroup}>
          <div className={`${styles.groupLabel} ${styles.groupNeutral}`}>Neutral</div>
          <div className={`board ${styles.groupBoard}`}>
            {neutral.length > 0 ? neutral.map((s) => row(s, 'var(--ink-45)')) : <div className={styles.emptyGroup}>None</div>}
          </div>
        </div>

        <div className={styles.statusGroup}>
          <div className={`${styles.groupLabel} ${styles.groupNegative}`}>Negative</div>
          <div className={`board ${styles.groupBoard}`}>
            {neg.length > 0 ? neg.map((s) => row(s, 'var(--danger)')) : <div className={styles.emptyGroup}>None</div>}
          </div>
        </div>
      </div>

      <div className={`tap-row ${styles.addRow}`}>
        <input
          className={`tap-inline ${styles.newName}`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New status name…"
        />
        {/* Grouped in its own wrapper so it can become a second row below the name on
            phones and fold back into the single 1024px+ row via `display: contents` —
            see the .addControls comment in StatusesPanel.module.css. */}
        <div className={styles.addControls}>
          <div className={styles.polarityField}>
            <label className={styles.polarityLabel} htmlFor="status-new-polarity">Polarity</label>
            <select id="status-new-polarity" className={`tap-inline ${styles.polarity}`} value={newPolarity} onChange={(e) => setNewPolarity(e.target.value as StatusPolarity)}>
              <option value="Neutral">Neutral</option>
              <option value="Positive">Positive</option>
              <option value="Negative">Negative</option>
            </select>
          </div>
          <div className={styles.rankField}>
            <label className={styles.rankLabel} htmlFor="status-new-rank">Rank</label>
            <input
              id="status-new-rank"
              className={`tap-inline ${styles.newRank}`}
              type="number"
              min={1}
              max={maxRank}
              value={newRankText}
              onChange={(e) => setNewRankText(e.target.value)}
              onBlur={() => setNewRankText(String(newRank))}
            />
          </div>
          <button
            className={`tap-inline ${styles.add}`}
            onClick={() => {
              const name = newName.trim();
              if (!name) return;
              commit((d) => { d.Statuses.push({ Id: newId('st'), Name: name, Marks: markRank(emptyMarks(maxRank), newRank, maxRank), Polarity: newPolarity, LinkedToIds: [], AffectedByIds: [] }); });
              setNewName('');
              setNewRankText('1');
            }}
          >
            Add
          </button>
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

      {giving && (
        <GiveStatusModal
          virtues={library.virtues}
          virtueValues={sheet.Virtues}
          existingStatuses={sheet.Statuses}
          maxRank={maxRank}
          onApply={applyGive}
          onClose={() => setGiving(false)}
        />
      )}

      {healing && (
        <HealStatusModal
          statuses={sheet.Statuses}
          mettleScore={mettleScore}
          recoveries={sheet.Recoveries ?? 0}
          onApply={applyHeal}
          onClose={() => setHealing(false)}
        />
      )}

      {crumbling && (
        <CrumbleModal
          sheet={sheet}
          library={library}
          reason="You spent your last Recovery, and the Exhausted Condition had nowhere to go."
          commit={commit}
          onClose={() => setCrumbling(false)}
        />
      )}

      {subdued && (
        <SubduedModal
          statusName={subdued.name}
          onTakeScar={takeScar}
          onRiskDeath={riskDeath}
          onBlazeOfGlory={() => setSubdued(null)}
          onClose={() => setSubdued(null)}
        />
      )}

      {removing && (
        <ConfirmModal
          title="Remove this Status?"
          body={`${removing.name} will be removed from this sheet.`}
          confirmLabel="Remove"
          onConfirm={() => { remove(removing.id); setRemoving(null); }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </Panel>
  );
}


import { useState } from 'react';
import type { CharacterSheet, Library, RiskDeathOutcome, StatusPolarity } from '@asohav/shared';
import { applyOpposingStatus, damageTier, giveStatus, healStatus, makeScar, negativeStatusRankTotal, newId, nowIso, resolveRiskDeath } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { Pips } from './Pips.js';
import { GiveStatusModal } from './GiveStatusModal.js';
import { HealStatusModal } from './HealStatusModal.js';
import { MakeCampModal } from './MakeCampModal.js';
import { SubduedModal } from './SubduedModal.js';
import styles from './StatusesPanel.module.css';

export function StatusesPanel({
  sheet,
  library,
  commit,
  onNotYet,
}: {
  sheet: CharacterSheet;
  library: Library;
  commit: (m: (d: CharacterSheet) => void) => void;
  onNotYet: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [newPolarity, setNewPolarity] = useState<StatusPolarity>('Negative');
  const [newRank, setNewRank] = useState(1);
  const [confirmingCamp, setConfirmingCamp] = useState(false);
  const [giving, setGiving] = useState(false);
  const [healing, setHealing] = useState(false);
  const [subdued, setSubdued] = useState<{ id: string; name: string } | null>(null);

  const mettleScore = sheet.Virtues.find((v) => v.VirtueId === 'v-mettle')?.Score ?? 0;

  function makeCamp(clearedVirtueIds: string[]) {
    commit((d) => {
      d.Statuses.forEach((x) => { x.Rank = Math.max(0, x.Rank - (x.Polarity === 'Positive' ? 1 : 2)); });
      d.Statuses = d.Statuses.filter((x) => x.Rank > 0);
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
    if (opposingId) {
      commit((d) => { d.Statuses = applyOpposingStatus(d.Statuses, incoming, opposingId); });
      setGiving(false);
      return;
    }
    const result = giveStatus(sheet.Statuses, incoming, library.settings.StatusMaxRank);
    commit((d) => { d.Statuses = result.Statuses; });
    setGiving(false);
    if (result.Subdued) {
      const landed = result.Statuses.find((s) => s.Name.toLowerCase() === incoming.Name.toLowerCase() && s.Polarity === incoming.Polarity);
      if (landed) setSubdued({ id: landed.Id, name: landed.Name });
    }
  }

  function applyHeal(statusId: string, amount: number) {
    commit((d) => {
      d.Statuses = healStatus(d.Statuses, statusId, amount);
      d.Recoveries = Math.max(0, (d.Recoveries ?? 0) - 1);
    });
    setHealing(false);
  }

  function setStatusRank(statusId: string, rank: number) {
    commit((d) => {
      const s = d.Statuses.find((x) => x.Id === statusId);
      if (!s) return;
      if (rank <= 0) { d.Statuses = d.Statuses.filter((x) => x.Id !== statusId); }
      else { s.Rank = rank; }
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

  const statTier = damageTier(negativeStatusRankTotal(sheet), 3);
  const neg = sheet.Statuses.filter((s) => s.Polarity !== 'Positive');
  const pos = sheet.Statuses.filter((s) => s.Polarity === 'Positive');

  function setRank(id: string, n: number) {
    commit((d) => {
      const s = d.Statuses.find((x) => x.Id === id);
      if (!s) return;
      s.Rank = n;
      if (n <= 0) d.Statuses = d.Statuses.filter((x) => x.Id !== id);
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
      <div key={s.Id} className={styles.row}>
        <div className={`tap-row ${styles.rowHead}`}>
          <input
            className={`tap-inline text-lg wrap-anywhere ${styles.name}`}
            defaultValue={s.Name}
            onBlur={(e) => rename(s.Id, e.target.value)}
          />
          <Pips count={6} filled={s.Rank} color={color} onSet={(n) => setRank(s.Id, n)} />
          {/* Polarity colour is data-driven, so it stays inline. */}
          <span className={styles.rank} style={{ color }}>{s.Rank}</span>
          <button className={`tap-inline ${styles.remove}`} onClick={() => remove(s.Id)} title="Remove status">
            &times;
          </button>
        </div>
        <div className={`tap-row ${styles.links}`}>
          <button className={`tap-inline ${styles.inert}`} onClick={onNotYet}>Link to&hellip;</button>
          <button className={`tap-inline ${styles.inert}`} onClick={onNotYet}>Affected by&hellip;</button>
        </div>
      </div>
    );
  }

  return (
    <Panel id="p-status" collapseId="status" primary grain damageTier={statTier} damageVariant="statuses">
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

      <div className={`tap-row ${styles.actionRow}`}>
        <button className={`tap-inline ${styles.actionButton}`} onClick={() => setGiving(true)}>
          Give a Status&hellip;
        </button>
        <button className={`tap-inline ${styles.actionButton}`} onClick={() => setHealing(true)}>
          Heal a Status&hellip;
        </button>
        <span className={styles.recoveries}>Recoveries {sheet.Recoveries ?? 0} / {library.settings.RecoveriesMax}</span>
      </div>

      <div className={`tap-row ${styles.resourceRow}`}>
        <div className={styles.resource}>
          <button className={`tap-inline ${styles.step}`} onClick={() => adjustWealth(-1)} aria-label="Decrease Wealth">&minus;</button>
          <span className={styles.resourceLabel}>Wealth {sheet.Wealth ?? 0}</span>
          <button className={`tap-inline ${styles.step}`} onClick={() => adjustWealth(1)} aria-label="Increase Wealth">+</button>
        </div>
        <div className={styles.resource}>
          <button className={`tap-inline ${styles.step}`} onClick={() => adjustTreasure(-1)} aria-label="Decrease Treasure">&minus;</button>
          <span className={styles.resourceLabel}>Treasure {sheet.Treasure ?? 0}</span>
          <button className={`tap-inline ${styles.step}`} onClick={() => adjustTreasure(1)} aria-label="Increase Treasure">+</button>
        </div>
      </div>

      <div className={`${styles.groupLabel} ${styles.groupNegative}`}>Negative</div>
      {neg.map((s) => row(s, 'var(--danger)'))}

      <div className={`${styles.groupLabel} ${styles.groupPositive}`}>Positive</div>
      {pos.map((s) => row(s, 'var(--gold)'))}

      <div className={`tap-row ${styles.addRow}`}>
        <input
          className={styles.newName}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New status name…"
        />
        <select className={`tap-inline ${styles.polarity}`} value={newPolarity} onChange={(e) => setNewPolarity(e.target.value as StatusPolarity)}>
          <option value="Negative">Negative</option>
          <option value="Positive">Positive</option>
          <option value="Neutral">Neutral</option>
        </select>
        <input
          className={`tap-inline ${styles.newRank}`}
          type="number"
          min={1}
          max={library.settings.StatusMaxRank}
          value={newRank}
          onChange={(e) => setNewRank(Math.max(1, Math.min(library.settings.StatusMaxRank, parseInt(e.target.value, 10) || 1)))}
          aria-label="New status rank"
        />
        <button
          className={`tap-inline ${styles.add}`}
          onClick={() => {
            const name = newName.trim();
            if (!name) return;
            commit((d) => { d.Statuses.push({ Id: newId('st'), Name: name, Rank: newRank, Polarity: newPolarity, LinkedToIds: [], AffectedByIds: [] }); });
            setNewName('');
            setNewRank(1);
          }}
        >
          Add
        </button>
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

      {subdued && (
        <SubduedModal
          statusName={subdued.name}
          onTakeScar={takeScar}
          onRiskDeath={riskDeath}
          onBlazeOfGlory={() => setSubdued(null)}
          onClose={() => setSubdued(null)}
        />
      )}
    </Panel>
  );
}


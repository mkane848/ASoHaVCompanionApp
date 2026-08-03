import { useState } from 'react';
import type { CharacterSheet, StatusPolarity } from '@asohav/shared';
import { damageTier, negativeStatusRankTotal, newId } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { Pips } from './Pips.js';
import styles from './StatusesPanel.module.css';

export function StatusesPanel({
  sheet,
  commit,
  onNotYet,
}: {
  sheet: CharacterSheet;
  commit: (m: (d: CharacterSheet) => void) => void;
  onNotYet: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [newPolarity, setNewPolarity] = useState<StatusPolarity>('Negative');

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
          <button
            className={`tap ${styles.camp}`}
            onClick={() =>
              commit((d) => {
                d.Statuses.forEach((x) => { x.Rank = Math.max(0, x.Rank - (x.Polarity === 'Positive' ? 1 : 2)); });
                d.Statuses = d.Statuses.filter((x) => x.Rank > 0);
                d.Armor.forEach((a) => { a.Used = false; });
                d.Load.LatchedUntilCamp = false;
              })
            }
          >
            Make Camp
          </button>
        }
      >
        Statuses
      </PanelHeader>
      <p className={styles.intro}>
        Rank runs 1 (mild) to 6 (deadly or transformative). Tap a pip to set the rank; tap the filled pip again to drop it.
      </p>

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
        <button
          className={`tap-inline ${styles.add}`}
          onClick={() => {
            const name = newName.trim();
            if (!name) return;
            commit((d) => { d.Statuses.push({ Id: newId('st'), Name: name, Rank: 1, Polarity: newPolarity, LinkedToIds: [], AffectedByIds: [] }); });
            setNewName('');
          }}
        >
          Add
        </button>
      </div>
    </Panel>
  );
}


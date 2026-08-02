import { useState } from 'react';
import type { CharacterSheet, StatusPolarity } from '@asohav/shared';
import { damageTier, negativeStatusRankTotal, newId } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { Pips } from './Pips.js';

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
      <div key={s.Id} style={{ padding: '11px 0', borderBottom: '1px solid var(--rule-soft)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <input
            className="tap-inline text-lg wrap-anywhere"
            defaultValue={s.Name}
            onBlur={(e) => rename(s.Id, e.target.value)}
            style={{ flex: 1, minWidth: 140, background: 'transparent', border: 'none', fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, padding: '2px 0', outline: 'none' }}
          />
          <Pips count={6} filled={s.Rank} color={color} onSet={(n) => setRank(s.Id, n)} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, minWidth: 20, textAlign: 'center', color }}>{s.Rank}</span>
          <button className="tap" onClick={() => remove(s.Id)} title="Remove status" style={{ background: 'transparent', border: 'none', color: 'var(--ink-35)', fontSize: 17, lineHeight: 1, padding: '2px 4px' }}>
            &times;
          </button>
        </div>
        <div className="tap-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
          <button className="tap-inline" onClick={onNotYet} style={inertBtn}>Link to&hellip;</button>
          <button className="tap-inline" onClick={onNotYet} style={inertBtn}>Affected by&hellip;</button>
        </div>
      </div>
    );
  }

  return (
    <Panel id="p-status" collapseId="status" primary grain damageTier={statTier} damageVariant="statuses">
      <PanelHeader
        extra={
          <button
            className="tap"
            onClick={() =>
              commit((d) => {
                d.Statuses.forEach((x) => { x.Rank = Math.max(0, x.Rank - (x.Polarity === 'Positive' ? 1 : 2)); });
                d.Statuses = d.Statuses.filter((x) => x.Rank > 0);
                d.Armor.forEach((a) => { a.Used = false; });
                d.Load.LatchedUntilCamp = false;
              })
            }
            style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--ink-28)', color: 'rgba(42,32,26,.7)', padding: '5px 10px' }}
          >
            Make Camp
          </button>
        }
      >
        Statuses
      </PanelHeader>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--ink-55)', fontStyle: 'italic' }}>
        Rank runs 1 (mild) to 6 (deadly or transformative). Tap a pip to set the rank; tap the filled pip again to drop it.
      </p>

      <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--danger)', margin: '0 0 6px' }}>Negative</div>
      {neg.map((s) => row(s, 'var(--danger)'))}

      <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold)', margin: '18px 0 6px' }}>Positive</div>
      {pos.map((s) => row(s, 'var(--gold)'))}

      <div className="tap-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rule)' }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New status name…"
          style={{ flex: 1, minWidth: 150, background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule-field)', fontSize: 13.5, padding: '5px 0', outline: 'none' }}
        />
        <select className="tap-inline" value={newPolarity} onChange={(e) => setNewPolarity(e.target.value as StatusPolarity)} style={{ background: 'transparent', border: '1px solid var(--rule-field)', fontSize: 12, padding: '5px 8px' }}>
          <option value="Negative">Negative</option>
          <option value="Positive">Positive</option>
          <option value="Neutral">Neutral</option>
        </select>
        <button
          className="tap-inline"
          onClick={() => {
            const name = newName.trim();
            if (!name) return;
            commit((d) => { d.Statuses.push({ Id: newId('st'), Name: name, Rank: 1, Polarity: newPolarity, LinkedToIds: [], AffectedByIds: [] }); });
            setNewName('');
          }}
          style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: '7px 14px' }}
        >
          Add
        </button>
      </div>
    </Panel>
  );
}

const inertBtn = {
  fontSize: 10,
  letterSpacing: '.08em',
  textTransform: 'uppercase' as const,
  background: 'transparent',
  border: '1px dashed var(--ink-25)',
  color: 'var(--ink-38)',
  padding: '3px 8px',
};

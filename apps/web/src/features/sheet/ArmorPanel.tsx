import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';

export function ArmorPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  return (
    <Panel>
      <PanelHeader
        extra={
          <button
            className="tap"
            onClick={() => commit((d) => { d.Armor.forEach((a) => { a.Used = false; }); })}
            style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--ink-28)', color: 'rgba(42,32,26,.7)', padding: '5px 10px' }}
          >
            Refresh all
          </button>
        }
      >
        Armor
      </PanelHeader>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--ink-55)', fontStyle: 'italic' }}>
        Any time you would take a Status, mark an appropriate box to negate it completely. Camp refreshes every box at once.
      </p>
      {sheet.Armor.map((a) => {
        const t = library.armorTypes.find((x) => x.Id === a.ArmorTypeId);
        return (
          <div key={a.Id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--rule-soft)' }}>
            <button
              className="tap"
              onClick={() => commit((d) => { const x = d.Armor.find((y) => y.Id === a.Id); if (x) x.Used = !x.Used; })}
              style={
                a.Used
                  ? { width: 30, height: 30, flex: 'none', padding: 0, fontSize: 15, lineHeight: 1, border: '1.5px solid var(--ink-28)', background: 'rgba(42,32,26,.07)', color: 'rgba(42,32,26,.55)' }
                  : { width: 30, height: 30, flex: 'none', padding: 0, fontSize: 15, lineHeight: 1, border: '1.5px solid var(--gold)', background: 'transparent', color: 'rgba(42,32,26,.55)' }
              }
            >
              {a.Used ? '×' : ''}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{t?.Name ?? a.ArmorTypeId}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-45)' }}>from {a.SourceLabel || '—'}</div>
            </div>
            <span style={{ fontSize: 10.5, letterSpacing: '.11em', textTransform: 'uppercase', color: a.Used ? 'var(--ink-38)' : 'var(--gold)' }}>{a.Used ? 'Spent' : 'Ready'}</span>
          </div>
        );
      })}
    </Panel>
  );
}

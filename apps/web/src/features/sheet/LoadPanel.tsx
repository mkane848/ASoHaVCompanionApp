import type { CharacterSheet, Library } from '@asohav/shared';
import { carriedLoad, loadCapacityFor } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { Pips } from './Pips.js';

export function LoadPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const might = sheet.Virtues.find((v) => v.VirtueId === 'v-might')?.Score ?? 0;
  const carried = carriedLoad(sheet, library.items);
  const cap = loadCapacityFor(sheet.Load.Tier, library.loadTiers, might);
  const over = carried > cap;
  const currentTierNote = library.loadTiers.find((t) => t.Key === sheet.Load.Tier)?.Note;

  return (
    <Panel id="p-load" primary>
      <PanelHeader>Load &amp; Item Charges</PanelHeader>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {library.loadTiers.map((t) => {
          const selected = sheet.Load.Tier === t.Key;
          return (
            <button
              key={t.Key}
              onClick={() => commit((d) => { d.Load.Tier = t.Key; })}
              style={{
                flex: 1,
                minWidth: 96,
                textAlign: 'center',
                padding: '10px 8px',
                border: selected ? '1px solid var(--gold)' : '1px solid var(--rule-field)',
                background: selected ? 'var(--gold-tint)' : 'transparent',
                color: selected ? 'var(--ink)' : 'var(--ink-55)',
              }}
            >
              <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>{t.Key}</span>
              <span style={{ display: 'block', fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t.Base + might}</span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'rgba(42,32,26,.7)', fontStyle: 'italic' }}>{currentTierNote}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>On your person</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: over ? 'var(--danger)' : 'var(--ink)' }}>
          {carried} of {cap}
        </span>
      </div>
      {over && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--danger)', borderLeft: '2px solid var(--danger-line)', paddingLeft: 10 }}>
          Over your chosen Load. The sheet won't stop you — but once you check your last Load box you can't use new items until you Make Camp.
        </p>
      )}
      <div style={{ height: 10 }} />
      {sheet.Items.map((ci) => {
        const it = library.items.find((x) => x.Id === ci.ItemId);
        if (!it) return null;
        const maxCharges = it.Charges ?? 0;
        return (
          <div key={ci.ItemId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--rule-soft)' }}>
            <button
              onClick={() => commit((d) => { const x = d.Items.find((y) => y.ItemId === ci.ItemId); if (x) x.Carried = !x.Carried; })}
              style={
                ci.Carried
                  ? { width: 26, height: 26, flex: 'none', padding: 0, fontSize: 14, lineHeight: 1, border: '1.5px solid var(--gold)', background: 'var(--gold-tint)', color: 'var(--gold-dark)' }
                  : { width: 26, height: 26, flex: 'none', padding: 0, fontSize: 14, lineHeight: 1, border: '1.5px solid var(--rule-field)', background: 'transparent', color: 'var(--gold-dark)' }
              }
            >
              {ci.Carried ? '✓' : ''}
            </button>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: ci.Carried ? undefined : 'var(--ink-45, rgba(42,32,26,.5))' }}>{it.Name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-45)' }}>{it.Description}</div>
            </div>
            {it.LoadCost === 0 ? (
              <span style={{ fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ink-35)' }}>concealed</span>
            ) : (
              <span style={{ fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ink-55)' }}>{it.LoadCost} load</span>
            )}
            {maxCharges > 0 && (
              <Pips
                count={maxCharges}
                filled={ci.ChargesUsed}
                color="var(--danger)"
                size={15}
                onSet={(n) => commit((d) => { const x = d.Items.find((y) => y.ItemId === ci.ItemId); if (x) x.ChargesUsed = n; })}
              />
            )}
          </div>
        );
      })}
    </Panel>
  );
}

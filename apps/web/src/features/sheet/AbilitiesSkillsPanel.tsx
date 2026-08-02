import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { effectChipLabel } from './sheetHelpers.js';

export function AbilitiesSkillsPanel({ sheet, library }: { sheet: CharacterSheet; library: Library }) {
  return (
    <Panel>
      <PanelHeader>Abilities &amp; Skills</PanelHeader>
      {sheet.AbilityIds.map((id) => {
        const a = library.abilities.find((x) => x.Id === id);
        if (!a) return null;
        return (
          <div key={id} style={{ padding: '10px 0', borderBottom: '1px solid var(--rule-soft)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>{a.Name}</div>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'rgba(42,32,26,.72)' }}>{a.RulesText}</p>
            {a.Effects.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                {a.Effects.map((e, i) => (
                  <span key={i} style={{ fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--gold-dark)', border: '1px solid var(--gold-line)', padding: '2px 7px' }}>
                    {effectChipLabel(e, library)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {sheet.SkillIds.map((id) => {
        const s = library.skills.find((x) => x.Id === id);
        if (!s) return null;
        return (
          <div key={id} style={{ padding: '10px 0', borderBottom: '1px solid var(--rule-soft)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>
              {s.Name} <span style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>Skill</span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'rgba(42,32,26,.72)' }}>{s.Effect}</p>
          </div>
        );
      })}
    </Panel>
  );
}

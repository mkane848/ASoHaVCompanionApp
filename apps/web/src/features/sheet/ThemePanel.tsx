import { nowIso } from '@asohav/shared';
import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';

export function ThemePanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const theme = library.themes.find((t) => t.Id === sheet.Theme.ThemeId);
  const startQ = theme ? library.quests.find((q) => q.Id === theme.StartingQuestId) : undefined;
  const takenIds = sheet.Theme.AcceptedQuests.map((q) => q.QuestId);
  const chosen = sheet.Theme.AcceptedQuests.filter((aq) => aq.QuestId !== theme?.StartingQuestId);
  const available = (theme?.QuestIds ?? []).filter((id) => !takenIds.includes(id) && id !== theme?.StartingQuestId);

  return (
    <Panel id="p-theme" primary>
      <PanelHeader>The Theme</PanelHeader>
      <select
        className="tap-inline text-lg"
        value={sheet.Theme.ThemeId}
        onChange={(e) => commit((d) => { d.Theme = { ThemeId: e.target.value, AcceptedQuests: [] }; })}
        style={{ width: '100%', background: 'transparent', border: '1px solid var(--rule-field)', fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, padding: '8px 10px', marginBottom: 10 }}
      >
        {library.themes.map((t) => (
          <option key={t.Id} value={t.Id}>{t.Name}</option>
        ))}
      </select>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, fontStyle: 'italic', color: 'rgba(42,32,26,.75)', borderLeft: '2px solid var(--gold-line)', paddingLeft: 12 }}>
        {theme?.Description}
      </p>

      <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-45)', marginBottom: 6 }}>Starting Quest</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginBottom: 2 }}>{startQ?.Name}</div>
      <p style={{ margin: '0 0 18px', fontSize: 12.5, color: 'rgba(42,32,26,.68)' }}>{startQ?.Description}</p>

      <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-45)', marginBottom: 6 }}>Chosen Quests</div>
      {chosen.map((aq) => {
        const q = library.quests.find((x) => x.Id === aq.QuestId);
        if (!q) return null;
        return (
          <div key={aq.QuestId} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--rule-soft)' }}>
            <button
              className="tap"
              onClick={() => commit((d) => { const x = d.Theme.AcceptedQuests.find((y) => y.QuestId === aq.QuestId); if (x) x.Completed = !x.Completed; })}
              style={
                aq.Completed
                  ? { width: 24, height: 24, flex: 'none', padding: 0, fontSize: 14, lineHeight: 1, border: '1.5px solid var(--gold)', background: 'var(--gold-tint)', color: 'var(--gold-dark)' }
                  : { width: 24, height: 24, flex: 'none', padding: 0, fontSize: 14, lineHeight: 1, border: '1.5px solid var(--ink-28)', background: 'transparent', color: 'var(--gold-dark)' }
              }
            >
              {aq.Completed ? '✓' : ''}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={aq.Completed ? { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, textDecoration: 'line-through', color: 'var(--ink-45)' } : { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>
                {q.Name}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'rgba(42,32,26,.65)' }}>{q.Description}</p>
            </div>
            <button
              className="tap"
              onClick={() => commit((d) => { d.Theme.AcceptedQuests = d.Theme.AcceptedQuests.filter((x) => x.QuestId !== aq.QuestId); })}
              title="Drop quest"
              style={{ background: 'transparent', border: 'none', color: 'var(--ink-32, rgba(42,32,26,.32))', fontSize: 17, lineHeight: 1, padding: '0 2px' }}
            >
              &times;
            </button>
          </div>
        );
      })}

      {available.length > 0 && (
        <div className="tap-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {available.map((id) => {
            const q = library.quests.find((x) => x.Id === id);
            if (!q) return null;
            return (
              <button
                key={id}
                className="tap-inline"
                onClick={() => commit((d) => { d.Theme.AcceptedQuests.push({ QuestId: id, Completed: false, AcceptedAt: nowIso() }); })}
                style={{ fontSize: 11.5, background: 'transparent', border: '1px dashed var(--gold-line)', color: 'var(--gold-dark)', padding: '6px 11px', textAlign: 'left' }}
              >
                + {q.Name}
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

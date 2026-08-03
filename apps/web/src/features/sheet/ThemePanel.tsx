import { nowIso } from '@asohav/shared';
import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import styles from './ThemePanel.module.css';

export function ThemePanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const theme = library.themes.find((t) => t.Id === sheet.Theme.ThemeId);
  const startQ = theme ? library.quests.find((q) => q.Id === theme.StartingQuestId) : undefined;
  const takenIds = sheet.Theme.AcceptedQuests.map((q) => q.QuestId);
  const chosen = sheet.Theme.AcceptedQuests.filter((aq) => aq.QuestId !== theme?.StartingQuestId);
  const available = (theme?.QuestIds ?? []).filter((id) => !takenIds.includes(id) && id !== theme?.StartingQuestId);

  return (
    <Panel id="p-theme" collapseId="theme" primary>
      <PanelHeader>The Theme</PanelHeader>
      <select
        className={`tap-inline text-lg ${styles.themeSelect}`}
        value={sheet.Theme.ThemeId}
        onChange={(e) => commit((d) => { d.Theme = { ThemeId: e.target.value, AcceptedQuests: [] }; })}
      >
        {library.themes.map((t) => (
          <option key={t.Id} value={t.Id}>{t.Name}</option>
        ))}
      </select>
      <p className={styles.description}>{theme?.Description}</p>

      <div className={styles.label}>Starting Quest</div>
      <div className={styles.startName}>{startQ?.Name}</div>
      <p className={styles.startText}>{startQ?.Description}</p>

      <div className={styles.label}>Chosen Quests</div>
      {chosen.map((aq) => {
        const q = library.quests.find((x) => x.Id === aq.QuestId);
        if (!q) return null;
        return (
          <div key={aq.QuestId} className={styles.questRow}>
            <button
              className={`tap ${styles.check} ${aq.Completed ? styles.checkDone : ''}`}
              onClick={() => commit((d) => { const x = d.Theme.AcceptedQuests.find((y) => y.QuestId === aq.QuestId); if (x) x.Completed = !x.Completed; })}
            >
              {aq.Completed ? '✓' : ''}
            </button>
            <div className={styles.questBody}>
              <div className={`${styles.questName} ${aq.Completed ? styles.questNameDone : ''}`}>{q.Name}</div>
              <p className={styles.questText}>{q.Description}</p>
            </div>
            <button
              className={`tap ${styles.drop}`}
              onClick={() => commit((d) => { d.Theme.AcceptedQuests = d.Theme.AcceptedQuests.filter((x) => x.QuestId !== aq.QuestId); })}
              title="Drop quest"
            >
              &times;
            </button>
          </div>
        );
      })}

      {available.length > 0 && (
        <div className={`tap-row ${styles.available}`}>
          {available.map((id) => {
            const q = library.quests.find((x) => x.Id === id);
            if (!q) return null;
            return (
              <button
                key={id}
                className={`tap-inline ${styles.chip}`}
                onClick={() => commit((d) => { d.Theme.AcceptedQuests.push({ QuestId: id, Completed: false, AcceptedAt: nowIso() }); })}
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

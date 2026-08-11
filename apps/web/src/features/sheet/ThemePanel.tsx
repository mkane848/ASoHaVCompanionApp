import { useState } from 'react';
import { nowIso } from '@asohav/shared';
import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import styles from './ThemePanel.module.css';

export function ThemePanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const matcher = useGlossaryMatcher();
  const [droppingQuest, setDroppingQuest] = useState<{ id: string; name: string } | null>(null);
  const theme = library.themes.find((t) => t.Id === sheet.Theme.ThemeId);
  const startQ = theme ? library.quests.find((q) => q.Id === theme.StartingQuestId) : undefined;
  const takenIds = sheet.Theme.AcceptedQuests.map((q) => q.QuestId);
  const chosen = sheet.Theme.AcceptedQuests.filter((aq) => aq.QuestId !== theme?.StartingQuestId);
  const available = (theme?.QuestIds ?? []).filter((id) => !takenIds.includes(id) && id !== theme?.StartingQuestId);

  return (
    <Panel id="p-theme" collapseId="theme" primary>
      <PanelHeader>The Theme</PanelHeader>
      <div className={`text-lg ${styles.themeName}`}>{theme?.Name}</div>
      <p className={styles.themeHint}>Themes are set at character selection — take the "Change your Theme" Advancement to retire it for another.</p>
      <p className={styles.description}>{theme?.Description && <GlossaryText text={theme.Description} matcher={matcher} />}</p>

      <div className={styles.label}>Starting Quest</div>
      <div className={styles.startName}>{startQ?.Name}</div>
      <p className={styles.startText}>{startQ?.Description && <GlossaryText text={startQ.Description} matcher={matcher} />}</p>

      <div className={styles.label}>Chosen Quests</div>
      {chosen.map((aq) => {
        const q = library.quests.find((x) => x.Id === aq.QuestId);
        if (!q) return null;
        return (
          <div key={aq.QuestId} className={styles.questRow}>
            <button
              className={`tap ${styles.check} ${aq.Completed ? styles.checkDone : ''}`}
              onClick={() => commit((d) => { const x = d.Theme.AcceptedQuests.find((y) => y.QuestId === aq.QuestId); if (x) x.Completed = !x.Completed; })}
              aria-pressed={aq.Completed}
              aria-label={`Mark "${q.Name}" ${aq.Completed ? 'incomplete' : 'complete'}`}
            >
              {aq.Completed ? '✓' : ''}
            </button>
            <div className={styles.questBody}>
              <div className={`${styles.questName} ${aq.Completed ? styles.questNameDone : ''}`}>{q.Name}</div>
              <p className={styles.questText}><GlossaryText text={q.Description} matcher={matcher} /></p>
            </div>
            <button
              className={`tap ${styles.drop}`}
              onClick={() => setDroppingQuest({ id: aq.QuestId, name: q.Name })}
              title="Drop quest"
              aria-label={`Drop quest: ${q.Name}`}
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

      {droppingQuest && (
        <ConfirmModal
          title="Drop this Quest?"
          body={`"${droppingQuest.name}" will be removed from your accepted Quests.`}
          confirmLabel="Drop Quest"
          onConfirm={() => {
            commit((d) => { d.Theme.AcceptedQuests = d.Theme.AcceptedQuests.filter((x) => x.QuestId !== droppingQuest.id); });
            setDroppingQuest(null);
          }}
          onCancel={() => setDroppingQuest(null)}
        />
      )}
    </Panel>
  );
}

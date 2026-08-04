import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { effectChipLabel } from './sheetHelpers.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './AbilitiesSkillsPanel.module.css';

export function AbilitiesSkillsPanel({ sheet, library }: { sheet: CharacterSheet; library: Library }) {
  const matcher = useGlossaryMatcher();
  return (
    <Panel collapseId="abilities">
      <PanelHeader>Abilities &amp; Skills</PanelHeader>
      {sheet.AbilityIds.map((id) => {
        const a = library.abilities.find((x) => x.Id === id);
        if (!a) return null;
        return (
          <div key={id} className={styles.row}>
            <div className={styles.name}>{a.Name}</div>
            <p className={styles.text}><GlossaryText text={a.RulesText} matcher={matcher} /></p>
            {a.Effects.length > 0 && (
              <div className={styles.effects}>
                {a.Effects.map((e, i) => (
                  <span key={i} className={styles.effect}>
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
          <div key={id} className={styles.row}>
            <div className={styles.name}>
              {s.Name} <span className={styles.kind}>Skill</span>
            </div>
            <p className={styles.text}><GlossaryText text={s.Effect} matcher={matcher} /></p>
          </div>
        );
      })}
    </Panel>
  );
}

import type { CharacterSheet, Library } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { effectChipLabel } from './sheetHelpers.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './AbilitiesSkillsPanel.module.css';

/** Abilities and skills flow into one `.list` grid (0.24.0) — two columns once the panel's own
 *  measured width clears the container-query threshold in AbilitiesSkillsPanel.module.css, one
 *  column below it. They render from a single combined array (abilities first, then skills)
 *  rather than the two consecutive `.map()`s this used to be, so the grid packs both kinds of row
 *  together instead of restarting a fresh two-column layout partway down. */
export function AbilitiesSkillsPanel({ sheet, library }: { sheet: CharacterSheet; library: Library }) {
  const matcher = useGlossaryMatcher();
  const abilityItems = sheet.AbilityIds
    .map((id) => library.abilities.find((x) => x.Id === id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  const skillItems = sheet.SkillIds
    .map((id) => library.skills.find((x) => x.Id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <Panel collapseId="abilities">
      <PanelHeader>Abilities &amp; Skills</PanelHeader>
      <div className={`board ${styles.list}`}>
        {abilityItems.map((a) => (
          <div key={a.Id} className={`posting tilt ${styles.row}`}>
            <div className={styles.name}>{a.Name}</div>
            <p className={`prose ${styles.text}`}><GlossaryText text={a.RulesText} matcher={matcher} /></p>
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
        ))}
        {skillItems.map((s) => (
          <div key={s.Id} className={`posting tilt ${styles.row}`}>
            <div className={styles.name}>
              {s.Name} <span className={styles.kind}>Skill</span>
            </div>
            <p className={`prose ${styles.text}`}><GlossaryText text={s.Effect} matcher={matcher} /></p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

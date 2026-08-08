import type { CharacterSheet, Library } from '@asohav/shared';
import { damageTier, effectiveVirtueScore, isDishonored, markedConditionCount } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { InfoTooltip, TooltipSection } from '../../components/InfoTooltip.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './VirtuesPanel.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export function VirtuesPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const matcher = useGlossaryMatcher();
  const markedCount = markedConditionCount(sheet);
  const condTier = damageTier(markedCount, 1);
  const dishonored = isDishonored(sheet);
  const floor = library.settings.ConditionFloor;
  const dishonoredTerm = library.glossary.find((g) => g.Name === 'Dishonored');

  return (
    <Panel id="p-virtues" collapseId="virtues" primary grain damageTier={condTier} damageVariant="virtues">
      <PanelHeader
        extra={
          dishonored ? (
            <span className={styles.dishonoredWrap}>
              <span className={styles.dishonored}>Dishonored</span>
              <InfoTooltip label="Dishonored">
                <TooltipSection label="What it means">{dishonoredTerm?.Definition ?? 'Something gets between you and your quest.'}</TooltipSection>
              </InfoTooltip>
            </span>
          ) : undefined
        }
      >
        Virtues
      </PanelHeader>
      <p className={styles.intro}>
        {markedCount === 0
          ? 'No Conditions marked. A marked Condition is −2 Ongoing on that Virtue, floored at −3 total.'
          : `${markedCount} of 5 Conditions marked. At five, your character is Dishonored.`}
      </p>

      {sheet.Virtues.map((vv) => {
        const v = library.virtues.find((x) => x.Id === vv.VirtueId);
        const cond = library.conditions.find((c) => c.VirtueId === vv.VirtueId);
        if (!v || !cond) return null;
        const eff = effectiveVirtueScore(vv.Score, vv.ConditionMarked, cond.RollPenalty, floor);
        return (
          <div key={vv.VirtueId} className={styles.row}>
            {vv.ConditionMarked && <div className={styles.tint} />}
            <div className={styles.rowBody}>
              <div className={styles.head}>
                <div className={styles.naming}>
                  <div className={styles.name}>
                    {v.Name}{' '}
                    <InfoTooltip label={v.Name}>
                      <TooltipSection label="Essence"><GlossaryText text={v.Essence} matcher={matcher} /></TooltipSection>
                      <TooltipSection label="Use it when…"><GlossaryText text={v.UsageHelperText} matcher={matcher} /></TooltipSection>
                    </InfoTooltip>
                  </div>
                  <div className={styles.tagline}>{v.Tagline}</div>
                </div>
                <span className={styles.score} title="Virtues are set at character creation and only change through a Potential Advancement.">
                  {sign(vv.Score)}
                </span>
                {vv.ConditionMarked && <div className={styles.effective}>{sign(eff)}</div>}
              </div>
              <div className={styles.conditionRow}>
                <button
                  className={`tap ${styles.condition} ${vv.ConditionMarked ? styles.conditionMarked : ''}`}
                  onClick={() => commit((d) => { const x = d.Virtues.find((y) => y.VirtueId === vv.VirtueId)!; x.ConditionMarked = !x.ConditionMarked; })}
                  aria-pressed={vv.ConditionMarked}
                >
                  <span className={`${styles.checkbox} ${vv.ConditionMarked ? styles.checkboxMarked : ''}`} aria-hidden>
                    {vv.ConditionMarked ? '✓' : ''}
                  </span>
                  {vv.ConditionMarked ? `${cond.Name} — marked` : cond.Name}
                </button>
                <InfoTooltip label={cond.Name}>
                  <TooltipSection label="Roll penalty">{cond.RollPenalty} to {v.Name} while marked.</TooltipSection>
                  <TooltipSection label="Clear it"><GlossaryText text={cond.ClearAction} matcher={matcher} /></TooltipSection>
                </InfoTooltip>
              </div>
              {vv.ConditionMarked && <p className={styles.clearAction}>Clear it: <GlossaryText text={cond.ClearAction} matcher={matcher} /></p>}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

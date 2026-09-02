import { useState } from 'react';
import type { CharacterSheet, Library } from '@asohav/shared';
import { CONDITION_COUNT, allConditionsMarked, effectiveVirtueScore, markCondition, markedConditionCount } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { InfoTooltip, TooltipSection } from '../../components/InfoTooltip.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { CrumbleModal } from './CrumbleModal.js';
import styles from './VirtuesPanel.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export function VirtuesPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const matcher = useGlossaryMatcher();
  const [crumbling, setCrumbling] = useState(false);
  const markedCount = markedConditionCount(sheet);
  const allMarked = allConditionsMarked(sheet);
  const floor = library.settings.ConditionFloor;
  // By Id, with a Name fallback: the term was renamed g-dishonored -> g-crumble in `0.28.0`, and
  // a Name-only lookup breaks silently on a rename rather than failing loudly.
  const crumbleTerm = library.glossary.find((g) => g.Id === 'g-crumble') ?? library.glossary.find((g) => g.Name === 'Crumble');

  return (
    <Panel id="p-virtues" collapseId="virtues" primary grain>
      <PanelHeader
        extra={
          allMarked ? (
            <span className={styles.dishonoredWrap}>
              <span className={styles.dishonored}>All marked</span>
              <InfoTooltip label="Crumble">
                <TooltipSection label="What happens next">
                  {crumbleTerm?.Definition ??
                    'The next Condition you would mark has nowhere to go, so you Crumble: you leave the scene, then clear one Condition.'}
                </TooltipSection>
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
          : `${markedCount} of ${CONDITION_COUNT} Conditions marked.${
              allMarked ? ' The next Condition you would mark Crumbles you instead.' : ''
            }`}
      </p>

      {allMarked && (
        <p className={styles.intro}>
          <button className={`tap-inline ${styles.crumbleButton}`} onClick={() => setCrumbling(true)}>
            I Crumble
          </button>{' '}
          — use this when the table calls for a Condition you can&rsquo;t mark. The app only sees
          the Conditions it marks itself (a Gambit&rsquo;s cost, spending your last Recovery), not
          one the fiction demands.
        </p>
      )}

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
                  <span className={styles.tagline}>{v.Tagline}</span>
                </div>
                <div className={styles.trailing}>
                  <div className={styles.scoreBox} title="Virtues are set at character creation and only change through a Potential Advancement.">
                    <span className={styles.score}>{sign(vv.Score)}</span>
                    {vv.ConditionMarked && <span className={styles.effective}>{sign(eff)}</span>}
                  </div>
                  <div className={styles.conditionWrap}>
                    <button
                      className={`tap ${styles.condition} ${vv.ConditionMarked ? styles.conditionMarked : ''}`}
                      onClick={() => {
                        // Unmarking is always free; marking funnels through markCondition, which
                        // is the only thing that decides a Crumble.
                        if (vv.ConditionMarked) {
                          commit((d) => { const x = d.Virtues.find((y) => y.VirtueId === vv.VirtueId)!; x.ConditionMarked = false; });
                          return;
                        }
                        let crumbled = false;
                        commit((d) => { crumbled = markCondition(d, vv.VirtueId).Crumbled; });
                        if (crumbled) setCrumbling(true);
                      }}
                      aria-pressed={vv.ConditionMarked}
                    >
                      {cond.Name}
                    </button>
                    <InfoTooltip label={cond.Name}>
                      <TooltipSection label="Roll penalty">{cond.RollPenalty} to {v.Name} while marked.</TooltipSection>
                      <TooltipSection label="Clear it"><GlossaryText text={cond.ClearAction} matcher={matcher} /></TooltipSection>
                    </InfoTooltip>
                  </div>
                </div>
              </div>
              {vv.ConditionMarked && <p className={styles.clearAction}>Clear it: <GlossaryText text={cond.ClearAction} matcher={matcher} /></p>}
            </div>
          </div>
        );
      })}
      {crumbling && (
        <CrumbleModal
          sheet={sheet}
          library={library}
          reason="You had to mark a Condition with all five already marked."
          commit={commit}
          onClose={() => setCrumbling(false)}
        />
      )}
    </Panel>
  );
}

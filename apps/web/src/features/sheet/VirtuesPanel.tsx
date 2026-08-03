import type { CharacterSheet, Library } from '@asohav/shared';
import { damageTier, effectiveVirtueScore, isDishonored, markedConditionCount } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import styles from './VirtuesPanel.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export function VirtuesPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const markedCount = markedConditionCount(sheet);
  const condTier = damageTier(markedCount, 1);
  const dishonored = isDishonored(sheet);
  const floor = library.settings.ConditionFloor;

  return (
    <Panel id="p-virtues" collapseId="virtues" primary grain damageTier={condTier} damageVariant="virtues">
      <PanelHeader extra={dishonored ? <span className={styles.dishonored}>Dishonored</span> : undefined}>Virtues</PanelHeader>
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
                  <div className={styles.name}>{v.Name}</div>
                  <div className={styles.tagline}>{v.Tagline}</div>
                </div>
                <div className={styles.stepperGroup}>
                  <button
                    className={`tap ${styles.stepper}`}
                    onClick={() => commit((d) => { const x = d.Virtues.find((y) => y.VirtueId === vv.VirtueId)!; x.Score = Math.max(-2, x.Score - 1); })}
                  >
                    &minus;
                  </button>
                  <span className={styles.score}>{sign(vv.Score)}</span>
                  <button
                    className={`tap ${styles.stepper}`}
                    onClick={() => commit((d) => { const x = d.Virtues.find((y) => y.VirtueId === vv.VirtueId)!; x.Score = Math.min(3, x.Score + 1); })}
                  >
                    +
                  </button>
                </div>
                {vv.ConditionMarked && <div className={styles.effective}>{sign(eff)}</div>}
              </div>
              <button
                className={`tap ${styles.condition} ${vv.ConditionMarked ? styles.conditionMarked : ''}`}
                onClick={() => commit((d) => { const x = d.Virtues.find((y) => y.VirtueId === vv.VirtueId)!; x.ConditionMarked = !x.ConditionMarked; })}
              >
                {vv.ConditionMarked ? `${cond.Name} — marked` : cond.Name}
              </button>
              {vv.ConditionMarked && <p className={styles.clearAction}>Clear it: {cond.ClearAction}</p>}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

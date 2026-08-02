import type { CharacterSheet, Library } from '@asohav/shared';
import { damageTier, effectiveVirtueScore, isDishonored, markedConditionCount } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export function VirtuesPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const markedCount = markedConditionCount(sheet);
  const condTier = damageTier(markedCount, 1);
  const dishonored = isDishonored(sheet);
  const floor = library.settings.ConditionFloor;

  return (
    <Panel id="p-virtues" primary grain damageTier={condTier} damageVariant="virtues">
      <PanelHeader
        extra={
          dishonored ? (
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--panel)',
                background: 'var(--danger)',
                padding: '3px 9px',
              }}
            >
              Dishonored
            </span>
          ) : undefined
        }
      >
        Virtues
      </PanelHeader>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--ink-62)', fontStyle: 'italic' }}>
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
          <div key={vv.VirtueId} style={{ position: 'relative', padding: 12, margin: '0 -12px', borderBottom: '1px solid var(--rule-soft)' }}>
            {vv.ConditionMarked && <div style={{ position: 'absolute', inset: 0, background: 'var(--danger-tint)', pointerEvents: 'none' }} />}
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{v.Name}</div>
                  <div style={{ fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ink-62)' }}>{v.Tagline}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className="tap"
                    onClick={() => commit((d) => { const x = d.Virtues.find((y) => y.VirtueId === vv.VirtueId)!; x.Score = Math.max(-2, x.Score - 1); })}
                    style={stepperBtn}
                  >
                    &minus;
                  </button>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, minWidth: 34, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {sign(vv.Score)}
                  </span>
                  <button
                    className="tap"
                    onClick={() => commit((d) => { const x = d.Virtues.find((y) => y.VirtueId === vv.VirtueId)!; x.Score = Math.min(3, x.Score + 1); })}
                    style={stepperBtn}
                  >
                    +
                  </button>
                </div>
                {vv.ConditionMarked && (
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--danger)', minWidth: 30, textAlign: 'right' }}>
                    {sign(eff)}
                  </div>
                )}
              </div>
              <button
                className="tap"
                onClick={() => commit((d) => { const x = d.Virtues.find((y) => y.VirtueId === vv.VirtueId)!; x.ConditionMarked = !x.ConditionMarked; })}
                style={
                  vv.ConditionMarked
                    ? { width: '100%', marginTop: 9, textAlign: 'left', fontSize: 11.5, letterSpacing: '.09em', textTransform: 'uppercase', padding: '6px 10px', background: 'var(--danger-tint)', border: '1px solid var(--danger-line)', color: 'var(--danger)' }
                    : { width: '100%', marginTop: 9, textAlign: 'left', fontSize: 11.5, letterSpacing: '.09em', textTransform: 'uppercase', padding: '6px 10px', background: 'transparent', border: '1px solid var(--rule-field)', color: 'var(--ink-55)' }
                }
              >
                {vv.ConditionMarked ? `${cond.Name} — marked` : cond.Name}
              </button>
              {vv.ConditionMarked && (
                <p style={{ margin: '8px 0 0', fontSize: 12.5, fontStyle: 'italic', color: 'rgba(42,32,26,.68)', borderLeft: '2px solid rgba(140,58,31,.4)', paddingLeft: 10 }}>
                  Clear it: {cond.ClearAction}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

const stepperBtn = {
  width: 24,
  height: 24,
  lineHeight: 1,
  border: '1px solid var(--ink-25)',
  background: 'transparent',
  color: 'rgba(42,32,26,.65)',
  fontSize: 14,
  padding: 0,
} as const;

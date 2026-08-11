import { useState } from 'react';
import type { CharacterStatus, RollTier, StatusPolarity, VirtueValue, Virtue } from '@asohav/shared';
import { resistRollReduction } from '@asohav/shared';
import modal from '../../styles/modal.module.css';
import styles from './GiveStatusModal.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

const TIER_BUTTONS: { tier: RollTier; label: string }[] = [
  { tier: 'Tier3', label: '10+' },
  { tier: 'Tier2', label: '7–9' },
  { tier: 'Tier1', label: 'Miss' },
];

/** Records what a GM told you ("take Bleeding 3") and — this app never rolls dice for you, see
 *  CLAUDE.md — lets you report which Virtue you Resisted with and which tier you hit, so the
 *  effective Rank that actually lands is computed for you rather than done by hand. Optionally
 *  cancels an existing opposite-polarity Status instead of stacking a new one. */
export function GiveStatusModal({
  virtues,
  virtueValues,
  existingStatuses,
  onApply,
  onClose,
}: {
  virtues: Virtue[];
  virtueValues: VirtueValue[];
  existingStatuses: CharacterStatus[];
  onApply: (incoming: { Name: string; Polarity: StatusPolarity; Rank: number }, opposingId: string | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [polarity, setPolarity] = useState<StatusPolarity>('Negative');
  // Raw text, not the clamped number, controls the input — see StatusesPanel.tsx's newRankText
  // for why clamping the value itself on every keystroke fights the user mid-edit.
  const [rankText, setRankText] = useState('2');
  const [resisting, setResisting] = useState(false);
  const [virtueId, setVirtueId] = useState(virtues[0]?.Id ?? '');
  const [tier, setTier] = useState<RollTier | null>(null);
  const [opposingId, setOpposingId] = useState('');

  const parsedBaseRank = parseInt(rankText, 10);
  const baseRank = Number.isFinite(parsedBaseRank) ? Math.max(1, Math.min(6, parsedBaseRank)) : 1;
  const virtueScore = virtueValues.find((v) => v.VirtueId === virtueId)?.Score ?? 0;
  const reduction = resisting && tier ? resistRollReduction(virtueScore, tier) : 0;
  const effectiveRank = Math.max(0, baseRank - reduction);
  const candidateOpposites = existingStatuses.filter((s) => (polarity === 'Positive' ? s.Polarity !== 'Positive' : s.Polarity === 'Positive'));

  const canApply = name.trim().length > 0 && effectiveRank > 0 && (!resisting || tier !== null);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 className={modal.title}>Give a Status</h2>
          <p className={modal.subtitle}>What the GM told you, plus how you Resisted it (if you did).</p>
        </div>
        <div className={modal.body}>
          <label className={styles.label}>Status name</label>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bleeding, Rattled, Prepared…" autoFocus />

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Polarity</label>
              <select className={styles.select} value={polarity} onChange={(e) => setPolarity(e.target.value as StatusPolarity)}>
                <option value="Negative">Negative</option>
                <option value="Positive">Positive</option>
                <option value="Neutral">Neutral</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Rank given</label>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={6}
                value={rankText}
                onChange={(e) => setRankText(e.target.value)}
                onBlur={() => setRankText(String(baseRank))}
              />
            </div>
          </div>

          <button type="button" className={`tap-inline ${styles.toggle}`} onClick={() => setResisting((r) => !r)}>
            {resisting ? '✓ Resisting this' : 'Resist this?'}
          </button>

          {resisting && (
            <div className={styles.resistBox}>
              <label className={styles.label}>Roll + which Virtue?</label>
              <select className={styles.select} value={virtueId} onChange={(e) => setVirtueId(e.target.value)}>
                {virtues.map((v) => (
                  <option key={v.Id} value={v.Id}>
                    {v.Name} ({sign(virtueValues.find((vv) => vv.VirtueId === v.Id)?.Score ?? 0)})
                  </option>
                ))}
              </select>
              <label className={styles.label}>Which tier did you roll?</label>
              <div className={`tap-row ${styles.tierRow}`}>
                {TIER_BUTTONS.map((t) => (
                  <button
                    key={t.tier}
                    type="button"
                    className={`tap-inline ${styles.tierButton} ${tier === t.tier ? styles.tierButtonActive : ''}`}
                    onClick={() => setTier(t.tier)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tier && (
                <p className={styles.reductionNote}>
                  Reduces the Rank by {reduction} (0 floor). Effective Rank: <strong>{effectiveRank}</strong>
                </p>
              )}
            </div>
          )}

          {candidateOpposites.length > 0 && (
            <>
              <label className={styles.label}>Opposes an existing Status?</label>
              <select className={styles.select} value={opposingId} onChange={(e) => setOpposingId(e.target.value)}>
                <option value="">No — stack normally</option>
                {candidateOpposites.map((s) => (
                  <option key={s.Id} value={s.Id}>
                    {s.Name} {s.Rank}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            className={`tap-inline ${modal.primaryAction}`}
            disabled={!canApply}
            onClick={() => {
              if (!canApply) return;
              onApply({ Name: name.trim(), Polarity: polarity, Rank: effectiveRank }, opposingId || null);
            }}
          >
            Apply
          </button>
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

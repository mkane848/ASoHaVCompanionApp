import { useState } from 'react';
import type { CharacterStatus, RollTier } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { useMisfortune } from '../../lib/useMisfortune.js';
import modal from '../../styles/modal.module.css';
import styles from './RecuperateModal.module.css';

const TIER_BUTTONS: { tier: RollTier; label: string; segments: number }[] = [
  { tier: 'Tier3', label: '10+', segments: 3 },
  { tier: 'Tier2', label: '7–9', segments: 2 },
  { tier: 'Tier1', label: '6-', segments: 1 },
];

/** Recuperate (V0.6 slice 1): take 2 Strain to remove any one Minor Status, then roll +Mettle to
 *  advance the Healing Track — 10+ marks 3 segments, 7-9 marks 2, 6- marks 1 and the GM gains 1
 *  Misfortune. This app doesn't roll dice (see CLAUDE.md) — report which tier you hit and it
 *  applies the result. Replaces HealStatusModal/spending a Recovery entirely. Used both from the
 *  sheet and from Combat. Combat's Recuperate adds an alternative (revised V0.6, slice 6): "Or
 *  Take 2 Strain to Clear any one Condition immediately" — offered only when the caller passes
 *  `onClearCondition`, since the Adventure Move has no such option. */
export function RecuperateModal({
  minorStatuses,
  mettleScore,
  markedConditions = [],
  onApply,
  onClearCondition,
  onClose,
}: {
  minorStatuses: CharacterStatus[];
  mettleScore: number;
  markedConditions?: { VirtueId: string; ConditionName: string }[];
  onApply: (removeStatusId: string | null, tier: RollTier) => void;
  onClearCondition?: (virtueId: string) => void;
  onClose: () => void;
}) {
  const [removeStatusId, setRemoveStatusId] = useState('');
  const [clearVirtueId, setClearVirtueId] = useState('');
  const [tier, setTier] = useState<RollTier | null>(null);
  const misfortune = useMisfortune();
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recuperate-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="recuperate-title" className={modal.title}>Recuperate</h2>
          <p className={modal.subtitle}>Take 2 Strain to remove any one Minor Status, then roll +Mettle to advance your Healing Track.</p>
        </div>
        <div className={modal.body}>
          {minorStatuses.length > 0 && (
            <>
              <label className={styles.label} htmlFor="recuperate-status">Remove a Minor Status? (optional)</label>
              <select id="recuperate-status" className={styles.select} value={removeStatusId} onChange={(e) => setRemoveStatusId(e.target.value)}>
                <option value="">Don&rsquo;t remove one</option>
                {minorStatuses.map((s) => (
                  <option key={s.Id} value={s.Id}>{s.Name}</option>
                ))}
              </select>
            </>
          )}

          <label className={styles.label} id="recuperate-tier-label">Roll +Mettle ({mettleScore >= 0 ? `+${mettleScore}` : mettleScore}) — which tier?</label>
          <div className={`tap-row ${styles.tierRow}`} role="group" aria-labelledby="recuperate-tier-label">
            {TIER_BUTTONS.map((t) => (
              <button
                key={t.tier}
                type="button"
                aria-pressed={tier === t.tier}
                className={`tap-inline ${styles.tierButton} ${tier === t.tier ? styles.tierButtonActive : ''}`}
                onClick={() => setTier(t.tier)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tier && <p className={styles.note}>Marks {TIER_BUTTONS.find((t) => t.tier === tier)!.segments} segment(s) on the Healing Track. Takes 2 Strain.{tier === 'Tier1' && ' The GM gains 1 Misfortune.'}</p>}

          <button className={`tap-inline ${modal.primaryAction}`} disabled={!tier} onClick={() => {
            if (tier) {
              if (tier === 'Tier1') {
                misfortune.gain('A 6- on Recuperate');
              }
              onApply(removeStatusId || null, tier);
            }
          }}>
            Apply
          </button>
          {onClearCondition && markedConditions.length > 0 && (
            <>
              <label className={styles.label} htmlFor="recuperate-condition">Or take 2 Strain to clear a Condition now</label>
              <select id="recuperate-condition" className={styles.select} value={clearVirtueId} onChange={(e) => setClearVirtueId(e.target.value)}>
                <option value="">Choose a Condition…</option>
                {markedConditions.map((c) => (
                  <option key={c.VirtueId} value={c.VirtueId}>{c.ConditionName}</option>
                ))}
              </select>
              <button className={`tap-inline ${modal.secondaryAction}`} disabled={!clearVirtueId} onClick={() => onClearCondition(clearVirtueId)}>
                Clear it (takes 2 Strain)
              </button>
            </>
          )}
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

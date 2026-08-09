import { useState } from 'react';
import type { CharacterSheet, CombatParticipant, EngageKind, Library, RollTier } from '@asohav/shared';
import { applyToughness, computeRollBreakdown, engageBaseRank } from '@asohav/shared';
import modal from '../../styles/modal.module.css';
import styles from './CombatMoveModal.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

const TIER_BUTTONS: { tier: RollTier; label: string }[] = [
  { tier: 'Tier3', label: '10+' },
  { tier: 'Tier2', label: '7–9' },
  { tier: 'Tier1', label: 'Miss' },
];

/** Engage in Melee / Engage at Range both roll 2d6 + Might for a PC actor, giving a fixed Status
 *  Rank per tier (blunted by the target's Toughness if it's an Enemy). An Enemy actor has no
 *  sheet to roll against, so the GM just reports the tier directly. Applying the result to an
 *  Enemy writes straight to its Statuses; applying it to a PC creates a PendingStatusOffer for
 *  that player to accept on their own sheet instead (see PendingStatusOffer's doc comment). */
export function CombatMoveModal({
  kind,
  actor,
  actorSheet,
  library,
  targets,
  onApplyToEnemy,
  onOfferToPC,
  onClose,
}: {
  kind: EngageKind;
  actor: CombatParticipant;
  actorSheet: CharacterSheet | null;
  library: Library;
  targets: CombatParticipant[];
  onApplyToEnemy: (targetId: string, rank: number, statusName: string) => void;
  onOfferToPC: (targetId: string, rank: number, statusName: string) => void;
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState(targets[0]?.Id ?? '');
  const [tier, setTier] = useState<RollTier | null>(null);
  const [statusName, setStatusName] = useState(kind === 'Melee' ? 'Wounded' : 'Struck');

  const target = targets.find((t) => t.Id === targetId);
  const breakdown = actorSheet ? computeRollBreakdown(actorSheet, 'v-might', library) : null;

  const baseRank = tier ? engageBaseRank(kind, tier) : 0;
  const finalRank = tier && target?.Kind === 'Enemy' && target.Toughness ? applyToughness(baseRank, tier, kind, target.Toughness) : baseRank;

  const canApply = !!target && !!tier && finalRank > 0 && statusName.trim().length > 0;

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 className={modal.title}>{kind === 'Melee' ? 'Engage in Melee' : 'Engage at Range'}</h2>
          <p className={modal.subtitle}>{actor.Name}, roll 2d6 + Might.</p>
        </div>
        <div className={modal.body}>
          {breakdown && (
            <div className={styles.breakdown}>
              Total: <strong>{sign(breakdown.Total)}</strong>
              <ul>
                {breakdown.Sources.map((s, i) => (
                  <li key={i}>
                    <span>{s.Label}</span>
                    <span>{sign(s.Value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className={styles.label}>Target</label>
          <select className={styles.select} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            {targets.map((t) => (
              <option key={t.Id} value={t.Id}>
                {t.Name}
              </option>
            ))}
          </select>

          <label className={styles.label}>Which tier did you roll?</label>
          <div className={styles.tierRow}>
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

          <label className={styles.label}>Status to give</label>
          <input className={styles.input} value={statusName} onChange={(e) => setStatusName(e.target.value)} placeholder="Wounded, Hobbled, Scared…" />

          {tier && (
            <p className={styles.note}>
              Rank {baseRank}{target?.Kind === 'Enemy' && target.Toughness && target.Toughness !== 'None' ? ` → ${finalRank} after ${target.Toughness} Toughness` : ''}.
              {target?.Kind === 'PC' && ' Offered to their own sheet — they apply it themselves (and may Resist first).'}
            </p>
          )}

          <button
            className={`tap-inline ${modal.primaryAction}`}
            disabled={!canApply}
            onClick={() => {
              if (!target || !tier) return;
              if (target.Kind === 'Enemy') onApplyToEnemy(target.Id, finalRank, statusName.trim());
              else onOfferToPC(target.Id, baseRank, statusName.trim());
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

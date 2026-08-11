import { useState } from 'react';
import type { CharacterStatus, CombatParticipant } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import styles from './ParticipantCard.module.css';

export function ParticipantCard({
  participant,
  statuses,
  canControl,
  canEngage,
  isOwnPC,
  canRecuperate,
  canDefend,
  canHelp,
  onSetAP,
  onReposition,
  onEngageMelee,
  onEngageRanged,
  onRecuperate,
  onDefend,
  onHelp,
  onRemove,
}: {
  participant: CombatParticipant;
  statuses: CharacterStatus[];
  canControl: boolean;
  canEngage: boolean;
  isOwnPC: boolean;
  canRecuperate: boolean;
  canDefend: boolean;
  canHelp: boolean;
  onSetAP: (n: number) => void;
  onReposition: (deltaBands: number) => void;
  onEngageMelee: () => void;
  onEngageRanged: () => void;
  onRecuperate: () => void;
  onDefend: () => void;
  onHelp: () => void;
  onRemove: () => void;
}) {
  const ap = participant.ActionPointsRemaining;
  const hasAP = ap > 0;
  const defeated = !!participant.Defeated;
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  return (
    <div
      className={`${styles.card} ${participant.Kind === 'Enemy' ? styles.cardEnemy : styles.cardParty} ${defeated ? styles.cardDefeated : ''}`}
    >
      <div className={styles.head}>
        <span className={styles.name}>{participant.Name}</span>
        {participant.Kind === 'Enemy' && participant.Toughness && participant.Toughness !== 'None' && (
          <span className={styles.badge}>{participant.Toughness} Toughness</span>
        )}
        {participant.Unstable && <span className={styles.badge}>Unstable</span>}
        {defeated && <span className={styles.defeatedBadge}>Defeated</span>}
        {canControl && (
          <button
            className={`tap-inline ${styles.rangeButton}`}
            onClick={() => setConfirmingRemove(true)}
            title="Remove from Combat"
            aria-label={`Remove ${participant.Name} from Combat`}
          >
            &times;
          </button>
        )}
      </div>

      <div className={`tap-row ${styles.meta}`}>
        <div className={styles.range}>
          <button className={`tap-inline ${styles.rangeButton}`} disabled={!canControl || !hasAP} onClick={() => onReposition(-1)}>
            &laquo;
          </button>
          <span>{participant.Range}</span>
          <button className={`tap-inline ${styles.rangeButton}`} disabled={!canControl || !hasAP} onClick={() => onReposition(1)}>
            &raquo;
          </button>
        </div>
        <div className={styles.apRow}>
          <span className={styles.apLabel}>AP {ap}/3</span>
          {canControl && (
            <>
              <button className={`tap-inline ${styles.rangeButton}`} disabled={ap <= 0} onClick={() => onSetAP(Math.max(0, ap - 1))}>
                &minus;
              </button>
              <button className={`tap-inline ${styles.rangeButton}`} disabled={ap >= 3} onClick={() => onSetAP(Math.min(3, ap + 1))}>
                &#43;
              </button>
            </>
          )}
        </div>
      </div>

      {statuses.length > 0 && (
        <div className={styles.statuses}>
          {statuses.map((s) => (
            <span key={s.Id} className={`${styles.status} ${s.Polarity === 'Positive' ? styles.statusPositive : styles.statusNegative}`}>
              {s.Name} {s.Rank}
            </span>
          ))}
        </div>
      )}

      {!defeated && (
        <div className={styles.actions}>
          {canEngage && (
            <>
              <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || participant.Range !== 'Melee'} onClick={onEngageMelee}>
                Engage in Melee
              </button>
              <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || participant.Range === 'OutOfRange'} onClick={onEngageRanged}>
                Engage at Range
              </button>
            </>
          )}
          {isOwnPC && (
            <>
              <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || !canRecuperate} onClick={onRecuperate}>
                Recuperate
              </button>
              <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || !canDefend} onClick={onDefend}>
                Defend
              </button>
            </>
          )}
          {canHelp && (
            <button className={`tap-inline ${styles.actionButton}`} onClick={onHelp}>
              Help (&minus;1 Rapport)
            </button>
          )}
        </div>
      )}

      {confirmingRemove && (
        <ConfirmModal
          title="Remove from Combat?"
          body={`${participant.Name} will be removed from this Encounter. This can't be undone from here.`}
          confirmLabel="Remove"
          onConfirm={() => { onRemove(); setConfirmingRemove(false); }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  );
}

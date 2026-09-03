import { useState, type ReactNode } from 'react';
import { isEnemyDefeated, isEnemyUnstable, isUnstable, sortStatuses, statusRank, type CharacterStatus, type CombatParticipant } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import styles from './ParticipantCard.module.css';

/** The name/badges/Range/AP/Statuses/remove-confirm chrome every participant card shares,
 *  regardless of which of the three variants below it is. `canControl` stays a real prop here
 *  (not folded into "which variant") since it's an orthogonal permission — both an own-PC card
 *  and an enemy card can have it true, and it varies per viewer for both.  Each variant supplies
 *  its own action buttons as plain children rather than through a render prop — none of them need
 *  anything from the shell's internals beyond what they already have from `participant`. */
function ParticipantCardShell({
  participant,
  statuses,
  canControl,
  onSetAP,
  onReposition,
  onRemove,
  extraBadges,
  children,
}: {
  participant: CombatParticipant;
  statuses: CharacterStatus[];
  canControl: boolean;
  onSetAP: (n: number) => void;
  onReposition: (deltaBands: number) => void;
  onRemove: () => void;
  extraBadges?: ReactNode;
  children: ReactNode;
}) {
  const ap = participant.ActionPointsRemaining;
  const hasAP = ap > 0;
  const defeated = !!participant.Defeated;
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // Unstable is derived, never stored (V0.5: a Hero at Rank 4 of any Status; an enemy once one of
  // its Negative Statuses reaches half that Status's Limit). A stored flag would drift from the
  // Statuses that determine it — which is exactly what the old `CombatParticipant.Unstable` did:
  // it was written once as `false` and never set by anything.
  const unstable =
    participant.Kind === 'Enemy'
      ? isEnemyUnstable(statuses, participant.StatusLimits)
      : isUnstable(statuses);

  return (
    <div
      className={`${styles.card} ${participant.Kind === 'Enemy' ? styles.cardEnemy : styles.cardParty} ${defeated ? styles.cardDefeated : ''}`}
    >
      <div className={styles.head}>
        <span className={styles.name}>{participant.Name}</span>
        {participant.Kind === 'Enemy' && participant.Toughness && participant.Toughness !== 'None' && (
          <span className={styles.badge}>{participant.Toughness} Toughness</span>
        )}
        {unstable && <span className={styles.badge}>Unstable</span>}
        {extraBadges}
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
          {sortStatuses(statuses).map((s) => (
            <span
              key={s.Id}
              className={`${styles.status} ${
                s.Polarity === 'Positive' ? styles.statusPositive : s.Polarity === 'Neutral' ? styles.statusNeutral : styles.statusNegative
              }`}
            >
              {s.Name} {statusRank(s)}
            </span>
          ))}
        </div>
      )}

      {!defeated && <div className={styles.actions}>{children}</div>}

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

/** Your own character's card — always controllable and engageable by definition, so neither is a
 *  prop here. The only variant that shows Recuperate/Defend. */
export function OwnPCCard({
  participant,
  statuses,
  canRecuperate,
  canDefend,
  onSetAP,
  onReposition,
  onEngageMelee,
  onEngageRanged,
  onRecuperate,
  onDefend,
  onRemove,
}: {
  participant: CombatParticipant;
  statuses: CharacterStatus[];
  canRecuperate: boolean;
  canDefend: boolean;
  onSetAP: (n: number) => void;
  onReposition: (deltaBands: number) => void;
  onEngageMelee: () => void;
  onEngageRanged: () => void;
  onRecuperate: () => void;
  onDefend: () => void;
  onRemove: () => void;
}) {
  const hasAP = participant.ActionPointsRemaining > 0;
  return (
    <ParticipantCardShell participant={participant} statuses={statuses} canControl onSetAP={onSetAP} onReposition={onReposition} onRemove={onRemove}>
      <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || participant.Range !== 'Melee'} onClick={onEngageMelee}>
        Engage in Melee
      </button>
      <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || participant.Range === 'OutOfRange'} onClick={onEngageRanged}>
        Engage at Range
      </button>
      <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || !canRecuperate} onClick={onRecuperate}>
        Recuperate
      </button>
      <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || !canDefend} onClick={onDefend}>
        Defend
      </button>
    </ParticipantCardShell>
  );
}

/** Another party member's card — engage is never available for someone else's character; the
 *  only action ever shown is Help, and only if the viewer has their own participant in the fight
 *  with Rapport to spend. `canControl` still varies by viewer (true for a GM, false otherwise). */
export function AllyPCCard({
  participant,
  statuses,
  canControl,
  canHelp,
  onSetAP,
  onReposition,
  onHelp,
  onRemove,
}: {
  participant: CombatParticipant;
  statuses: CharacterStatus[];
  canControl: boolean;
  canHelp: boolean;
  onSetAP: (n: number) => void;
  onReposition: (deltaBands: number) => void;
  onHelp: () => void;
  onRemove: () => void;
}) {
  return (
    <ParticipantCardShell participant={participant} statuses={statuses} canControl={canControl} onSetAP={onSetAP} onReposition={onReposition} onRemove={onRemove}>
      {canHelp && (
        <button className={`tap-inline ${styles.actionButton}`} onClick={onHelp}>
          Help (&minus;1 Rapport)
        </button>
      )}
    </ParticipantCardShell>
  );
}

/** An Enemy's card. No sheet to roll against, so the GM reports the tier directly — Engage is
 *  gated on the same `canControl` flag as everything else here rather than a separate prop, since
 *  they were always the same value (`isGM`). Never Recuperate/Defend/Help, so no handlers for any
 *  of those need to exist at all — the enemy call site no longer has to pass no-ops.
 *
 *  A Boss additionally gets a Gambit-charge stepper (its own numbered pool, not simulated Gambit
 *  content — see CLAUDE.md's "minimal wiring" scope) and a Last Stand badge/control: reaching a
 *  Limit doesn't auto-set `Defeated` for a Boss the way it does for an ordinary enemy
 *  (`EncounterView.tsx`'s `t.IsBoss` guards), so the GM marks it defeated manually once the
 *  fiction says the Boss actually goes down. */
export function EnemyCard({
  participant,
  statuses,
  canControl,
  onSetAP,
  onReposition,
  onEngageMelee,
  onEngageRanged,
  onSetGambitCharges,
  onMarkDefeated,
  onRemove,
}: {
  participant: CombatParticipant;
  statuses: CharacterStatus[];
  canControl: boolean;
  onSetAP: (n: number) => void;
  onReposition: (deltaBands: number) => void;
  onEngageMelee: () => void;
  onEngageRanged: () => void;
  onSetGambitCharges: (n: number) => void;
  onMarkDefeated: () => void;
  onRemove: () => void;
}) {
  const hasAP = participant.ActionPointsRemaining > 0;
  const lastStand = !!participant.IsBoss && !participant.Defeated && isEnemyDefeated(statuses, participant.StatusLimits);
  const charges = participant.GambitCharges ?? 0;
  return (
    <ParticipantCardShell
      participant={participant}
      statuses={statuses}
      canControl={canControl}
      onSetAP={onSetAP}
      onReposition={onReposition}
      onRemove={onRemove}
      extraBadges={lastStand ? <span className={styles.badge}>Last Stand</span> : null}
    >
      {participant.IsBoss && (
        <div className={styles.apRow}>
          <span className={styles.apLabel}>Gambit Charges {charges}</span>
          {canControl && (
            <>
              <button className={`tap-inline ${styles.rangeButton}`} disabled={charges <= 0} onClick={() => onSetGambitCharges(charges - 1)}>
                &minus;
              </button>
              <button className={`tap-inline ${styles.rangeButton}`} onClick={() => onSetGambitCharges(charges + 1)}>
                &#43;
              </button>
            </>
          )}
        </div>
      )}
      {canControl && (
        <>
          <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || participant.Range !== 'Melee'} onClick={onEngageMelee}>
            Engage in Melee
          </button>
          <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || participant.Range === 'OutOfRange'} onClick={onEngageRanged}>
            Engage at Range
          </button>
          {lastStand && (
            <button className={`tap-inline ${styles.actionButton}`} onClick={onMarkDefeated}>
              Mark Defeated
            </button>
          )}
        </>
      )}
    </ParticipantCardShell>
  );
}

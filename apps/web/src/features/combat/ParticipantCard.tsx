import { useState, type ReactNode } from 'react';
import { isEnemyDefeated, isEnemyUnstable, isUnstable, maxActionPoints, statusRank, type CharacterStatus, type CombatParticipant, type EnemyStrainMark } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { InfoTooltip, TooltipSection } from '../../components/InfoTooltip.js';
import styles from './ParticipantCard.module.css';

/** The name/badges/Range/AP/status-badges/remove-confirm chrome every participant card shares,
 *  regardless of which of the three variants below it is. `canControl` stays a real prop here
 *  (not folded into "which variant") since it's an orthogonal permission — both an own-PC card
 *  and an enemy card can have it true, and it varies per viewer for both].  Each variant supplies
 *  its own action buttons as plain children rather than through a render prop — none of them need
 *  anything from the shell's internals beyond what they already have from `participant`.
 *
 *  `statusBadges`/`unstable` are pre-rendered/pre-computed by the caller (V0.6 slice 1) rather
 *  than raw data the shell interprets itself: a PC's own Statuses (severity slots) and an
 *  Enemy's Strain marks (named counting tracks — see `EnemyStrainMark`) are now two genuinely
 *  different shapes, so there is no longer one shared rendering rule to hide in here. */
function ParticipantCardShell({
  participant,
  statusBadges,
  unstable,
  canControl,
  onSetAP,
  onReposition,
  onRemove,
  onToggleImmobilized,
  onRemoveBane,
  extraBadges,
  children,
}: {
  participant: CombatParticipant;
  statusBadges: ReactNode;
  unstable: boolean;
  canControl: boolean;
  onSetAP: (n: number) => void;
  onReposition: (deltaBands: number) => void;
  onRemove: () => void;
  onToggleImmobilized?: () => void;
  /** Removes a Bane the enemy was given (Impede's lasts "while its fictional cause remains", so the
   *  GM takes it off when that's gone). */
  onRemoveBane?: (index: number) => void;
  extraBadges?: ReactNode;
  children: ReactNode;
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
        {unstable && <span className={styles.badge}>Unstable</span>}
        {participant.Surprised && <span className={styles.badge}>Surprised</span>}
        {participant.Fortified && <span className={styles.badge}>Fortified</span>}
        {participant.Halted && <span className={styles.badge}>Halted</span>}
        {participant.Immobilized && <span className={styles.badge}>Immobilized</span>}
        {participant.PrepareNextTurn && <span className={styles.badge}>Prepared — 4 AP next turn</span>}
        {(participant.Banes ?? []).map((bane, i) =>
          canControl && onRemoveBane ? (
            <button key={i} type="button" className={`tap-inline ${styles.badge} ${styles.badgeButton}`} onClick={() => onRemoveBane(i)} aria-label={`Remove the ${bane} Bane`}>
              Bane: {bane} &times;
            </button>
          ) : (
            <span key={i} className={styles.badge}>Bane: {bane}</span>
          ),
        )}
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
          <span className={styles.apLabel}>AP {ap}/{maxActionPoints(participant)}</span>
          {canControl && (
            <>
              <button className={`tap-inline ${styles.rangeButton}`} disabled={ap <= 0} onClick={() => onSetAP(Math.max(0, ap - 1))}>
                &minus;
              </button>
              <button className={`tap-inline ${styles.rangeButton}`} disabled={ap >= maxActionPoints(participant)} onClick={() => onSetAP(Math.min(maxActionPoints(participant), ap + 1))}>
                &#43;
              </button>
            </>
          )}
        </div>
      </div>
      {(participant.Kind === 'PC' || (canControl && onToggleImmobilized)) && (
        <div className={`tap-row ${styles.meta}`}>
          {/* "A Hero's normal Speed is 6." An enemy's Speed comes with its stat block (slice 7). */}
          {participant.Kind === 'PC' && <span className={styles.speed}>{participant.Immobilized ? 'Speed 0 (Immobilized)' : 'Speed 6'}</span>}
          {canControl && onToggleImmobilized && (
            <button
              className={`tap-inline ${styles.rangeButton}`}
              onClick={onToggleImmobilized}
              aria-pressed={!!participant.Immobilized}
              title="Toggle Immobilized"
            >
              Immobilized
            </button>
          )}
        </div>
      )}
      {(participant.Immobilized || participant.Halted) && (
        <div className={styles.warning}>
          {participant.Immobilized
            ? 'Immobilized — no voluntary movement; forced movement still works.'
            : 'Halted — can\'t move voluntarily this turn.'}
        </div>
      )}

      {statusBadges}

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

/** A PC's own Statuses (severity slots) — shared by `OwnPCCard`/`AllyPCCard`. Major/Severe read
 *  as the more urgent colour; Minor stays the plain/neutral treatment. */
function statusBadgesForPC(statuses: CharacterStatus[]) {
  if (statuses.length === 0) return null;
  return (
    <div className={styles.statuses}>
      {statuses.map((s) => (
        <span key={s.Id} className={`${styles.status} ${s.Severity === 'Minor' ? '' : styles.statusNegative}`}>
          {s.Name} ({s.Severity})
        </span>
      ))}
    </div>
  );
}

/** An Enemy's own Strain marks (named counting tracks) — see `EnemyStrainMark`. */
function statusBadgesForEnemy(tracks: EnemyStrainMark[]) {
  if (tracks.length === 0) return null;
  return (
    <div className={styles.statuses}>
      {tracks.map((t) => (
        <span key={t.Id} className={`${styles.status} ${styles.statusNegative}`}>
          {t.Name} {statusRank(t)}
        </span>
      ))}
    </div>
  );
}

/** Your own character's card — always controllable and engageable by definition, so neither is a
 *  prop here. The only variant that shows Recuperate, Prepare, and Break. */
export function OwnPCCard({
  participant,
  statuses,
  canRecuperate,
  onSetAP,
  onReposition,
  onEngageMelee,
  onEngageRanged,
  onRecuperate,
  onPrepare,
  onBreak,
  onToggleImmobilized,
  onRemove,
}: {
  participant: CombatParticipant;
  statuses: CharacterStatus[];
  canRecuperate: boolean;
  onSetAP: (n: number) => void;
  onReposition: (deltaBands: number) => void;
  onEngageMelee: () => void;
  onEngageRanged: () => void;
  onRecuperate: () => void;
  onPrepare: () => void;
  onBreak: () => void;
  onToggleImmobilized?: () => void;
  onRemove: () => void;
}) {
  const hasAP = participant.ActionPointsRemaining > 0;
  return (
    <ParticipantCardShell
      participant={participant}
      statusBadges={statusBadgesForPC(statuses)}
      unstable={isUnstable(statuses)}
      canControl
      onSetAP={onSetAP}
      onReposition={onReposition}
      onToggleImmobilized={onToggleImmobilized}
      onRemove={onRemove}
    >
      <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || participant.Range !== 'Melee'} onClick={onEngageMelee}>
        Engage in Melee
      </button>
      <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || participant.Range === 'OutOfRange'} onClick={onEngageRanged}>
        Engage at Range
      </button>
      <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || !canRecuperate} onClick={onRecuperate}>
        Recuperate
      </button>
      <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP || participant.PrepareNextTurn} onClick={onPrepare} title={participant.PrepareNextTurn ? 'Prepare does not stack with itself' : ''}>
        Prepare (1 AP)
      </button>
      {participant.Immobilized && (
        <button className={`tap-inline ${styles.actionButton}`} disabled={!hasAP} onClick={onBreak}>
          Break (1 AP)
        </button>
      )}
    </ParticipantCardShell>
  );
}

/** Another party member's card — engage is never available for someone else's character; the
 *  only action ever shown is Aid, and only if the viewer has their own participant in the fight
 *  with Rapport to spend. `canControl` still varies by viewer (true for a GM, false otherwise). */
export function AllyPCCard({
  participant,
  statuses,
  canControl,
  canAid,
  canBreakFree,
  onSetAP,
  onReposition,
  onAid,
  onBreakFree,
  onToggleImmobilized,
  onRemove,
}: {
  participant: CombatParticipant;
  statuses: CharacterStatus[];
  canControl: boolean;
  canAid: boolean;
  canBreakFree?: boolean;
  onSetAP: (n: number) => void;
  onReposition: (deltaBands: number) => void;
  onAid: () => void;
  onBreakFree?: () => void;
  onToggleImmobilized?: () => void;
  onRemove: () => void;
}) {
  return (
    <ParticipantCardShell
      participant={participant}
      statusBadges={statusBadgesForPC(statuses)}
      unstable={isUnstable(statuses)}
      canControl={canControl}
      onSetAP={onSetAP}
      onReposition={onReposition}
      onToggleImmobilized={onToggleImmobilized}
      onRemove={onRemove}
    >
      {canAid && (
        <button className={`tap-inline ${styles.actionButton}`} onClick={onAid}>
          Aid (&minus;1 Rapport)
        </button>
      )}
      {canBreakFree && onBreakFree && participant.Immobilized && (
        <button className={`tap-inline ${styles.actionButton}`} onClick={onBreakFree}>
          Break free (1 AP)
        </button>
      )}
    </ParticipantCardShell>
  );
}

/** An Enemy's card. Enemies attack with a typed Strain amount — the GM selects the track and
 *  amount in the Engage modal. Engage is gated on `canControl` (the GM only) rather than a
 *  separate prop, since they're always the same. Never Recuperate/Aid/Break, so no handlers for
 *  those need to exist.
 *
 *  A Boss additionally gets a Gambit-charge stepper (its own numbered pool, not simulated Gambit
 *  content — see CLAUDE.md's "minimal wiring" scope) and a Last Stand badge/control: reaching a
 *  Strain Limit doesn't auto-set `Defeated` for a Boss the way it does an ordinary enemy
 *  (`EncounterView.tsx`'s `t.IsBoss` guards), so the GM marks it defeated manually once the
 *  fiction says so. */
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
  onToggleImmobilized,
  onRemoveBane,
  onRemove,
}: {
  participant: CombatParticipant;
  statuses: EnemyStrainMark[];
  canControl: boolean;
  onSetAP: (n: number) => void;
  onReposition: (deltaBands: number) => void;
  onEngageMelee: () => void;
  onEngageRanged: () => void;
  onSetGambitCharges: (n: number) => void;
  onMarkDefeated: () => void;
  onToggleImmobilized?: () => void;
  onRemoveBane?: (index: number) => void;
  onRemove: () => void;
}) {
  const hasAP = participant.ActionPointsRemaining > 0;
  const lastStand = !!participant.IsBoss && !participant.Defeated && isEnemyDefeated(statuses, participant.StatusLimits);
  const charges = participant.GambitCharges ?? 0;
  return (
    <ParticipantCardShell
      participant={participant}
      statusBadges={statusBadgesForEnemy(statuses)}
      unstable={isEnemyUnstable(statuses, participant.StatusLimits)}
      canControl={canControl}
      onSetAP={onSetAP}
      onReposition={onReposition}
      onToggleImmobilized={onToggleImmobilized}
      onRemoveBane={onRemoveBane}
      onRemove={onRemove}
      extraBadges={
        <>
          {participant.IsBoss && (
            <InfoTooltip label="Boss Strain assumption">
              <TooltipSection label="Read as Strain">
                This Boss's Strain Limits, and any attack text written in Ranks ("1d6 Wounded"),
                are read as Strain — the migration plan's own mapping for how Combat's un-rewritten
                rules text should translate. The ruleset's own Combat chapter was never rewritten
                for Strain, and its Villain template still carries a literal "Set Status Limits.
                !! UPDATE" marker, so this is a documented assumption, not a settled rule — it may
                change once that gets revisited.
              </TooltipSection>
            </InfoTooltip>
          )}
          {lastStand && <span className={styles.badge}>Last Stand</span>}
        </>
      }
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

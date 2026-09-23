import { useState, type ReactNode } from 'react';
import { maxActionPoints, effectiveEnemyVirtues, hasFreeStatusSlot, type CharacterStatus, type CombatParticipant, type Library, type PendingEnemyHit, type EnemyVirtue } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { StatusBoxes } from '../sheet/StatusBoxes.js';
import styles from './ParticipantCard.module.css';

/** The name/badges/Range/AP/status-badges/remove-confirm chrome every participant card shares,
 *  regardless of which of the three variants below it is. `canControl` stays a real prop here
 *  (not folded into "which variant") since it's an orthogonal permission — both an own-PC card
 *  and an enemy card can have it true, and it varies per viewer for both].  Each variant supplies
 *  its own action buttons as plain children rather than through a render prop — none of them need
 *  anything from the shell's internals beyond what they already have from `participant`.
 *
 *  `statusBadges` are pre-rendered/pre-computed by the caller (V0.6 slice 1) rather
 *  than raw data the shell interprets itself: a PC's own Statuses (severity slots) and an
 *  Enemy's Strain marks (named counting tracks — see `EnemyStrainMark`) are now two genuinely
 *  different shapes, so there is no longer one shared rendering rule to hide in here. */
function ParticipantCardShell({
  participant,
  statusBadges,
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
        {defeated && <span className={styles.defeatedBadge}>{participant.Kind === 'Enemy' ? 'Subdued' : 'Defeated'}</span>}
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

/** An Enemy's card (revised V0.6, slice 7). Shows the enemy's stat block, Strain track, Conditions,
 *  Status slots, and Virtues. The GM sees pending hits waiting to resolve and controls attacks.
 *  Players see "Waiting on the GM" for pending hits instead.
 */
export function EnemyCard({
  participant,
  library,
  canControl,
  pendingHits,
  onSetAP,
  onReposition,
  onAttack,
  onResolveHit,
  onMarkCondition,
  onClearCondition,
  onSetMinionCount,
  onSetGambitCharges,
  onToggleImmobilized,
  onRemoveBane,
  onRemove,
}: {
  participant: CombatParticipant;
  library: Library;
  canControl: boolean;
  pendingHits: PendingEnemyHit[];
  onSetAP: (n: number) => void;
  onReposition: (deltaBands: number) => void;
  onAttack: () => void;
  onResolveHit: (hitId: string, negateNote: string | null) => void;
  onMarkCondition: (virtueId: string) => void;
  onClearCondition: (virtueId: string) => void;
  onSetMinionCount: (n: number) => void;
  onSetGambitCharges: (n: number) => void;
  onToggleImmobilized?: () => void;
  onRemoveBane?: (index: number) => void;
  onRemove: () => void;
}) {
  const hasAP = participant.ActionPointsRemaining > 0;
  const isMinionGroup = participant.Stats?.Profile === 'Minion';
  const isLegendary = participant.Stats?.Profile === 'Legendary';
  const minionCount = participant.MinionCount ?? 1;
  const gambitCharges = participant.GambitCharges ?? 0;
  const strain = participant.Strain ?? [];
  const statusNotes = participant.StatusNotes ?? [];
  const conditionsMarked = participant.ConditionsMarked ?? [];
  const [negatingHitId, setNegatingHitId] = useState<string | null>(null);
  const [negatingNote, setNegatingNote] = useState('');

  const effectiveVirtues = participant.Stats ? effectiveEnemyVirtues(participant.Stats, conditionsMarked) : [];
  const strainBoxes = participant.Stats ? Math.max(1, participant.Stats.StrainBoxes) : 0;
  const freeStatusSlots = participant.Stats ? participant.Stats.StatusSlots - statusNotes.length : 0;

  const extraBadges = (
    <>
      {participant.Stats && (
        <>
          {participant.Stats.Profile !== 'Minion' && <span className={styles.badge}>{participant.Stats.Profile}</span>}
          {participant.Stats.Profile === 'Minion' && <span className={styles.badge}>Minion ×{minionCount}</span>}
          <span className={styles.badge}>Threat {participant.Stats.Threat}</span>
          <span className={styles.badge}>{participant.Stats.Size}</span>
          {participant.Stats.Guard > 0 && <span className={styles.badge}>Guard {participant.Stats.Guard}</span>}
          {participant.Stats.Unshakable && <span className={styles.badge}>Unshakable</span>}
          {isLegendary && participant.Phase && <span className={styles.badge}>{participant.Phase === 'LastStand' ? `Last Stand (${participant.Stats.LastStandBoxes})` : participant.Phase}</span>}
        </>
      )}
      {participant.Crumbled && <span className={styles.badge}>Crumbled</span>}
    </>
  );

  return (
    <ParticipantCardShell
      participant={participant}
      statusBadges={null}
      canControl={canControl}
      onSetAP={onSetAP}
      onReposition={onReposition}
      onToggleImmobilized={onToggleImmobilized}
      onRemoveBane={onRemoveBane}
      onRemove={onRemove}
      extraBadges={extraBadges}
    >
      {/* Strain boxes */}
      {!isMinionGroup && strainBoxes > 0 && (
        <div className={styles.strainRow}>
          <label className={styles.strainLabel}>Strain</label>
          <StatusBoxes marks={strain.slice(0, strainBoxes)} color="var(--danger)" size={18} onToggle={() => {}} />
        </div>
      )}

      {/* Status slots */}
      {participant.Stats && participant.Stats.StatusSlots > 0 && (
        <div className={styles.statusSlots}>
          {statusNotes.map((note, i) => (
            <span key={i} className={`${styles.status} ${styles.statusNegative}`}>
              {note}
            </span>
          ))}
          {freeStatusSlots > 0 && <span className={styles.statusSlot}>{freeStatusSlots} free Status slot{freeStatusSlots !== 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* Conditions */}
      {participant.Stats && (
        <div className={styles.conditionsSection}>
          {participant.Stats.Unshakable ? (
            <span className={styles.unshakableText}>Unshakable — can't mark Conditions</span>
          ) : (
            <>
              <div className={styles.conditionsRow}>
                {library.conditions.map((cond) => {
                    const isMarked = conditionsMarked.includes(cond.VirtueId);
                    return (
                      <button
                        key={cond.Id}
                        type="button"
                        className={`tap-inline ${styles.conditionToggle}`}
                        aria-pressed={isMarked}
                        onClick={() => {
                          if (isMarked) {
                            onClearCondition(cond.VirtueId);
                          } else {
                            onMarkCondition(cond.VirtueId);
                          }
                        }}
                      >
                        {cond.Name}
                      </button>
                    );
                  })}
              </div>
              <span className={styles.conditionHint}>
                Crumbles {isMinionGroup ? 'on any' : `at ${participant.Stats.ConditionSlots}`}
              </span>
            </>
          )}
        </div>
      )}

      {/* Virtues */}
      {effectiveVirtues.length > 0 && (
        <div className={styles.virtuesRow}>
          {effectiveVirtues.map((v: EnemyVirtue) => {
            const virtue = library.virtues.find((lib) => lib.Id === v.VirtueId);
            if (!virtue) return null;
            const rating = v.Rating;
            const sign = rating > 0 ? '+' : rating < 0 ? '−' : '';
            const marks = sign ? sign.repeat(Math.abs(rating)) : '';
            return (
              <span key={v.VirtueId} className={styles.virtue}>
                {virtue.Name} {marks}
              </span>
            );
          })}
        </div>
      )}

      {/* Pending hits */}
      {canControl && pendingHits.length > 0 && (
        <div className={styles.pendingHits}>
          {pendingHits.map((hit) => (
            <div key={hit.Id} className={styles.pendingHit}>
              <div className={styles.pendingHitText}>
                {hit.Amount} Strain incoming — {hit.Note}
              </div>
              <div className={styles.pendingHitActions}>
                <button
                  type="button"
                  className={`tap-inline ${styles.actionButton}`}
                  onClick={() => onResolveHit(hit.Id, null)}
                >
                  Mark it
                </button>
                {negatingHitId === hit.Id ? (
                  <div className={styles.negateForm}>
                    <input
                      type="text"
                      className={styles.negateInput}
                      placeholder="Describe the lasting wound"
                      value={negatingNote}
                      onChange={(e) => setNegatingNote(e.currentTarget.value)}
                      aria-label="Describe the lasting wound"
                    />
                    <button
                      type="button"
                      className={`tap-inline ${styles.actionButton}`}
                      disabled={!negatingNote || !hasFreeStatusSlot(participant)}
                      onClick={() => {
                        onResolveHit(hit.Id, negatingNote);
                        setNegatingHitId(null);
                        setNegatingNote('');
                      }}
                    >
                      Confirm
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`tap-inline ${styles.actionButton}`}
                    disabled={!hasFreeStatusSlot(participant)}
                    onClick={() => setNegatingHitId(hit.Id)}
                    title={hasFreeStatusSlot(participant) ? '' : 'No free Status slots'}
                  >
                    Negate with Status
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!canControl && pendingHits.length > 0 && (
        <div className={styles.pendingHitsPlayer}>
          {pendingHits.map((hit) => (
            <div key={hit.Id} className={styles.status}>
              Waiting on the GM: {hit.Amount} Strain
            </div>
          ))}
        </div>
      )}

      {/* Stat block / Attacks and Abilities */}
      {participant.Stats && (participant.Stats.Attacks.length > 0 || participant.Stats.Abilities) && (
        <details className={styles.statBlockDetails}>
          <summary className={styles.statBlockSummary}>Stat block</summary>
          {participant.Stats.Attacks.length > 0 && (
            <div className={styles.attacks}>
              {participant.Stats.Attacks.map((attack, i) => (
                <div key={i} className={styles.attack}>
                  <strong>{attack.Name}</strong> — Strain {attack.Strain} · Range {attack.Range} · Resist:{' '}
                  {attack.ResistVirtueIds.map((vid) => library.virtues.find((v) => v.Id === vid)?.Name).filter(Boolean).join(' or ')}
                  {attack.AdditionalEffect && ` · +${attack.AdditionalEffect} (${attack.EffectTrigger})`}
                </div>
              ))}
            </div>
          )}
          {participant.Stats.Abilities && (
            <div className={styles.abilities}>{participant.Stats.Abilities}</div>
          )}
        </details>
      )}

      {/* GM actions */}
      {canControl && (
        <div className={styles.gmActions}>
          <button
            type="button"
            className={`tap-inline ${styles.actionButton}`}
            disabled={!hasAP || participant.Defeated}
            onClick={onAttack}
          >
            Attack
          </button>
          {isMinionGroup && (
            <div className={styles.minionStepper}>
              <button
                type="button"
                className={`tap-inline ${styles.rangeButton}`}
                disabled={minionCount <= 0}
                onClick={() => onSetMinionCount(Math.max(0, minionCount - 1))}
                aria-label="Decrease minion count"
              >
                &minus;
              </button>
              <span className={styles.minionCount}>{minionCount}</span>
              <button
                type="button"
                className={`tap-inline ${styles.rangeButton}`}
                onClick={() => onSetMinionCount(minionCount + 1)}
                aria-label="Increase minion count"
              >
                &#43;
              </button>
            </div>
          )}
          {gambitCharges > 0 && (
            <div className={styles.gambitStepper}>
              <button
                type="button"
                className={`tap-inline ${styles.rangeButton}`}
                disabled={gambitCharges <= 0}
                onClick={() => onSetGambitCharges(Math.max(0, gambitCharges - 1))}
                aria-label="Decrease gambit charges"
              >
                &minus;
              </button>
              <span className={styles.gambitLabel}>Gambit {gambitCharges}</span>
              <button
                type="button"
                className={`tap-inline ${styles.rangeButton}`}
                onClick={() => onSetGambitCharges(gambitCharges + 1)}
                aria-label="Increase gambit charges"
              >
                &#43;
              </button>
            </div>
          )}
          {onToggleImmobilized && (
            <button
              type="button"
              className={`tap-inline ${styles.actionButton}`}
              aria-pressed={!!participant.Immobilized}
              onClick={onToggleImmobilized}
              title="Toggle Immobilized"
            >
              Immobilized
            </button>
          )}
          {onRemoveBane && (participant.Banes ?? []).length > 0 && (
            <div className={styles.baneRemoval}>
              {(participant.Banes ?? []).map((bane, i) => (
                <button
                  key={i}
                  type="button"
                  className={`tap-inline ${styles.baneButton}`}
                  onClick={() => onRemoveBane(i)}
                  aria-label={`Remove the ${bane} Bane`}
                >
                  Remove {bane}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </ParticipantCardShell>
  );
}

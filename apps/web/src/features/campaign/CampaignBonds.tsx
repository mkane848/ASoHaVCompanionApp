import { useState } from 'react';
import type { Bond, Character } from '@asohav/shared';
import { ForgeBondModal } from './ForgeBondModal.js';
import { PendingBondBadge } from '../../components/PendingBondBadge.js';
import { MarkKinModal } from '../../components/MarkKinModal.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './CampaignBonds.module.css';

const TYPE_LABELS: Record<string, string> = {
  MarkKin: 'proposes +1 Kin',
  SpendKin: 'a Kin',
  ForgeBond: 'proposes Forging the Bond',
};

function Pips({ count, filled }: { count: number; filled: number }) {
  return (
    <div className={styles.pips}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`${styles.pip} ${i < filled ? styles.pipFilled : ''}`} />
      ))}
    </div>
  );
}

export function CampaignBonds({
  bonds,
  characters,
  myCharacterId,
  archived,
  onPropose,
  onAccept,
  onReject,
}: {
  bonds: Bond[];
  characters: Character[];
  myCharacterId: string;
  /** The campaign is archived — the server rejects every Bond write regardless, so the propose/
   *  accept/decline/withdraw controls are hidden rather than left to fail silently on tap. */
  archived?: boolean;
  onPropose: (bondId: string, type: 'MarkKin' | 'SpendKin' | 'ForgeBond', payload: Record<string, unknown>, note?: string) => void;
  onAccept: (bondId: string) => void;
  onReject: (bondId: string, withdrawn: boolean) => void;
}) {
  const matcher = useGlossaryMatcher();
  const [forging, setForging] = useState<{ bondId: string; partnerName: string } | null>(null);
  const [markingKin, setMarkingKin] = useState<{ bondId: string; partnerName: string } | null>(null);
  const mine = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);
  const partnerName = (b: Bond) => {
    const otherId = b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId;
    return characters.find((c) => c.Id === otherId)?.Name ?? 'Unknown';
  };

  const incoming = mine.filter((b) => b.PendingChange && b.PendingChange.ProposedBy !== myCharacterId);
  const outgoing = mine.filter((b) => b.PendingChange && b.PendingChange.ProposedBy === myCharacterId);

  return (
    <div className={styles.column}>
      {incoming.length > 0 && (
        <div className={`${styles.box} ${styles.boxIncoming}`}>
          <h2 className={styles.heading}>Awaiting your confirmation</h2>
          <p className={styles.blurb}>A Bond is shared, so changes need both of you. Nothing lands until you accept.</p>
          {incoming.map((b) => (
            <div key={b.Id} className={styles.incoming}>
              <div className={styles.incomingTitle}>
                {partnerName(b)} &middot; {TYPE_LABELS[b.PendingChange!.Type]}
              </div>
              <p className={styles.note}>
                &ldquo;{b.PendingChange!.Note ? <GlossaryText text={b.PendingChange!.Note} matcher={matcher} /> : 'No note given.'}&rdquo;
              </p>
              {archived ? (
                <p className={styles.blurb}>This campaign is archived — unarchive it to answer this.</p>
              ) : (
                <div className={styles.answerRow}>
                  <button className={styles.accept} onClick={() => onAccept(b.Id)}>
                    Accept
                  </button>
                  <button className={`tap-inline ${styles.decline}`} onClick={() => onReject(b.Id, false)}>
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.box}>
        <div className={styles.headingRow}>
          <h2 className={styles.headingInline}>Bonds</h2>
          <PendingBondBadge count={incoming.length} />
          <div className={styles.rule} />
        </div>
        <p className={styles.blurb}>Each Bond is one shared record. A Bond with a change in flight is locked until it settles.</p>
        {mine.map((b) => {
          const p = b.PendingChange;
          return (
            <div key={b.Id} className={styles.bond}>
              <div className={styles.bondHead}>
                <span className={`wrap-anywhere ${styles.partner}`}>{partnerName(b)}</span>
                <Pips count={5} filled={b.KinTrack} />
                <span className={styles.bondLevel}>Bond {b.BondLevel}</span>
              </div>

              {p ? (
                <div className={styles.pending}>
                  {p.ProposedBy === myCharacterId
                    ? `Waiting on ${partnerName(b)} to confirm your proposal.`
                    : `${partnerName(b)} ${TYPE_LABELS[p.Type]} — answer it above.`}
                </div>
              ) : archived ? null : (
                <div className={`tap-row ${styles.actions}`}>
                  <button className={`tap-inline ${styles.propose}`} onClick={() => setMarkingKin({ bondId: b.Id, partnerName: partnerName(b) })}>Propose +1 Kin</button>
                  <button
                    className={`tap-inline ${styles.propose}`}
                    title="Spending a Kin is unilateral — it happens immediately, no confirmation needed."
                    onClick={() => onPropose(b.Id, 'SpendKin', { Delta: 1 }, 'I need this from you.')}
                  >
                    Spend a Kin
                  </button>
                  {b.KinTrack >= 5 && (
                    <button className={`tap-inline ${styles.propose} ${styles.proposeStrong}`} onClick={() => setForging({ bondId: b.Id, partnerName: partnerName(b) })}>
                      Propose Forge
                    </button>
                  )}
                </div>
              )}

              {b.BondMoves.map((m, i) => (
                <div key={i} className={styles.bondMove}>
                  <div className={styles.bondMoveLevel}>Bond {m.Level}</div>
                  <div className={styles.bondMoveText}><GlossaryText text={m.Text} matcher={matcher} /></div>
                </div>
              ))}

              {b.History.length > 0 && (
                <div className={styles.history}>
                  <div className={styles.historyLabel}>History</div>
                  {b.History.slice(0, 6).map((e, i) => {
                    const who = characters.find((c) => c.Id === e.By);
                    return (
                      <div key={i} className={styles.historyRow}>
                        <span>{(who ? who.Name : 'Someone')} {e.Action} {(TYPE_LABELS[e.Type] || e.Type).replace('proposes ', '')}</span>
                        {e.Note && <span className={styles.historyNote}><GlossaryText text={e.Note} matcher={matcher} /></span>}
                        <span className={styles.historyWhen}>{new Date(e.At).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {outgoing.length > 0 && (
        <div className={`${styles.box} ${styles.boxOutgoing}`}>
          <h2 className={styles.heading}>Waiting on others</h2>
          <p className={styles.blurb}>You proposed these. They're locked until the other player answers &mdash; withdraw if it's gone stale.</p>
          {outgoing.map((b) => (
            <div key={b.Id} className={styles.outgoingRow}>
              <span className={styles.outgoingLabel}>
                {partnerName(b)} &middot; {(TYPE_LABELS[b.PendingChange!.Type] || 'a change').replace('proposes ', '')}
              </span>
              {!archived && (
                <button className={`tap-inline ${styles.withdraw}`} onClick={() => onReject(b.Id, true)}>
                  Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {forging && (
        <ForgeBondModal
          partnerName={forging.partnerName}
          onClose={() => setForging(null)}
          onSubmit={(text) => {
            onPropose(forging.bondId, 'ForgeBond', { Text: text }, "Let's forge it.");
            setForging(null);
          }}
        />
      )}

      {markingKin && (
        <MarkKinModal
          partnerName={markingKin.partnerName}
          onClose={() => setMarkingKin(null)}
          onSubmit={(note) => {
            onPropose(markingKin.bondId, 'MarkKin', { Delta: 1 }, note);
            setMarkingKin(null);
          }}
        />
      )}
    </div>
  );
}


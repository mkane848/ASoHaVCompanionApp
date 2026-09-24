import { useState } from 'react';
import type { Bond, Character, Library } from '@asohav/shared';
import { BOND_SPEND_OPTIONS, pendingBondCountFor } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { PendingBondBadge } from '../../components/PendingBondBadge.js';
import { MarkBondModal } from '../../components/MarkBondModal.js';
import { ForgeBondModal } from '../campaign/ForgeBondModal.js';
import { HistoryModal, type HistoryEntry } from '../../components/HistoryModal.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { Link, useParams } from 'react-router';
import styles from './ConnectionsPanel.module.css';

const TYPE_LABELS: Record<string, string> = {
  MarkBond: 'proposes +1 Bond',
  SpendBond: 'a Bond',
  ForgeBond: 'proposes Forging the Bond',
  SetConnectionTag: 'proposes updating the Connection Tag',
};

function ReadonlyPips({ count, filled, color }: { count: number; filled: number; color: string }) {
  return (
    <div className={styles.readonlyPips}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={styles.readonlyPip} style={i < filled ? { borderColor: color, background: color } : undefined} />
      ))}
    </div>
  );
}

/** The viewer's Connections (revised V0.6 slice 5, updated slice 8) — one per other Hero, each
 *  with the pair's Connection Tag, its Bond track and its Connection Improvements. Marking and
 *  Forging are handshakes the partner accepts; spending is unilateral. Rewriting the Connection
 *  Tag is the Camp Action "If both Heroes agree their Connection Tag no longer describes them,
 *  rewrite it and mark a Bond" (a `SetConnectionTag` with Delta 1), taken from the Camp Actions
 *  dialog. A pair first agrees its tag on the Party page. Replaced the Bonds section of
 *  `AdvancementPanel`. */
export function ConnectionsPanel({
  bonds,
  characters,
  myCharacterId,
  library,
  archived,
  onPropose,
  onAccept,
  onReject,
}: {
  bonds: Bond[];
  characters: Character[];
  myCharacterId: string;
  library: Library;
  archived?: boolean;
  onPropose: (bondId: string, type: string, payload: Record<string, unknown>, note?: string) => void;
  onAccept: (bondId: string) => void;
  onReject: (bondId: string, withdrawn: boolean) => void;
}) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const matcher = useGlossaryMatcher();
  const bondLen = library.settings.BondTrackLength;

  const myBonds = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);

  const [markingBond, setMarkingBond] = useState<{ bondId: string; partnerName: string } | null>(null);
  const [forgingBond, setForgingBond] = useState<{ bondId: string; partnerName: string; currentTag: string } | null>(null);
  const [openHistory, setOpenHistory] = useState<{ title: string; entries: HistoryEntry[] } | null>(null);
  const [spendingBondId, setSpendingBondId] = useState<string | null>(null);

  function spendBond(bondId: string, note: string) {
    onPropose(bondId, 'SpendBond', { Delta: 1 }, note);
    setSpendingBondId(null);
  }

  function proposeForge(bondId: string, improvement: string, newTag: string | null) {
    const payload: Record<string, unknown> = { Text: improvement };
    if (newTag !== null) {
      payload.ConnectionTag = newTag;
    }
    onPropose(bondId, 'ForgeBond', payload, "Let's forge it.");
    setForgingBond(null);
  }

  return (
    <Panel id="p-connections" collapseId="connections" primary>
      <PanelHeader extra={<PendingBondBadge count={pendingBondCountFor(myBonds, myCharacterId)} />}>Connections</PanelHeader>

      <div className={styles.connectionsBox}>
        {myBonds.length === 0 ? (
          <p className={styles.noConnections}>You're not yet paired with another hero — the Party page will show when others join.</p>
        ) : (
          myBonds.map((b) => {
            const otherId = b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId;
            const other = characters.find((c) => c.Id === otherId);
            const p = b.PendingChange;
            const mineProposed = p && p.ProposedBy === myCharacterId;

            return (
              <div key={b.Id} className={styles.connection}>
                <div className={styles.connectionHead}>
                  <div className={`wrap-anywhere ${styles.partner}`}>{other?.Name ?? 'Unknown'}</div>
                  <ReadonlyPips count={bondLen} filled={b.BondTrack} color="var(--gold)" />
                </div>

                <div className={styles.tag}>
                  {b.ConnectionTag ? (
                    <span className={styles.tagText}>{b.ConnectionTag}</span>
                  ) : (
                    <span className={styles.tagPlaceholder}>
                      No Connection Tag yet — agree one on the{' '}
                      <Link to={`/c/${campaignId}/party`} className={`tap-inline ${styles.tagLink}`}>
                        Party page
                      </Link>
                    </span>
                  )}
                </div>

                {b.BondMoves.length > 0 && (
                  <div className={styles.improvements}>
                    <div className={styles.improvementsLabel}>Connection Improvements</div>
                    {b.BondMoves.map((m, i) => (
                      <div key={i} className={styles.improvementItem}>
                        <div className={styles.improvementText}>
                          <GlossaryText text={m.Text} matcher={matcher} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {p ? (
                  <div className={styles.pending}>
                    {mineProposed ? (
                      <>
                        <div>Waiting on {other?.Name ?? 'them'} to confirm your proposal.</div>
                        {!archived && (
                          <div className={`action-grid ${styles.actions}`}>
                            <button className={`tap-inline ${styles.withdraw}`} onClick={() => onReject(b.Id, true)}>
                              Withdraw
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          {other?.Name ?? 'They'} {TYPE_LABELS[p.Type] ?? 'proposed a change'} — &ldquo;
                          {p.Type === 'SetConnectionTag' ? p.Payload.Text : <GlossaryText text={p.Note} matcher={matcher} />}
                          &rdquo;
                        </div>
                        {p.Type === 'ForgeBond' && (
                          <div>
                            Connection Improvement: &ldquo;<GlossaryText text={p.Payload.Text ?? ''} matcher={matcher} />&rdquo;
                            {p.Payload.ConnectionTag ? <>, and the Connection Tag becomes &ldquo;{p.Payload.ConnectionTag}&rdquo;</> : null}
                          </div>
                        )}
                        {archived ? (
                          <p className={styles.rapportNote}>This campaign is archived — unarchive it to answer this.</p>
                        ) : (
                          <div className={`action-grid ${styles.actions}`}>
                            <button className={`tap-inline ${styles.accept}`} onClick={() => onAccept(b.Id)}>
                              Accept
                            </button>
                            <button className={`tap-inline ${styles.decline}`} onClick={() => onReject(b.Id, false)}>
                              Decline
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  !archived && (
                    <>
                      <div className={`action-grid ${styles.actions}`}>
                        <button
                          className={`tap-inline ${styles.propose}`}
                          onClick={() => setMarkingBond({ bondId: b.Id, partnerName: other?.Name ?? 'your partner' })}
                        >
                          Mark Bond
                        </button>
                        <button
                          className={`tap-inline ${styles.propose}`}
                          disabled={b.BondTrack <= 0}
                          title="Spending a Bond is unilateral — it happens immediately, no confirmation needed."
                          onClick={() => setSpendingBondId((cur) => (cur === b.Id ? null : b.Id))}
                        >
                          {spendingBondId === b.Id ? 'Cancel spend' : 'Spend Bond'}
                        </button>
                        {b.BondTrack >= bondLen && (
                          <button
                            className={`tap-inline ${styles.propose} ${styles.proposeStrong}`}
                            onClick={() =>
                              setForgingBond({
                                bondId: b.Id,
                                partnerName: other?.Name ?? 'your partner',
                                currentTag: b.ConnectionTag,
                              })
                            }
                          >
                            Forge a Bond
                          </button>
                        )}
                      </div>

                      {spendingBondId === b.Id && (
                        <div className={styles.spendMenu}>
                          <div className={styles.spendMenuLabel}>Choose what the spend does:</div>
                          {BOND_SPEND_OPTIONS.map((opt) => (
                            <button key={opt} type="button" className={`tap-inline ${styles.spendOption}`} onClick={() => spendBond(b.Id, opt)}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )
                )}

                {b.History.length > 0 && (
                  <button
                    type="button"
                    className={`tap-inline ${styles.historyTrigger}`}
                    onClick={() =>
                      setOpenHistory({
                        title: `Connection History — ${other?.Name ?? 'Unknown'}`,
                        entries: b.History.map((e) => {
                          const who = characters.find((c) => c.Id === e.By);
                          const label = (TYPE_LABELS[e.Type] || e.Type).replace('proposes ', '');
                          return { label: `${who ? who.Name : 'Someone'} ${e.Action} ${label}`, detail: e.Note, when: e.At };
                        }),
                      })
                    }
                  >
                    History ({b.History.length})
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {markingBond && (
        <MarkBondModal
          partnerName={markingBond.partnerName}
          onClose={() => setMarkingBond(null)}
          onSubmit={(note: string) => {
            onPropose(markingBond.bondId, 'MarkBond', { Delta: 1 }, note);
            setMarkingBond(null);
          }}
        />
      )}

      {forgingBond && (
        <ForgeBondModal
          partnerName={forgingBond.partnerName}
          currentTag={forgingBond.currentTag}
          onSubmit={(improvement: string, newTag: string | null) => {
            proposeForge(forgingBond.bondId, improvement, newTag);
          }}
          onClose={() => setForgingBond(null)}
        />
      )}

      {openHistory && (
        <HistoryModal
          title={openHistory.title}
          entries={openHistory.entries}
          matcher={matcher}
          onClose={() => setOpenHistory(null)}
        />
      )}
    </Panel>
  );
}

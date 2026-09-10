import { lazy, Suspense, useState } from 'react';
import type { Bond, Character, Library, Party, PartyAdvanceOption } from '@asohav/shared';
import { applyPartyRapportAdvance, isBondLocked, newId, nowIso, pendingBondCountFor } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { Pips } from './Pips.js';
import type { PickerState } from './pickerTypes.js';
import { PendingBondBadge } from '../../components/PendingBondBadge.js';
import { MarkBondModal } from '../../components/MarkBondModal.js';
import { HistoryModal, type HistoryEntry } from '../../components/HistoryModal.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './AdvancementPanel.module.css';

// Lazy — a rarely-triggered modal (only shown once a full Rapport track needs clearing), shared
// with EndSessionModal.tsx; see CharacterSheetPage.tsx's bundle-budget note.
const PartyAdvanceModal = lazy(() => import('./PartyAdvanceModal.js').then((m) => ({ default: m.PartyAdvanceModal })));

const TYPE_LABELS: Record<string, string> = {
  MarkBond: 'proposes +1 Bond',
  SpendBond: 'a Bond',
  ForgeBond: 'proposes Forging the Bond',
};

/** Party history covers two shapes: clearing a full Rapport track (`clearRapportForPartyLevel`,
 *  slice 4), and — as of `0.28.0` — Rapport spent on Aid. `Action` tells them apart; `By` is
 *  populated for the Aid spend only (clearing Rapport isn't attributed to one player). */
function historyLabel(e: { Action: string; Name?: string; Effect?: string; By?: string }): string {
  const who = e.By || 'The party';
  if (e.Action === 'spent') return `${who} spent Rapport${e.Effect ? ` — ${e.Effect}` : ''}`;
  return `${who} took ${e.Name}`;
}

function ReadonlyPips({ count, filled, color }: { count: number; filled: number; color: string }) {
  return (
    <div className={styles.readonlyPips}>
      {Array.from({ length: count }, (_, i) => (
        /* Fill colour is passed in by the caller, so it stays inline. */
        <span key={i} className={styles.readonlyPip} style={i < filled ? { borderColor: color, background: color } : undefined} />
      ))}
    </div>
  );
}

export function AdvancementPanel({
  library,
  party,
  bonds,
  characters,
  myCharacterId,
  archived,
  commitParty,
  onPropose,
  onAccept,
  onReject,
  openPicker,
}: {
  library: Library;
  party: Party;
  bonds: Bond[];
  characters: Character[];
  myCharacterId: string;
  /** The campaign is archived — the server rejects every Bond write regardless, so the
   *  propose/accept/decline/withdraw controls below are hidden rather than fail silently. */
  archived?: boolean;
  commitParty: (m: (d: Party) => void) => void;
  onPropose: (bondId: string, type: 'MarkBond' | 'SpendBond', note?: string) => void;
  onAccept: (bondId: string) => void;
  onReject: (bondId: string, withdrawn: boolean) => void;
  openPicker: (p: PickerState) => void;
}) {
  const matcher = useGlossaryMatcher();
  const rTaken = party.RapportImprovementsTaken;
  const rapportLen = library.settings.RapportTrackLength;
  const bondLen = library.settings.BondTrackLength;
  const myName = characters.find((c) => c.Id === myCharacterId)?.Name ?? 'Someone';

  /** Spends Rapport on Aid and records it. Logged rather than silent: Rapport is shared, so a
   *  teammate seeing the pool drop should be able to see who spent it and what for. */
  function spendRapportOnAid(cost: number) {
    if (party.Rapport < cost) return;
    commitParty((d) => {
      d.Rapport = Math.max(0, d.Rapport - cost);
      d.History.unshift({
        Id: newId('h'),
        At: nowIso(),
        Action: 'spent',
        Name: 'Aid',
        Effect: cost > 1 ? '+1 to a Risk Death roll (double cost)' : '+1 to an ally\u2019s roll',
        By: myName,
      });
    });
  }
  const myBonds = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);
  const bondsForged = myBonds.reduce((n, b) => n + b.BondMoves.length, 0);
  const [markingBond, setMarkingBond] = useState<{ bondId: string; partnerName: string } | null>(null);
  const [openHistory, setOpenHistory] = useState<{ title: string; entries: HistoryEntry[] } | null>(null);
  const [advancingParty, setAdvancingParty] = useState(false);

  function applyPartyAdvance(option: PartyAdvanceOption, tag?: string) {
    commitParty((d) => applyPartyRapportAdvance(d, option, tag));
    setAdvancingParty(false);
  }

  return (
    <Panel id="p-growth" collapseId="growth" primary>
      <PanelHeader extra={<PendingBondBadge count={pendingBondCountFor(myBonds, myCharacterId)} />}>Advancement</PanelHeader>

      <div className={styles.tracksRow}>
        <div className={styles.subBox}>
          <div className={styles.trackHead}>
            <div className={styles.trackNaming}>
              <div className={styles.trackName}>Rapport</div>
              <div className={`${styles.trackMeta} ${styles.trackMetaShared}`}>
                Party · shared · Level {party.PartyLevel ?? 0}
              </div>
            </div>
            <Pips
              count={rapportLen}
              filled={party.Rapport}
              color="var(--gold)"
              onSet={(n) => {
                commitParty((d) => { d.Rapport = n; });
              }}
            />
          </div>
          <p className={styles.rapportNote}>
            One pool for the whole party — anyone can spend it, and it updates for everyone at once. Last edited {new Date(party.UpdatedAt).toLocaleString()}.
          </p>
          {/* V0.6 slice 4: a full Rapport track no longer advances the instant it fills — it
              advances the next time the party Makes Camp, so this is a manual trigger rather than
              an auto-opened modal (WorkPlan-V0.6.md Section A2). */}
          {party.Rapport >= rapportLen && (
            <button type="button" className={`tap-inline ${styles.readyBadge}`} onClick={() => setAdvancingParty(true)}>
              Rapport full — Progress the Party at your next Make Camp
            </button>
          )}
          {/* Aid (V0.5): 1 Rapport for +1 on another Hero's roll, spendable even after the dice
              land, double during Risk Death. The app can't see "a roll", so it moves the currency
              and records who spent it; the once-per-teammate limit stays a table rule. */}
          <div className={`action-grid ${styles.aidRow}`} style={{ '--action-min': '150px' } as React.CSSProperties}>
            <button
              type="button"
              className={`tap-inline ${styles.aidButton}`}
              disabled={party.Rapport <= 0}
              onClick={() => spendRapportOnAid(1)}
            >
              Aid (&minus;1 Rapport)
            </button>
            <button
              type="button"
              className={`tap-inline ${styles.aidButton}`}
              disabled={party.Rapport < 2}
              onClick={() => spendRapportOnAid(2)}
              title="Risk Death costs double: 2 Rapport per +1."
            >
              Aid a Risk Death (&minus;2)
            </button>
          </div>
          {rTaken.map((t, i) => (
            <div key={i} className={`${styles.takenRow} ${styles.takenRowTight}`}>
              <div className={styles.takenName}>{t.Name}</div>
              <div className={styles.takenEffect}><GlossaryText text={t.Effect} matcher={matcher} /></div>
            </div>
          ))}
          {party.History.length > 0 && (
            <button
              type="button"
              className={`tap-inline ${styles.historyTrigger}`}
              onClick={() => setOpenHistory({ title: 'Rapport History', entries: party.History.map((e) => ({ label: historyLabel(e), when: e.At })) })}
            >
              History ({party.History.length})
            </button>
          )}
        </div>
      </div>

      <div className={styles.bondsBox}>
        <div className={styles.bondsTitle}>Bonds</div>
        <div className={styles.bondsMeta}>
          Social · shared with each partner · {bondsForged === 1 ? '1 forged' : `${bondsForged} forged`}
        </div>
        {myBonds.map((b) => {
          const otherId = b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId;
          const other = characters.find((c) => c.Id === otherId);
          const p = b.PendingChange;
          const mineProposed = p && p.ProposedBy === myCharacterId;
          return (
            <div key={b.Id} className={styles.bond}>
              <div className={styles.bondHead}>
                <div className={`wrap-anywhere ${styles.partner}`}>{other?.Name ?? 'Unknown'}</div>
                <ReadonlyPips count={bondLen} filled={b.BondTrack} color="var(--gold)" />
                <div className={styles.bondLevel}>Bond {b.BondLevel}{isBondLocked(b) ? ' (Locked)' : ''}</div>
              </div>

              {p ? (
                <div className={styles.pending}>
                  {mineProposed ? (
                    <>
                      <div>Waiting on {other?.Name ?? 'them'} to confirm your proposal.</div>
                      {!archived && (
                        <div className={`action-grid ${styles.actions}`}>
                          <button className={`tap-inline ${styles.withdraw}`} onClick={() => onReject(b.Id, true)}>Withdraw</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        {other?.Name ?? 'They'} {TYPE_LABELS[p.Type] ?? 'proposed a change'} &mdash; &ldquo;
                        {p.Note ? <GlossaryText text={p.Note} matcher={matcher} /> : 'No note given.'}
                        &rdquo;
                      </div>
                      {archived ? (
                        <p className={styles.rapportNote}>This campaign is archived — unarchive it to answer this.</p>
                      ) : (
                        <div className={`action-grid ${styles.actions}`}>
                          <button className={`tap-inline ${styles.accept}`} onClick={() => onAccept(b.Id)}>Accept</button>
                          <button className={`tap-inline ${styles.decline}`} onClick={() => onReject(b.Id, false)}>Decline</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : archived ? null : isBondLocked(b) ? (
                <p className={styles.rapportNote}>This Bond is locked at max Level with a full Bond Track — Bond can no longer be spent on it.</p>
              ) : (
                <div className={`action-grid ${styles.actions}`}>
                  <button className={`tap-inline ${styles.propose}`} onClick={() => setMarkingBond({ bondId: b.Id, partnerName: other?.Name ?? 'your partner' })}>Propose +1 Bond</button>
                  <button
                    className={`tap-inline ${styles.propose}`}
                    title="Spending a Bond is unilateral — it happens immediately, no confirmation needed."
                    onClick={() => onPropose(b.Id, 'SpendBond', 'I need this from you.')}
                  >
                    Spend a Bond
                  </button>
                  {b.BondTrack >= bondLen && (
                    <button className={`tap-inline ${styles.propose} ${styles.proposeStrong}`} onClick={() => openPicker({ kind: 'bond', bondId: b.Id, partnerName: other?.Name ?? 'your partner' })}>
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
                <button
                  type="button"
                  className={`tap-inline ${styles.historyTrigger}`}
                  onClick={() => setOpenHistory({
                    title: `Bond History — ${other?.Name ?? 'Unknown'}`,
                    // No .slice(0, 8) truncation as of 0.24.0 — that cap only existed because
                    // this used to render inline on the sheet, competing for room; a modal has
                    // no such constraint.
                    entries: b.History.map((e) => {
                      const who = characters.find((c) => c.Id === e.By);
                      const label = (TYPE_LABELS[e.Type] || e.Type).replace('proposes ', '');
                      return { label: `${who ? who.Name : 'Someone'} ${e.Action} ${label}`, detail: e.Note, when: e.At };
                    }),
                  })}
                >
                  History ({b.History.length})
                </button>
              )}
            </div>
          );
        })}
      </div>

      {markingBond && (
        <MarkBondModal
          partnerName={markingBond.partnerName}
          onClose={() => setMarkingBond(null)}
          onSubmit={(note: string) => {
            onPropose(markingBond.bondId, 'MarkBond', note);
            setMarkingBond(null);
          }}
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
      {advancingParty && (
        <Suspense fallback={null}>
          <PartyAdvanceModal party={party} onChoose={applyPartyAdvance} onClose={() => setAdvancingParty(false)} />
        </Suspense>
      )}
    </Panel>
  );
}

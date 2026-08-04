import type { Bond, Character, CharacterSheet, Party } from '@asohav/shared';
import { unlockedTier } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { Pips } from './Pips.js';
import type { PickerState } from './pickerTypes.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './AdvancementPanel.module.css';

const TYPE_LABELS: Record<string, string> = {
  MarkKin: 'proposes +1 Kin',
  SpendKin: 'a Kin',
  ForgeBond: 'proposes Forging the Bond',
};

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
  sheet,
  party,
  bonds,
  characters,
  myCharacterId,
  commitSheet,
  commitParty,
  onPropose,
  onAccept,
  onReject,
  openPicker,
}: {
  sheet: CharacterSheet;
  party: Party;
  bonds: Bond[];
  characters: Character[];
  myCharacterId: string;
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  commitParty: (m: (d: Party) => void) => void;
  onPropose: (bondId: string, type: 'MarkKin' | 'SpendKin', note?: string) => void;
  onAccept: (bondId: string) => void;
  onReject: (bondId: string, withdrawn: boolean) => void;
  openPicker: (p: PickerState) => void;
}) {
  const matcher = useGlossaryMatcher();
  const adv = sheet.Advancement;
  const pTaken = adv.PotentialAdvancementsTaken;
  const rTaken = party.RapportAdvancementsTaken;
  const myBonds = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);
  const bondsForged = myBonds.reduce((n, b) => n + b.BondMoves.length, 0);

  return (
    <Panel id="p-growth" collapseId="growth" primary>
      <PanelHeader>Advancement</PanelHeader>

      <div className={styles.subBox}>
        <div className={styles.trackHead}>
          <div className={styles.trackNaming}>
            <div className={styles.trackName}>Potential</div>
            <div className={styles.trackMeta}>
              Personal · Tier {unlockedTier(pTaken.length)} unlocked · {pTaken.length === 1 ? '1 taken' : `${pTaken.length} taken`}
            </div>
          </div>
          <Pips
            count={5}
            filled={adv.Potential}
            color="var(--gold)"
            onSet={(n) => {
              commitSheet((d) => { d.Advancement.Potential = n; });
              if (n >= 5) openPicker({ kind: 'advancement', track: 'Potential' });
            }}
          />
        </div>
        {pTaken.map((t, i) => (
          <div key={i} className={styles.takenRow}>
            <div className={styles.takenName}>
              {t.Name} <span className={styles.takenTier}>Tier {t.Tier}</span>
            </div>
            <div className={styles.takenEffect}><GlossaryText text={t.Effect} matcher={matcher} /></div>
          </div>
        ))}
        {adv.History.length > 0 && (
          <HistoryList entries={adv.History.map((e) => ({ label: `Took ${e.Name}`, when: e.At }))} />
        )}
      </div>

      <div className={styles.subBox}>
        <div className={styles.trackHead}>
          <div className={styles.trackNaming}>
            <div className={styles.trackName}>Rapport</div>
            <div className={`${styles.trackMeta} ${styles.trackMetaShared}`}>
              Party · shared · {rTaken.length === 1 ? '1 taken' : `${rTaken.length} taken`}
            </div>
          </div>
          <Pips
            count={5}
            filled={party.Rapport}
            color="var(--gold)"
            onSet={(n) => {
              commitParty((d) => { d.Rapport = n; });
              if (n >= 5) openPicker({ kind: 'advancement', track: 'Rapport' });
            }}
          />
        </div>
        <p className={styles.rapportNote}>
          One pool for the whole party — anyone can spend it, and it updates for everyone at once. Last edited {new Date(party.UpdatedAt).toLocaleString()}.
        </p>
        {rTaken.map((t, i) => (
          <div key={i} className={`${styles.takenRow} ${styles.takenRowTight}`}>
            <div className={styles.takenName}>{t.Name}</div>
            <div className={styles.takenEffect}><GlossaryText text={t.Effect} matcher={matcher} /></div>
          </div>
        ))}
        {party.History.length > 0 && (
          <HistoryList entries={party.History.map((e) => ({ label: `${e.By || 'The party'} took ${e.Name}`, when: e.At }))} />
        )}
      </div>

      <div className={styles.bondsBox}>
        <div className={styles.bondsTitle}>Kin &amp; Bonds</div>
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
                <ReadonlyPips count={5} filled={b.KinTrack} color="var(--gold)" />
                <div className={styles.bondLevel}>Bond {b.BondLevel}</div>
              </div>

              {p ? (
                <div className={styles.pending}>
                  {mineProposed ? (
                    <>
                      <div>Waiting on {other?.Name ?? 'them'} to confirm your proposal.</div>
                      <div className={`tap-row ${styles.actions}`}>
                        <button className={`tap-inline ${styles.withdraw}`} onClick={() => onReject(b.Id, true)}>Withdraw</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        {other?.Name ?? 'They'} {TYPE_LABELS[p.Type] ?? 'proposed a change'} &mdash; &ldquo;{p.Note || 'No note given.'}&rdquo;
                      </div>
                      <div className={`tap-row ${styles.actions}`}>
                        <button className={`tap-inline ${styles.accept}`} onClick={() => onAccept(b.Id)}>Accept</button>
                        <button className={`tap-inline ${styles.decline}`} onClick={() => onReject(b.Id, false)}>Decline</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className={`tap-row ${styles.actions}`}>
                  <button className={`tap-inline ${styles.propose}`} onClick={() => onPropose(b.Id, 'MarkKin', 'Something between us changed.')}>Propose +1 Kin</button>
                  <button
                    className={`tap-inline ${styles.propose}`}
                    title="Spending a Kin is unilateral — it happens immediately, no confirmation needed."
                    onClick={() => onPropose(b.Id, 'SpendKin', 'I need this from you.')}
                  >
                    Spend a Kin
                  </button>
                  {b.KinTrack >= 5 && (
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
                <HistoryList
                  entries={b.History.slice(0, 8).map((e) => {
                    const who = characters.find((c) => c.Id === e.By);
                    const label = (TYPE_LABELS[e.Type] || e.Type).replace('proposes ', '');
                    return { label: `${who ? who.Name : 'Someone'} ${e.Action} ${label}`, detail: e.Note, when: e.At };
                  })}
                />
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function HistoryList({ entries }: { entries: { label: string; detail?: string; when: string }[] }) {
  return (
    <div className={styles.history}>
      <div className={styles.historyLabel}>History</div>
      {entries.map((e, i) => (
        <div key={i} className={styles.historyRow}>
          <span className={styles.historyLabelCell}>{e.label}</span>
          {e.detail && <span className={styles.historyMeta}>{e.detail}</span>}
          <span className={styles.historyMeta}>{new Date(e.when).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}


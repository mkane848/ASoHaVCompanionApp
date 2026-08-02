import type { CSSProperties } from 'react';
import type { Bond, Character, CharacterSheet, Party } from '@asohav/shared';
import { unlockedTier } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { Pips } from './Pips.js';
import type { PickerState } from './pickerTypes.js';

function ReadonlyPips({ count, filled, color }: { count: number; filled: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ width: 19, height: 19, borderRadius: '50%', display: 'block', border: `1.5px solid ${i < filled ? color : 'rgba(42,32,26,.28)'}`, background: i < filled ? color : 'transparent' }} />
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
  openPicker: (p: PickerState) => void;
}) {
  const adv = sheet.Advancement;
  const pTaken = adv.PotentialAdvancementsTaken;
  const rTaken = party.RapportAdvancementsTaken;
  const myBonds = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);
  const bondsForged = myBonds.reduce((n, b) => n + b.BondMoves.length, 0);

  return (
    <Panel id="p-growth" primary>
      <PanelHeader>Advancement</PanelHeader>

      <div style={subBox}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>Potential</div>
            <div style={{ fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>
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
          <div key={i} style={takenRow}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>
              {t.Name} <span style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>Tier {t.Tier}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(42,32,26,.7)' }}>{t.Effect}</div>
          </div>
        ))}
        {adv.History.length > 0 && (
          <HistoryList entries={adv.History.map((e) => ({ label: `Took ${e.Name}`, when: e.At }))} />
        )}
      </div>

      <div style={subBox}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>Rapport</div>
            <div style={{ fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--gold-dark)' }}>
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
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ink-55)', fontStyle: 'italic' }}>
          One pool for the whole party — anyone can spend it, and it updates for everyone at once. Last edited {new Date(party.UpdatedAt).toLocaleString()}.
        </p>
        {rTaken.map((t, i) => (
          <div key={i} style={{ ...takenRow, paddingTop: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>{t.Name}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(42,32,26,.7)' }}>{t.Effect}</div>
          </div>
        ))}
        {party.History.length > 0 && (
          <HistoryList entries={party.History.map((e) => ({ label: `${e.By || 'The party'} took ${e.Name}`, when: e.At }))} />
        )}
      </div>

      <div style={{ border: '1px solid var(--rule)', padding: '16px 18px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Kin &amp; Bonds</div>
        <div style={{ fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--gold-dark)', marginBottom: 10 }}>
          Social · shared with each partner · {bondsForged === 1 ? '1 forged' : `${bondsForged} forged`}
        </div>
        {myBonds.map((b) => {
          const otherId = b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId;
          const other = characters.find((c) => c.Id === otherId);
          const p = b.PendingChange;
          const mineProposed = p && p.ProposedBy === myCharacterId;
          return (
            <div key={b.Id} style={{ padding: '12px 0', borderTop: '1px solid var(--rule)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 130, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{other?.Name ?? 'Unknown'}</div>
                <ReadonlyPips count={5} filled={b.KinTrack} color="var(--gold)" />
                <div style={{ fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>Bond {b.BondLevel}</div>
              </div>

              {p ? (
                <div style={{ marginTop: 8, padding: '8px 11px', background: 'var(--gold-tint)', borderLeft: '2px solid var(--gold)', fontSize: 12.5, color: 'rgba(42,32,26,.75)' }}>
                  {mineProposed ? `Waiting on ${other?.Name ?? 'them'} to confirm your proposal — answer it in the Campaign view.` : `${other?.Name ?? 'They'} proposed a change — answer it in the Campaign view.`}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <button onClick={() => onPropose(b.Id, 'MarkKin', 'Something between us changed.')} style={proposeBtn}>Propose +1 Kin</button>
                  <button onClick={() => onPropose(b.Id, 'SpendKin', 'I need this from you.')} style={proposeBtn}>Propose spend</button>
                  {b.KinTrack >= 5 && (
                    <button onClick={() => openPicker({ kind: 'bond', bondId: b.Id, partnerName: other?.Name ?? 'your partner' })} style={{ ...proposeBtn, background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none' }}>
                      Propose Forge
                    </button>
                  )}
                </div>
              )}

              {b.BondMoves.map((m, i) => (
                <div key={i} style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--gold-line)' }}>
                  <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>Bond {m.Level}</div>
                  <div style={{ fontSize: 13, fontStyle: 'italic' }}>{m.Text}</div>
                </div>
              ))}
              {b.History.length > 0 && (
                <HistoryList
                  dashed
                  entries={b.History.slice(0, 8).map((e) => {
                    const who = characters.find((c) => c.Id === e.By);
                    return { label: `${who ? who.Name : 'Someone'} ${e.Action} ${e.Type}`, detail: e.Note, when: e.At };
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

function HistoryList({ entries, dashed }: { entries: { label: string; detail?: string; when: string }[]; dashed?: boolean }) {
  return (
    <div style={{ marginTop: 11, paddingTop: 8, borderTop: `1px ${dashed ? 'dashed' : 'dashed'} var(--rule-field)` }}>
      <div style={{ fontSize: 9.5, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--ink-45)', marginBottom: 3 }}>History</div>
      {entries.map((e, i) => (
        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11.5, color: 'var(--ink-55)', padding: '1px 0' }}>
          <span style={{ flex: 1 }}>{e.label}</span>
          {e.detail && <span style={{ color: 'var(--ink-45)' }}>{e.detail}</span>}
          <span style={{ color: 'var(--ink-45)' }}>{new Date(e.when).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

const subBox: CSSProperties = { border: '1px solid var(--rule)', padding: '16px 18px', marginBottom: 16 };
const takenRow: CSSProperties = { padding: '8px 0 8px 14px', borderLeft: '2px solid var(--gold-line)', marginTop: 8 };
const proposeBtn: CSSProperties = { fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--ink-25)', color: 'rgba(42,32,26,.7)', padding: '5px 10px' };

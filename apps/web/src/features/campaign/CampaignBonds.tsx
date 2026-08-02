import { useState } from 'react';
import type { Bond, Character } from '@asohav/shared';
import { ForgeBondModal } from './ForgeBondModal.js';

const TYPE_LABELS: Record<string, string> = {
  MarkKin: 'proposes +1 Kin',
  SpendKin: 'proposes spending a Kin',
  ForgeBond: 'proposes Forging the Bond',
};

function Pips({ count, filled }: { count: number; filled: number }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ width: 16, height: 16, borderRadius: '50%', display: 'block', border: `1.5px solid ${i < filled ? 'var(--gold)' : 'var(--ink-28)'}`, background: i < filled ? 'var(--gold)' : 'transparent' }} />
      ))}
    </div>
  );
}

export function CampaignBonds({
  bonds,
  characters,
  myCharacterId,
  onPropose,
  onAccept,
  onReject,
}: {
  bonds: Bond[];
  characters: Character[];
  myCharacterId: string;
  onPropose: (bondId: string, type: 'MarkKin' | 'SpendKin' | 'ForgeBond', payload: Record<string, unknown>, note?: string) => void;
  onAccept: (bondId: string) => void;
  onReject: (bondId: string, withdrawn: boolean) => void;
}) {
  const [forging, setForging] = useState<{ bondId: string; partnerName: string } | null>(null);
  const mine = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);
  const partnerName = (b: Bond) => {
    const otherId = b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId;
    return characters.find((c) => c.Id === otherId)?.Name ?? 'Unknown';
  };

  const incoming = mine.filter((b) => b.PendingChange && b.PendingChange.ProposedBy !== myCharacterId);
  const outgoing = mine.filter((b) => b.PendingChange && b.PendingChange.ProposedBy === myCharacterId);

  return (
    <div style={{ flex: '2 1 420px' }}>
      {incoming.length > 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--gold-line)', borderTop: '2px solid var(--gold)', padding: '18px 20px', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 21, margin: '0 0 3px' }}>Awaiting your confirmation</h2>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ink-55)', fontStyle: 'italic' }}>A Bond is shared, so changes need both of you. Nothing lands until you accept.</p>
          {incoming.map((b) => (
            <div key={b.Id} style={{ padding: '11px 0', borderTop: '1px solid var(--rule)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>
                {partnerName(b)} &middot; {TYPE_LABELS[b.PendingChange!.Type]}
              </div>
              <p style={{ margin: '3px 0 8px', fontSize: 13, color: 'rgba(42,32,26,.75)', fontStyle: 'italic' }}>&ldquo;{b.PendingChange!.Note || 'No note given.'}&rdquo;</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button onClick={() => onAccept(b.Id)} style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: '7px 14px' }}>
                  Accept
                </button>
                <button onClick={() => onReject(b.Id, false)} style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--danger-line)', color: 'var(--danger)', padding: '7px 14px' }}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--panel)', border: '1px solid var(--rule)', padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 21, margin: 0 }}>Bonds</h2>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(157,124,51,.55), rgba(157,124,51,0))' }} />
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ink-55)', fontStyle: 'italic' }}>Each Bond is one shared record. A Bond with a change in flight is locked until it settles.</p>
        {mine.map((b) => {
          const p = b.PendingChange;
          return (
            <div key={b.Id} style={{ padding: '13px 0', borderTop: '1px solid var(--rule)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 11 }}>
                <span style={{ flex: 1, minWidth: 120, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{partnerName(b)}</span>
                <Pips count={5} filled={b.KinTrack} />
                <span style={{ fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>Bond {b.BondLevel}</span>
              </div>

              {p ? (
                <div style={{ marginTop: 8, padding: '8px 11px', background: 'var(--gold-tint)', borderLeft: '2px solid var(--gold)', fontSize: 12.5, color: 'rgba(42,32,26,.75)' }}>
                  {p.ProposedBy === myCharacterId
                    ? `Waiting on ${partnerName(b)} to confirm your proposal.`
                    : `${partnerName(b)} ${TYPE_LABELS[p.Type]} — answer it above.`}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <button onClick={() => onPropose(b.Id, 'MarkKin', { Delta: 1 }, 'Something between us changed.')} style={btnStyle}>Propose +1 Kin</button>
                  <button onClick={() => onPropose(b.Id, 'SpendKin', { Delta: 1 }, 'I need this from you.')} style={btnStyle}>Propose spend</button>
                  {b.KinTrack >= 5 && (
                    <button onClick={() => setForging({ bondId: b.Id, partnerName: partnerName(b) })} style={{ ...btnStyle, background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none' }}>
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
                <div style={{ marginTop: 9, paddingTop: 7, borderTop: '1px dashed var(--rule-field)' }}>
                  <div style={{ fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-45)', marginBottom: 3 }}>History</div>
                  {b.History.slice(0, 6).map((e, i) => {
                    const who = characters.find((c) => c.Id === e.By);
                    return (
                      <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 7, fontSize: 11.5, color: 'var(--ink-55)', padding: '1px 0' }}>
                        <span>{(who ? who.Name : 'Someone')} {e.Action} {(TYPE_LABELS[e.Type] || e.Type).replace('proposes ', '')}</span>
                        {e.Note && <span style={{ color: 'var(--ink-45)' }}>{e.Note}</span>}
                        <span style={{ marginLeft: 'auto', color: 'var(--ink-45)' }}>{new Date(e.At).toLocaleString()}</span>
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
        <div style={{ background: 'var(--panel)', border: '1px solid var(--rule)', padding: '18px 20px', marginTop: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 21, margin: '0 0 3px' }}>Waiting on others</h2>
          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--ink-55)', fontStyle: 'italic' }}>You proposed these. They're locked until the other player answers &mdash; withdraw if it's gone stale.</p>
          {outgoing.map((b) => (
            <div key={b.Id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--rule)' }}>
              <span style={{ flex: 1, minWidth: 150, fontSize: 13.5 }}>
                {partnerName(b)} &middot; {(TYPE_LABELS[b.PendingChange!.Type] || 'a change').replace('proposes ', '')}
              </span>
              <button onClick={() => onReject(b.Id, true)} style={{ fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--ink-25)', color: 'rgba(42,32,26,.6)', padding: '5px 10px' }}>
                Withdraw
              </button>
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
    </div>
  );
}

const btnStyle = {
  fontSize: 10.5,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  background: 'transparent',
  border: '1px solid var(--ink-25)',
  color: 'rgba(42,32,26,.7)',
  padding: '5px 10px',
};

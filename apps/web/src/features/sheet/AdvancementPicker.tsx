import { useState } from 'react';
import type { CharacterSheet, Library, Party } from '@asohav/shared';
import { newId, nowIso, unlockedTier } from '@asohav/shared';
import type { PickerState } from './pickerTypes.js';

export function AdvancementPicker({
  picker,
  library,
  sheet,
  party,
  commitSheet,
  commitParty,
  onProposeForge,
  onClose,
}: {
  picker: PickerState;
  library: Library;
  sheet: CharacterSheet;
  party: Party;
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  commitParty: (m: (d: Party) => void) => void;
  onProposeForge: (bondId: string, text: string) => void;
  onClose: () => void;
}) {
  const [bondText, setBondText] = useState('');
  if (!picker) return null;

  const isBond = picker.kind === 'bond';
  let title = '';
  let subtitle = '';

  if (isBond) {
    title = 'Forge a Bond';
    subtitle = `You and ${picker.partnerName} write this move together. Both of you must agree to the wording.`;
  }

  let options: { id: string; name: string; tier: number; effect: string; repeatable: boolean; capped: boolean }[] = [];
  let unlocked = 1;
  if (!isBond) {
    const track = picker.track;
    const taken = track === 'Potential' ? sheet.Advancement.PotentialAdvancementsTaken : party.RapportAdvancementsTaken;
    unlocked = unlockedTier(taken.length);
    title = track === 'Potential' ? 'Take an Advancement' : 'Take a Party Advancement';
    subtitle = `Your track is full. Choose one and the track clears. Tier ${unlocked} and below are unlocked.`;
    options = library.advancements
      .filter((a) => a.Track === track && a.Tier <= unlocked)
      .map((a) => {
        const count = taken.filter((t) => t.Id === a.Id).length;
        const capped = a.Repeatable ? !!(a.MaxTimes && count >= a.MaxTimes) : count > 0;
        return { id: a.Id, name: a.Name, tier: a.Tier, effect: a.Effect, repeatable: a.Repeatable, capped };
      });
  }

  function choose(id: string) {
    if (isBond) return;
    const a = library.advancements.find((x) => x.Id === id);
    if (!a) return;
    const rec = { Id: a.Id, Name: a.Name, Tier: a.Tier, Effect: a.Effect, TakenAt: nowIso() };
    if (picker!.kind === 'advancement' && picker!.track === 'Potential') {
      commitSheet((d) => {
        d.Advancement.PotentialAdvancementsTaken.push(rec);
        d.Advancement.Potential = 0;
        d.Advancement.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'took', Name: a.Name, Tier: a.Tier, Effect: a.Effect });
      });
    } else {
      commitParty((d) => {
        d.RapportAdvancementsTaken.push(rec);
        d.Rapport = 0;
        d.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'took', Name: a.Name, Tier: a.Tier, Effect: a.Effect, By: undefined });
      });
    }
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(42,32,26,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--rule)', borderTop: '3px solid var(--gold)', maxWidth: 640, width: '100%', maxHeight: '84vh', overflowY: 'auto', animation: 'fadeUp .2s ease-out' }}>
        <div style={{ padding: '20px 24px 12px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 26, margin: '0 0 4px' }}>{title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-55)', fontStyle: 'italic' }}>{subtitle}</p>
        </div>
        <div style={{ padding: '0 24px 20px' }}>
          {isBond && (
            <>
              <textarea
                value={bondText}
                onChange={(e) => setBondText(e.target.value)}
                rows={4}
                placeholder="Write the move the two of you have earned — what it triggers on, and what it does…"
                style={{ width: '100%', background: 'transparent', border: '1px solid var(--rule-field)', fontSize: 13.5, lineHeight: 1.6, padding: 10, resize: 'vertical', outline: 'none' }}
              />
              <button
                onClick={() => {
                  const text = bondText.trim();
                  if (!text) return;
                  onProposeForge(picker.bondId, text);
                  setBondText('');
                }}
                style={{ width: '100%', marginTop: 10, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: 10 }}
              >
                Propose the Forge
              </button>
            </>
          )}

          {options.map((o) =>
            o.capped ? (
              <div key={o.id} style={{ width: '100%', textAlign: 'left', padding: '11px 13px', marginBottom: 7, background: 'rgba(42,32,26,.04)', border: '1px solid var(--rule)', opacity: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{o.name}</span>
                  <span style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>Tier {o.tier}</span>
                  <span style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', padding: '1px 6px', border: '1px solid var(--gold-line)', color: 'var(--gold-dark)' }}>taken</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(42,32,26,.72)', marginTop: 3 }}>{o.effect}</div>
              </div>
            ) : (
              <button
                key={o.id}
                onClick={() => choose(o.id)}
                style={{ width: '100%', textAlign: 'left', padding: '11px 13px', marginBottom: 7, background: 'transparent', border: '1px solid var(--gold-line)' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{o.name}</span>
                  <span style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>Tier {o.tier}</span>
                  {o.repeatable && (
                    <span style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', padding: '1px 6px', border: '1px solid var(--gold-line)', color: 'var(--gold-dark)' }}>repeatable</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(42,32,26,.72)', marginTop: 3 }}>{o.effect}</div>
              </button>
            ),
          )}

          <button
            onClick={onClose}
            style={{ width: '100%', marginTop: 12, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--ink-25)', color: 'rgba(42,32,26,.6)', padding: 9 }}
          >
            Not yet &mdash; keep the track full
          </button>
        </div>
      </div>
    </div>
  );
}

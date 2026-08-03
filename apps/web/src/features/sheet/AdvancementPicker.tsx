import { useState } from 'react';
import type { CharacterSheet, Library, Party } from '@asohav/shared';
import { newId, nowIso, unlockedTier } from '@asohav/shared';
import type { PickerState } from './pickerTypes.js';
import modal from '../../styles/modal.module.css';
import styles from './AdvancementPicker.module.css';

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
    <div className={modal.backdrop}>
      <div className={`${modal.dialog} ${styles.dialog}`}>
        <div className={modal.head}>
          <h2 className={modal.title}>{title}</h2>
          <p className={modal.subtitle}>{subtitle}</p>
        </div>
        <div className={modal.body}>
          {isBond && (
            <>
              <textarea
                className={modal.textarea}
                value={bondText}
                onChange={(e) => setBondText(e.target.value)}
                rows={4}
                placeholder="Write the move the two of you have earned — what it triggers on, and what it does…"
              />
              <button
                className={`tap-inline ${modal.primaryAction}`}
                onClick={() => {
                  const text = bondText.trim();
                  if (!text) return;
                  onProposeForge(picker.bondId, text);
                  setBondText('');
                }}
              >
                Propose the Forge
              </button>
            </>
          )}

          {options.map((o) =>
            o.capped ? (
              <div key={o.id} className={`${styles.option} ${styles.optionCapped}`}>
                <div className={styles.optionHead}>
                  <span className={styles.optionName}>{o.name}</span>
                  <span className={styles.optionTier}>Tier {o.tier}</span>
                  <span className={styles.badge}>taken</span>
                </div>
                <div className={styles.optionEffect}>{o.effect}</div>
              </div>
            ) : (
              <button key={o.id} className={styles.option} onClick={() => choose(o.id)}>
                <div className={styles.optionHead}>
                  <span className={styles.optionName}>{o.name}</span>
                  <span className={styles.optionTier}>Tier {o.tier}</span>
                  {o.repeatable && <span className={styles.badge}>repeatable</span>}
                </div>
                <div className={styles.optionEffect}>{o.effect}</div>
              </button>
            ),
          )}

          <button className={`tap-inline ${modal.secondaryAction} ${styles.dismiss}`} onClick={onClose}>
            Not yet &mdash; keep the track full
          </button>
        </div>
      </div>
    </div>
  );
}

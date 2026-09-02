import { useState } from 'react';
import type { Advancement, Library, Party } from '@asohav/shared';
import { advancementTierThresholds, newId, nowIso, unlockedTier } from '@asohav/shared';
import type { PickerState } from './pickerTypes.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './AdvancementPicker.module.css';

/** Party (Rapport) Advancement picker + the Bond Forge writer. The personal Potential Advancement
 *  picker retired with slice 2 — Potential now lives on each Motif and advances through
 *  `MotifPanel` instead. */
export function AdvancementPicker({
  picker,
  library,
  party,
  commitParty,
  onProposeForge,
  onClose,
}: {
  picker: PickerState;
  library: Library;
  party: Party;
  commitParty: (m: (d: Party) => void) => void;
  onProposeForge: (bondId: string, text: string) => void;
  onClose: () => void;
}) {
  const matcher = useGlossaryMatcher();
  const [bondText, setBondText] = useState('');

  function handleClose() {
    setBondText('');
    onClose();
  }
  const dialogRef = useModalA11y<HTMLDivElement>(() => handleClose());

  if (!picker) return null;

  const isBond = picker.kind === 'bond';
  let title = 'Forge a Bond';
  let subtitle = `You and ${picker.kind === 'bond' ? picker.partnerName : ''} write this move together. Both of you must agree to the wording.`;

  let options: { id: string; name: string; tier: number; effect: string; repeatable: boolean; capped: boolean }[] = [];
  let unlocked = 1;
  if (!isBond) {
    const taken = party.RapportAdvancementsTaken;
    unlocked = unlockedTier(taken.length, advancementTierThresholds(library.settings));
    title = 'Take a Party Advancement';
    subtitle = `Your track is full. Choose one and the track clears. Tier ${unlocked} and below are unlocked.`;
    options = library.advancements
      .filter((a) => a.Track === 'Rapport' && a.Tier <= unlocked)
      .map((a) => {
        const count = taken.filter((t) => t.Id === a.Id).length;
        const capped = a.Repeatable ? !!(a.MaxTimes && count >= a.MaxTimes) : count > 0;
        return { id: a.Id, name: a.Name, tier: a.Tier, effect: a.Effect, repeatable: a.Repeatable, capped };
      });
  }

  function applyAdvancement(a: Advancement) {
    const rec = { Id: a.Id, Name: a.Name, Tier: a.Tier, Effect: a.Effect, TakenAt: nowIso() };
    commitParty((d) => {
      d.RapportAdvancementsTaken.push(rec);
      d.Rapport = 0;
      d.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'took', Name: a.Name, Tier: a.Tier, Effect: a.Effect });
    });
    handleClose();
  }

  function choose(id: string) {
    if (isBond) return;
    const a = library.advancements.find((x) => x.Id === id);
    if (!a) return;
    applyAdvancement(a);
  }

  return (
    <div className={modal.backdrop}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="advancement-picker-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="advancement-picker-title" className={modal.title}>{title}</h2>
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

          {!isBond && (
            <>
              {options.map((o) =>
                o.capped ? (
                  <div key={o.id} className={`${styles.option} ${styles.optionCapped}`}>
                    <div className={styles.optionHead}>
                      <span className={styles.optionName}>{o.name}</span>
                      <span className={styles.optionTier}>Tier {o.tier}</span>
                      <span className={styles.badge}>taken</span>
                    </div>
                    <div className={styles.optionEffect}><GlossaryText text={o.effect} matcher={matcher} /></div>
                  </div>
                ) : (
                  <button key={o.id} className={styles.option} onClick={() => choose(o.id)}>
                    <div className={styles.optionHead}>
                      <span className={styles.optionName}>{o.name}</span>
                      <span className={styles.optionTier}>Tier {o.tier}</span>
                      {o.repeatable && <span className={styles.badge}>repeatable</span>}
                    </div>
                    <div className={styles.optionEffect}><GlossaryText text={o.effect} matcher={matcher} /></div>
                  </button>
                ),
              )}

              <button className={`tap-inline ${modal.secondaryAction} ${styles.dismiss}`} onClick={handleClose}>
                Not yet &mdash; keep the track full
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

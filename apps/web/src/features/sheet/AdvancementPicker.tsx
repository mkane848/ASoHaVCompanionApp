import { useEffect, useState } from 'react';
import type { Advancement, CharacterSheet, Library, Party } from '@asohav/shared';
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
  // 'ad-p-virtue1' and 'ad-p-theme' need a follow-up choice (which Virtue / which Theme)
  // before the advancement can actually be applied, unlike every other advancement, which
  // is just a text record. Tracked here rather than as a generic "structured effect" system
  // since these are the only two Potential Advancements today that mutate sheet state.
  const [awaiting, setAwaiting] = useState<'virtue' | 'theme' | null>(null);
  const [pendingAdvancement, setPendingAdvancement] = useState<Advancement | null>(null);

  useEffect(() => {
    setAwaiting(null);
    setPendingAdvancement(null);
  }, [picker]);

  if (!picker) return null;

  const isBond = picker.kind === 'bond';
  let title = '';
  let subtitle = '';

  if (isBond) {
    title = 'Forge a Bond';
    subtitle = `You and ${picker.partnerName} write this move together. Both of you must agree to the wording.`;
  } else if (awaiting === 'virtue') {
    title = 'Raise a Virtue';
    subtitle = 'Choose which Virtue improves by 1, to a maximum of +3.';
  } else if (awaiting === 'theme') {
    title = 'Change your Theme';
    subtitle = 'Completed Quests remain completed. Anything unfinished is dropped.';
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

  function handleClose() {
    setAwaiting(null);
    setPendingAdvancement(null);
    onClose();
  }

  function applyAdvancement(a: Advancement, extraSheetMutation?: (d: CharacterSheet) => void) {
    const rec = { Id: a.Id, Name: a.Name, Tier: a.Tier, Effect: a.Effect, TakenAt: nowIso() };
    if (picker!.kind === 'advancement' && picker!.track === 'Potential') {
      commitSheet((d) => {
        d.Advancement.PotentialAdvancementsTaken.push(rec);
        d.Advancement.Potential = 0;
        d.Advancement.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'took', Name: a.Name, Tier: a.Tier, Effect: a.Effect });
        extraSheetMutation?.(d);
      });
    } else {
      commitParty((d) => {
        d.RapportAdvancementsTaken.push(rec);
        d.Rapport = 0;
        d.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'took', Name: a.Name, Tier: a.Tier, Effect: a.Effect, By: undefined });
      });
    }
    handleClose();
  }

  function choose(id: string) {
    if (isBond) return;
    const a = library.advancements.find((x) => x.Id === id);
    if (!a) return;
    if (a.Id === 'ad-p-virtue1') {
      setPendingAdvancement(a);
      setAwaiting('virtue');
      return;
    }
    if (a.Id === 'ad-p-theme') {
      setPendingAdvancement(a);
      setAwaiting('theme');
      return;
    }
    applyAdvancement(a);
  }

  function finishVirtueRaise(virtueId: string) {
    if (!pendingAdvancement) return;
    applyAdvancement(pendingAdvancement, (d) => {
      const v = d.Virtues.find((x) => x.VirtueId === virtueId);
      if (v) v.Score = Math.min(3, v.Score + 1);
    });
  }

  function finishThemeChange(themeId: string) {
    if (!pendingAdvancement) return;
    applyAdvancement(pendingAdvancement, (d) => {
      const keptQuests = d.Theme.AcceptedQuests.filter((q) => q.Completed);
      d.Theme = { ThemeId: themeId, AcceptedQuests: keptQuests };
    });
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

          {awaiting === 'virtue' ? (
            <>
              {library.virtues.map((v) => {
                const vv = sheet.Virtues.find((x) => x.VirtueId === v.Id);
                const score = vv?.Score ?? 0;
                const atCap = !vv || score >= 3;
                const scoreLabel = score > 0 ? `+${score}` : String(score);
                return atCap ? (
                  <div key={v.Id} className={`${styles.option} ${styles.optionCapped}`}>
                    <div className={styles.optionHead}>
                      <span className={styles.optionName}>{v.Name}</span>
                      <span className={styles.optionTier}>{scoreLabel}</span>
                      <span className={styles.badge}>maxed</span>
                    </div>
                  </div>
                ) : (
                  <button key={v.Id} className={styles.option} onClick={() => finishVirtueRaise(v.Id)}>
                    <div className={styles.optionHead}>
                      <span className={styles.optionName}>{v.Name}</span>
                      <span className={styles.optionTier}>{scoreLabel}</span>
                    </div>
                  </button>
                );
              })}
              <button className={`tap-inline ${modal.secondaryAction} ${styles.dismiss}`} onClick={() => { setAwaiting(null); setPendingAdvancement(null); }}>
                Back
              </button>
            </>
          ) : awaiting === 'theme' ? (
            <>
              {library.themes
                .filter((t) => t.Id !== sheet.Theme.ThemeId)
                .map((t) => (
                  <button key={t.Id} className={styles.option} onClick={() => finishThemeChange(t.Id)}>
                    <div className={styles.optionHead}>
                      <span className={styles.optionName}>{t.Name}</span>
                    </div>
                    <div className={styles.optionEffect}>{t.Description}</div>
                  </button>
                ))}
              <button className={`tap-inline ${modal.secondaryAction} ${styles.dismiss}`} onClick={() => { setAwaiting(null); setPendingAdvancement(null); }}>
                Back
              </button>
            </>
          ) : (
            <>
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

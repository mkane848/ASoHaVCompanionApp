import { useRef, useState } from 'react';
import type { StatusSeverity, RollTier, CharacterSheet, Library, StrainTag } from '@asohav/shared';
import { resistReduction, statusesAbsorb } from '@asohav/shared';
import { ArmorPicker } from '../../components/ArmorPicker.js';
import { StatusPicks, statusPicksReady, newStatusPick, type StatusPick } from '../../components/StatusPicks.js';
import { StrainTagFields } from '../../components/StrainTagFields.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { useDrama } from '../../lib/useDrama.js';
import { HeroRollBuilder, type HeroRollBuilderHandle } from '../roll/HeroRollBuilder.js';
import modal from '../../styles/modal.module.css';
import styles from './TakeStrainModal.module.css';
import { backdropClose } from '../../lib/backdropClose.js';

const TIER_BUTTONS: { tier: RollTier; label: string }[] = [
  { tier: 'Tier3', label: '10+' },
  { tier: 'Tier2', label: '7–9' },
  { tier: 'Tier1', label: 'Miss' },
];

const SEVERITIES: StatusSeverity[] = ['Minor', 'Major', 'Severe'];

export interface TakenStatus {
  Severity: StatusSeverity;
  Name: string;
  Description: string;
}

/** V0.6 slice 1: "When an NPC, Villain, effect, or some other source deals you Strain, you first
 *  Resist by either: rolling + relevant Virtue... taking a Status, or marking Armor." Records
 *  what the GM told you (an amount of incoming Strain), then lets you report one of these paths
 *  — this app never rolls dice for you, see CLAUDE.md. Whatever's left after the chosen method
 *  lands on the Strain track.
 *
 *  V0.7 slice 7: taking a Status may fill several slots at once (L531), and the tag on the hit (on
 *  the body, and an effect) decides which Armor may stop it (`armorFit`). Temporary Strain is spent
 *  by the caller (`takeStrainHit`), since it only matters once the leftover is known. */
export function TakeStrainModal({
  sheet,
  library,
  commit,
  freeSlots,
  onApply,
  onClose,
}: {
  sheet: CharacterSheet;
  library: Library;
  commit: (m: (d: CharacterSheet) => void) => void;
  /** How many slots of each severity are still open: a full severity can't be chosen to absorb Strain. */
  freeSlots: Record<StatusSeverity, number>;
  onApply: (finalStrain: number, takenStatuses: TakenStatus[], armorId: string | null) => void;
  onClose: () => void;
}) {
  // Raw text, not the clamped number, controls the input — see StatusesPanel.tsx's newRankText
  // for why clamping the value itself on every keystroke fights the user mid-edit.
  const [amountText, setAmountText] = useState('2');
  const [method, setMethod] = useState<'none' | 'resist' | 'status' | 'armor'>('none');
  const [tier, setTier] = useState<RollTier | null>(null);
  const [picks, setPicks] = useState<StatusPick[]>([]);
  const [tag, setTag] = useState<StrainTag | undefined>(undefined);
  const [pickedArmorId, setPickedArmorId] = useState<string | null>(null);

  const drama = useDrama();
  const builderRef = useRef<HeroRollBuilderHandle>(null);
  const parsedAmount = parseInt(amountText, 10);
  const amount = Number.isFinite(parsedAmount) ? Math.max(1, parsedAmount) : 1;
  const resistReductionAmount = method === 'resist' && tier ? resistReduction(tier) : 0;
  const absorbed = method === 'status' ? statusesAbsorb(picks.map((p) => p.Severity)) : 0;
  const finalStrain = method === 'armor' ? 0 : Math.max(0, amount - resistReductionAmount - absorbed);

  const readyArmor = sheet.Armor.filter((a) => !a.Used);
  const anyFreeSlot = SEVERITIES.some((s) => freeSlots[s] > 0);
  const canApply =
    method === 'none' ||
    (method === 'resist' && tier !== null) ||
    (method === 'status' && statusPicksReady(freeSlots, picks)) ||
    (method === 'armor' && pickedArmorId !== null);
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} {...backdropClose(onClose)}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="take-strain-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="take-strain-title" className={modal.title}>Take Strain</h2>
          <p className={modal.subtitle}>What the GM told you, plus how you Resisted it (if you did).</p>
        </div>
        <div className={modal.body}>
          <label className={styles.label} htmlFor="take-strain-amount">Incoming Strain</label>
          <input
            id="take-strain-amount"
            className={styles.input}
            type="number"
            min={1}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={() => setAmountText(String(amount))}
          />

          <StrainTagFields value={tag} onChange={(t) => { setTag(t); setPickedArmorId(null); }} idPrefix="take-strain-tag" />

          <div className={`tap-row ${styles.tierRow}`} role="group" aria-label="How did you Resist?">
            <button type="button" className={`tap-inline ${styles.toggle} ${method === 'resist' ? styles.toggleActive : ''}`} onClick={() => setMethod(method === 'resist' ? 'none' : 'resist')}>
              Roll to Resist
            </button>
            <button
              type="button"
              className={`tap-inline ${styles.toggle} ${method === 'status' ? styles.toggleActive : ''}`}
              disabled={!anyFreeSlot}
              onClick={() => {
                if (method === 'status') { setMethod('none'); return; }
                setMethod('status');
                if (picks.length === 0) setPicks([newStatusPick(freeSlots, [])]);
              }}
            >
              Take Statuses instead
            </button>
            <button
              type="button"
              className={`tap-inline ${styles.toggle} ${method === 'armor' ? styles.toggleActive : ''}`}
              disabled={readyArmor.length === 0}
              onClick={() => setMethod(method === 'armor' ? 'none' : 'armor')}
            >
              Mark Armor instead
            </button>
          </div>

          {method === 'resist' && (
            <div className={styles.resistBox}>
              <HeroRollBuilder ref={builderRef} mode="Resist" virtueId={null} sheet={sheet} library={library} commit={commit} />
              <label className={styles.label} id="take-strain-tier-label">Which tier did you roll?</label>
              <div className={`tap-row ${styles.tierRow}`} role="group" aria-labelledby="take-strain-tier-label">
                {TIER_BUTTONS.map((t) => (
                  <button
                    key={t.tier}
                    type="button"
                    aria-pressed={tier === t.tier}
                    className={`tap-inline ${styles.tierButton} ${tier === t.tier ? styles.tierButtonActive : ''}`}
                    onClick={() => setTier(t.tier)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className={styles.helpText}>10+ reduces it by 2 · 7–9 by 1 · 6- by 0, and the GM gains a Drama.</p>
            </div>
          )}

          {method === 'status' && (
            <div className={styles.resistBox}>
              <StatusPicks picks={picks} free={freeSlots} onChange={setPicks} idPrefix="take-strain-status" />
            </div>
          )}

          {method === 'armor' && (
            <div className={styles.resistBox}>
              <div className={styles.label}>Pick an Armor to mark</div>
              <ArmorPicker armor={readyArmor} library={library} tag={tag} value={pickedArmorId} onChange={setPickedArmorId} label="Pick an Armor to mark" />
            </div>
          )}

          <p className={styles.reductionNote}>
            {method === 'none' && `Strain marked: ${amount} (no Resist).`}
            {method === 'resist' && tier && `Reduces by ${resistReductionAmount}. Strain marked: ${finalStrain}.`}
            {method === 'status' && `Absorbs ${absorbed}. Strain marked: ${finalStrain}.`}
            {finalStrain > 0 && sheet.TempStrain > 0 && ' A Temporary Strain box takes the hit first.'}
            {method === 'armor' && `Armor negates it. Strain marked: 0.`}
          </p>

          <button
            className={`tap-inline ${modal.primaryAction}`}
            disabled={!canApply}
            onClick={() => {
              if (!canApply) return;
              if (method === 'resist' && tier === 'Tier1') {
                drama.gain('A 6- on a Resist');
              }
              if (method === 'resist') builderRef.current?.tierReported();
              const taken: TakenStatus[] = method === 'status' ? picks.map((p) => ({ Severity: p.Severity, Name: p.Name.trim(), Description: '' })) : [];
              const armorId = method === 'armor' ? pickedArmorId : null;
              onApply(finalStrain, taken, armorId);
            }}
          >
            Apply
          </button>
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

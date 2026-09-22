import { useState } from 'react';
import type { StatusSeverity, RollTier, CharacterSheet, Library } from '@asohav/shared';
import { resistReduction, statusAbsorb } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { HeroRollBuilder } from '../roll/HeroRollBuilder.js';
import modal from '../../styles/modal.module.css';
import styles from './TakeStrainModal.module.css';

const TIER_BUTTONS: { tier: RollTier; label: string }[] = [
  { tier: 'Tier3', label: '10+' },
  { tier: 'Tier2', label: '7–9' },
  { tier: 'Tier1', label: 'Miss' },
];

const SEVERITIES: StatusSeverity[] = ['Minor', 'Major', 'Severe'];

/** V0.6 slice 1: "When an NPC, Villain, effect, or some other source deals you Strain, you first
 *  Resist by either: rolling + relevant Virtue... taking a Status, or marking Armor." Records
 *  what the GM told you (an amount of incoming Strain), then lets you report one of these paths
 *  — this app never rolls dice for you, see CLAUDE.md. Whatever's left after the chosen method
 *  lands on the Strain track. */
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
  /** Which severities still have an open slot — a full severity can't be chosen to absorb Strain. */
  freeSlots: Record<StatusSeverity, boolean>;
  onApply: (finalStrain: number, takenStatus: { Severity: StatusSeverity; Name: string; Description: string } | null, armorId: string | null) => void;
  onClose: () => void;
}) {
  // Raw text, not the clamped number, controls the input — see StatusesPanel.tsx's newRankText
  // for why clamping the value itself on every keystroke fights the user mid-edit.
  const [amountText, setAmountText] = useState('2');
  const [method, setMethod] = useState<'none' | 'resist' | 'status' | 'armor'>('none');
  const [tier, setTier] = useState<RollTier | null>(null);
  const [severity, setSeverity] = useState<StatusSeverity>(SEVERITIES.find((s) => freeSlots[s]) ?? 'Minor');
  const [statusName, setStatusName] = useState('');
  const [statusDescription, setStatusDescription] = useState('');
  const [pickedArmorId, setPickedArmorId] = useState<string | null>(null);

  const parsedAmount = parseInt(amountText, 10);
  const amount = Number.isFinite(parsedAmount) ? Math.max(1, parsedAmount) : 1;
  const resistReductionAmount = method === 'resist' && tier ? resistReduction(tier) : 0;
  const absorbed = method === 'status' ? statusAbsorb(severity) : 0;
  const finalStrain = method === 'armor' ? 0 : Math.max(0, amount - resistReductionAmount - absorbed);

  const readyArmorIds = sheet.Armor.filter((a) => !a.Used).map((a) => a.Id);
  const canApply =
    method === 'none' ||
    (method === 'resist' && tier !== null) ||
    (method === 'status' && freeSlots[severity] && statusName.trim().length > 0) ||
    (method === 'armor' && pickedArmorId !== null);
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
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

          <div className={`tap-row ${styles.tierRow}`} role="group" aria-label="How did you Resist?">
            <button type="button" className={`tap-inline ${styles.toggle} ${method === 'resist' ? styles.toggleActive : ''}`} onClick={() => setMethod(method === 'resist' ? 'none' : 'resist')}>
              Roll to Resist
            </button>
            <button
              type="button"
              className={`tap-inline ${styles.toggle} ${method === 'status' ? styles.toggleActive : ''}`}
              disabled={!SEVERITIES.some((s) => freeSlots[s])}
              onClick={() => setMethod(method === 'status' ? 'none' : 'status')}
            >
              Take a Status instead
            </button>
            <button
              type="button"
              className={`tap-inline ${styles.toggle} ${method === 'armor' ? styles.toggleActive : ''}`}
              disabled={readyArmorIds.length === 0}
              onClick={() => setMethod(method === 'armor' ? 'none' : 'armor')}
            >
              Mark Armor instead
            </button>
          </div>

          {method === 'resist' && (
            <div className={styles.resistBox}>
              <HeroRollBuilder mode="Resist" virtueId={null} sheet={sheet} library={library} commit={commit} />
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
              <p className={styles.helpText}>10+ reduces it by 2 · 7–9 by 1 · 6- by 0, and the GM gains a Misfortune.</p>
            </div>
          )}

          {method === 'status' && (
            <div className={styles.resistBox}>
              <label className={styles.label} htmlFor="take-strain-severity">Severity (absorbs Strain: Minor 2 · Major 4 · Severe 6)</label>
              <select id="take-strain-severity" className={styles.select} value={severity} onChange={(e) => setSeverity(e.target.value as StatusSeverity)}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s} disabled={!freeSlots[s]}>
                    {s}{!freeSlots[s] ? ' (no free slot)' : ''}
                  </option>
                ))}
              </select>
              <label className={styles.label} htmlFor="take-strain-status-name">Status name</label>
              <input id="take-strain-status-name" className={styles.input} value={statusName} onChange={(e) => setStatusName(e.target.value)} placeholder="Broken Arm, Concussed…" />
              <label className={styles.label} htmlFor="take-strain-status-desc">Lasting effect (optional)</label>
              <input id="take-strain-status-desc" className={styles.input} value={statusDescription} onChange={(e) => setStatusDescription(e.target.value)} placeholder="What happened, and how it shows." />
            </div>
          )}

          {method === 'armor' && (
            <div className={styles.resistBox}>
              <div className={styles.label} id="take-strain-armor-label">Pick an Armor to mark</div>
              <div className="board" role="group" aria-labelledby="take-strain-armor-label">
                {sheet.Armor.filter((a) => !a.Used).map((a) => {
                  const armorType = library.armorTypes.find((t) => t.Id === a.ArmorTypeId);
                  return (
                    <button
                      key={a.Id}
                      type="button"
                      aria-pressed={pickedArmorId === a.Id}
                      className={`tap-inline posting ${styles.armorButton} ${pickedArmorId === a.Id ? styles.armorButtonActive : ''}`}
                      onClick={() => setPickedArmorId(pickedArmorId === a.Id ? null : a.Id)}
                    >
                      {armorType?.Name ?? a.ArmorTypeId} {a.SourceLabel && `(${a.SourceLabel})`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className={styles.reductionNote}>
            {method === 'none' && `Strain marked: ${amount} (no Resist).`}
            {method === 'resist' && tier && `Reduces by ${resistReductionAmount}. Strain marked: ${finalStrain}.`}
            {method === 'status' && `Absorbs ${absorbed}. Strain marked: ${finalStrain}.`}
            {method === 'armor' && `Armor negates it. Strain marked: 0.`}
          </p>

          <button
            className={`tap-inline ${modal.primaryAction}`}
            disabled={!canApply}
            onClick={() => {
              if (!canApply) return;
              const takenStatus = method === 'status' ? { Severity: severity, Name: statusName.trim(), Description: statusDescription.trim() } : null;
              const armorId = method === 'armor' ? pickedArmorId : null;
              onApply(finalStrain, takenStatus, armorId);
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

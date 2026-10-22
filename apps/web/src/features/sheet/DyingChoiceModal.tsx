import { useState } from 'react';
import type { DyingChoiceInput, RollTier } from '@asohav/shared';
import { MAX_DEATH_TEXT, MAX_SCARS } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './DyingChoiceModal.module.css';

type Choice = 'Scar' | 'RiskDeath' | 'BlazeOfGlory';

const CHOICES: { key: Choice; label: string; blurb: string }[] = [
  { key: 'Scar', label: 'Take a Scar', blurb: 'A near-permanent change. You stay Dying, and can then mark a second Strain in each box.' },
  { key: 'RiskDeath', label: 'Risk Death', blurb: 'Roll +Nothing at the table. No one can help you with this roll.' },
  { key: 'BlazeOfGlory', label: 'Blaze of Glory', blurb: 'One final heroic achievement, then your Hero dies.' },
];

const TIERS: { tier: RollTier; label: string; result: string }[] = [
  { tier: 'Tier3', label: '10+', result: 'You live, for now. Remove 1 Strain. You are no longer Dying.' },
  { tier: 'Tier2', label: '7–9', result: 'You live, still Dying, at great cost. The GM decides what Scar you take. Accept it or perish.' },
  { tier: 'Tier1', label: '6-', result: 'You are going to die shortly. What are the last things you experience? What are your last words?' },
];

/** The Dying choice (V0.7 slice 8b, Ruleset-V0.7.md L615-656). The app never rolls: for Risk Death the
 *  player reports the tier the table rolled, and `onSubmit` sends it to the server, which applies
 *  the consequence. Opened by the Hero's player or the GM; a non-blocking prompt, never a gate. */
export function DyingChoiceModal({
  heroName,
  scarCount,
  onSubmit,
  onClose,
}: {
  heroName: string;
  scarCount: number;
  onSubmit: (input: DyingChoiceInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [tier, setTier] = useState<RollTier | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const fourth = scarCount + 1 >= MAX_SCARS;
  const scarFlow = choice === 'Scar' || (choice === 'RiskDeath' && tier === 'Tier2');
  const textLabel =
    choice === 'Scar' ? 'The Scar' :
    choice === 'BlazeOfGlory' ? 'Your final heroic achievement' :
    tier === 'Tier2' ? 'The Scar the GM chose' :
    tier === 'Tier1' ? 'Last words (optional)' : '';
  const needsText = choice === 'Scar' || choice === 'BlazeOfGlory' || (choice === 'RiskDeath' && tier === 'Tier2');
  const ready = choice === 'RiskDeath' ? tier !== null && (tier !== 'Tier2' || text.trim() !== '') : choice !== null && text.trim() !== '';

  async function submit(input: DyingChoiceInput) {
    setBusy(true);
    const ok = await onSubmit(input);
    setBusy(false);
    if (ok) onClose();
  }

  function build(accept: boolean): DyingChoiceInput | null {
    if (choice === 'Scar') return { Choice: 'Scar', ScarText: text, Note: note };
    if (choice === 'BlazeOfGlory') return { Choice: 'BlazeOfGlory', Text: text };
    if (choice === 'RiskDeath' && tier === 'Tier2') return accept ? { Choice: 'RiskDeath', Tier: tier, ScarText: text, Accept: true, Note: note } : { Choice: 'RiskDeath', Tier: tier, Accept: false, Text: text };
    if (choice === 'RiskDeath' && tier) return { Choice: 'RiskDeath', Tier: tier, Text: text };
    return null;
  }

  const input = ready ? build(true) : null;
  const dies = choice === 'BlazeOfGlory' || (choice === 'RiskDeath' && tier === 'Tier1');

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dying-choice-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="dying-choice-title" className={modal.title}>{heroName} is Dying</h2>
          <p className={modal.subtitle}>Choose how {heroName} meets it. You can keep playing until you do.</p>
        </div>
        <div className={modal.body}>
          <div className={styles.choices} role="group" aria-label="Dying choice">
            {CHOICES.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={choice === c.key}
                className={`tap-inline ${styles.choice} ${choice === c.key ? styles.active : ''}`}
                onClick={() => { setChoice(c.key); setTier(null); }}
              >
                <strong>{c.label}</strong>
                <span className={styles.blurb}>{c.blurb}</span>
              </button>
            ))}
          </div>

          {choice === 'RiskDeath' && (
            <>
              <p className={styles.label} id="risk-tier-label">Roll +Nothing at the table. Which tier?</p>
              <div className={`tap-row ${styles.tierRow}`} role="group" aria-labelledby="risk-tier-label">
                {TIERS.map((t) => (
                  <button key={t.tier} type="button" aria-pressed={tier === t.tier} className={`tap-inline ${styles.tier} ${tier === t.tier ? styles.active : ''}`} onClick={() => setTier(t.tier)}>
                    {t.label}
                  </button>
                ))}
              </div>
              {tier && <p className={styles.note}>{TIERS.find((t) => t.tier === tier)!.result}</p>}
            </>
          )}

          {needsText || (choice === 'RiskDeath' && tier === 'Tier1') ? (
            <>
              <label className={styles.label} htmlFor="dying-text">{textLabel}</label>
              <textarea id="dying-text" className={modal.textarea} rows={3} maxLength={MAX_DEATH_TEXT} value={text} onChange={(e) => setText(e.target.value)} />
            </>
          ) : null}

          {scarFlow && fourth && (
            <>
              <p className={styles.warn}>This would be {heroName}&rsquo;s fourth Scar. It is recorded as the final one and {heroName} is Retired. Work out a fitting ending with the table.</p>
              <label className={styles.label} htmlFor="dying-note">Retirement note (optional)</label>
              <textarea id="dying-note" className={modal.textarea} rows={2} maxLength={MAX_DEATH_TEXT} value={note} onChange={(e) => setNote(e.target.value)} />
            </>
          )}

          {dies && <p className={styles.warn}>{heroName} dies. Their sheet becomes read-only.</p>}

          {choice === 'RiskDeath' && tier === 'Tier2' ? (
            <>
              <button className={`tap-inline ${modal.primaryAction}`} disabled={!input || busy} onClick={() => input && void submit(input)}>
                Accept the Scar
              </button>
              <button className={`tap-inline ${modal.secondaryAction} ${styles.perish}`} disabled={busy} onClick={() => { const i = build(false); if (i) void submit(i); }}>
                Refuse it and perish
              </button>
            </>
          ) : (
            <button className={`tap-inline ${modal.primaryAction}`} disabled={!input || busy} onClick={() => input && void submit(input)}>
              {dies ? `Record ${heroName}’s death` : 'Record it'}
            </button>
          )}
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}

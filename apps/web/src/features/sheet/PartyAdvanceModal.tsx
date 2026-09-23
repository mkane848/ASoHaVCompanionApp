import { useState } from 'react';
import type { Library, Party, PartyAdvanceOption, PartyTagKind } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { Field } from '../../components/form/Field.js';
import { Select } from '../../components/form/Select.js';
import { TextInput } from '../../components/form/TextInput.js';
import modal from '../../styles/modal.module.css';
import styles from './PartyAdvanceModal.module.css';

const PARTY_OPTION_LABELS: Record<PartyAdvanceOption, string> = {
  AddSkillTag: 'Add a Skill Tag',
  AddFlawTag: 'Add a Flaw Tag',
  RemoveFlawTag: 'Remove a Flaw Tag',
  GainImprovement: 'Gain a Party Improvement',
};

const OPTIONS: PartyAdvanceOption[] = ['AddSkillTag', 'AddFlawTag', 'RemoveFlawTag', 'GainImprovement'];

/** "Then you may then rewrite or update any one of your Skill or Flaw Tags" — named by the tag's
 *  current text rather than its index, so it still finds the right tag after a Flaw Tag is removed. */
export interface PartyTagRewrite {
  kind: PartyTagKind;
  from: string;
  to: string;
}

export interface PartyAdvanceChoice {
  option: PartyAdvanceOption;
  /** The new tag for AddSkillTag/AddFlawTag, or the Flaw Tag to remove. */
  tag?: string;
  improvement?: { Name: string; Effect: string };
  rewrite?: PartyTagRewrite;
}

const CUSTOM = 'custom';

/** Progress the Party (revised V0.6, "Party Advancement — Rapport"): "reduce your Rapport Track by 5
 *  and choose one unique option — Add a Skill Tag for your Party Motif. Add or Remove a Flaw Tag for
 *  your Party Motif. Gain a Party Improvement. Then you may then rewrite or update any one of your
 *  Skill or Flaw Tags." One form: pick the option and fill in what it needs, optionally rewrite a
 *  tag, confirm. A Party Improvement comes from the library's list (a non-`Repeatable` one only
 *  once) or is written on the spot. Lazy-loaded from `AdvancementPanel.tsx` — a rarely-triggered
 *  modal, only shown when a full Rapport track needs clearing. */
export function PartyAdvanceModal({
  party,
  library,
  onChoose,
  onClose,
}: {
  party: Party;
  library: Library;
  onChoose: (choice: PartyAdvanceChoice) => void;
  onClose: () => void;
}) {
  const [option, setOption] = useState<PartyAdvanceOption | null>(null);
  const [skillDraft, setSkillDraft] = useState('');
  const [flawDraft, setFlawDraft] = useState('');
  const [flawToRemove, setFlawToRemove] = useState(party.FlawTags[0] ?? '');
  const [improvementId, setImprovementId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customEffect, setCustomEffect] = useState('');
  const [rewriteKey, setRewriteKey] = useState('');
  const [rewriteText, setRewriteText] = useState('');
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  const availableImprovements = library.partyImprovements.filter(
    (imp) => imp.Repeatable || !party.RapportImprovementsTaken.some((taken) => taken.Name === imp.Name),
  );
  const libraryImprovement = availableImprovements.find((imp) => imp.Id === improvementId);

  // The tags as they'll stand after the chosen option, since the rewrite comes "then".
  const skillTags = option === 'AddSkillTag' && skillDraft.trim() ? [...party.SkillTags, skillDraft.trim()] : party.SkillTags;
  const flawTags =
    option === 'AddFlawTag' && flawDraft.trim()
      ? [...party.FlawTags, flawDraft.trim()]
      : option === 'RemoveFlawTag'
        ? party.FlawTags.filter((t) => t !== flawToRemove)
        : party.FlawTags;
  const rewritable = [
    ...skillTags.map((text) => ({ key: `Skill:${text}`, kind: 'Skill' as const, text })),
    ...flawTags.map((text) => ({ key: `Flaw:${text}`, kind: 'Flaw' as const, text })),
  ];
  const rewriting = rewritable.find((t) => t.key === rewriteKey);

  function choice(): PartyAdvanceChoice | null {
    const to = rewriteText.trim();
    const rewrite = rewriting && to && to !== rewriting.text ? { kind: rewriting.kind, from: rewriting.text, to } : undefined;
    switch (option) {
      case 'AddSkillTag':
        return skillDraft.trim() ? { option, tag: skillDraft.trim(), rewrite } : null;
      case 'AddFlawTag':
        return flawDraft.trim() ? { option, tag: flawDraft.trim(), rewrite } : null;
      case 'RemoveFlawTag':
        return flawToRemove ? { option, tag: flawToRemove, rewrite } : null;
      case 'GainImprovement':
        if (improvementId === CUSTOM) {
          return customName.trim() && customEffect.trim()
            ? { option, improvement: { Name: customName.trim(), Effect: customEffect.trim() }, rewrite }
            : null;
        }
        return libraryImprovement
          ? { option, improvement: { Name: libraryImprovement.Name, Effect: libraryImprovement.Description }, rewrite }
          : null;
      default:
        return null;
    }
  }

  const ready = choice();

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby="party-advance-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 id="party-advance-title" className={modal.title}>Progress the Party</h2>
          <p className={modal.subtitle}>The Rapport track is full. Reduce it by 5 and choose one.</p>
        </div>
        <div className={modal.body}>
          <div className={`tap-row ${styles.options}`} role="group" aria-label="Choose one">
            {OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={option === o}
                className={`tap-inline ${styles.optionButton} ${option === o ? styles.optionButtonActive : ''}`}
                disabled={o === 'RemoveFlawTag' && party.FlawTags.length === 0}
                onClick={() => setOption(o)}
              >
                {PARTY_OPTION_LABELS[o]}
              </button>
            ))}
          </div>

          {option === 'AddSkillTag' && (
            <Field label="New Skill Tag" htmlFor="party-advance-skill">
              <TextInput id="party-advance-skill" value={skillDraft} placeholder="Type the new Skill Tag…" onChange={(e) => setSkillDraft(e.target.value)} />
            </Field>
          )}
          {option === 'AddFlawTag' && (
            <Field label="New Flaw Tag" htmlFor="party-advance-flaw">
              <TextInput id="party-advance-flaw" value={flawDraft} placeholder="Type the new Flaw Tag…" onChange={(e) => setFlawDraft(e.target.value)} />
            </Field>
          )}
          {option === 'RemoveFlawTag' && (
            <Field label="Which Flaw Tag?" htmlFor="party-advance-remove">
              <Select id="party-advance-remove" value={flawToRemove} onChange={(e) => setFlawToRemove(e.target.value)}>
                {party.FlawTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>
          )}
          {option === 'GainImprovement' && (
            <>
              <Field label="Party Improvement" htmlFor="party-advance-improvement">
                <Select id="party-advance-improvement" value={improvementId} onChange={(e) => setImprovementId(e.target.value)}>
                  <option value="">Choose one…</option>
                  {availableImprovements.map((imp) => (
                    <option key={imp.Id} value={imp.Id}>{imp.Name}</option>
                  ))}
                  <option value={CUSTOM}>Write your own</option>
                </Select>
              </Field>
              {libraryImprovement && <p className={styles.hint}>{libraryImprovement.Description}</p>}
              {improvementId === CUSTOM && (
                <>
                  <Field label="Name" htmlFor="party-advance-custom-name">
                    <TextInput id="party-advance-custom-name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                  </Field>
                  <Field label="What it does" htmlFor="party-advance-custom-effect">
                    <TextInput id="party-advance-custom-effect" value={customEffect} onChange={(e) => setCustomEffect(e.target.value)} />
                  </Field>
                </>
              )}
            </>
          )}

          {option && rewritable.length > 0 && (
            <div className={styles.rewriteSection}>
              <Field label="Then you may rewrite one Skill or Flaw Tag" htmlFor="party-advance-rewrite">
                <Select
                  id="party-advance-rewrite"
                  value={rewriting ? rewriteKey : ''}
                  onChange={(e) => {
                    setRewriteKey(e.target.value);
                    setRewriteText(rewritable.find((t) => t.key === e.target.value)?.text ?? '');
                  }}
                >
                  <option value="">Leave the tags as they are</option>
                  {rewritable.map((t) => (
                    <option key={t.key} value={t.key}>{t.kind} Tag: {t.text}</option>
                  ))}
                </Select>
              </Field>
              {rewriting && (
                <TextInput aria-label={`Rewrite the ${rewriting.kind} Tag "${rewriting.text}"`} value={rewriteText} onChange={(e) => setRewriteText(e.target.value)} />
              )}
            </div>
          )}

          <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={!ready} onClick={() => { if (ready) onChoose(ready); }}>
            Progress the Party
          </button>
          <button type="button" className={`tap-inline ${modal.secondaryAction} ${styles.dismiss}`} onClick={onClose}>
            Not yet — keep the track full
          </button>
        </div>
      </div>
    </div>
  );
}

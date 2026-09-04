import { useState } from 'react';
import type { Adventure, AdventureSecret, AdventureType, CampaignBootstrap, Library } from '@asohav/shared';
import { ADVENTURE_TYPES, currentCountdownStep, newId, SUGGESTED_SECRET_COUNT, tickAdventureCountdown } from '@asohav/shared';
import { useAdventureActions } from '../../lib/mutations.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import { Field } from '../../components/form/Field.js';
import { Select } from '../../components/form/Select.js';
import { SectionHead } from '../../components/SectionHead.js';
import styles from './AdventuresPanel.module.css';

function NewAdventureForm({ onCreate, onCancel }: { onCreate: (concept: string, type: AdventureType | null, hook: string) => void; onCancel: () => void }) {
  const [concept, setConcept] = useState('');
  const [type, setType] = useState<AdventureType | ''>('');
  const [hook, setHook] = useState('');
  return (
    <div className={styles.newForm}>
      <label className={styles.formLabel} htmlFor="new-adv-concept">Concept</label>
      <textarea
        id="new-adv-concept"
        className={styles.formTextarea}
        placeholder="In a small hamlet, a pack of goblins…"
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
      />
      <label className={styles.formLabel} htmlFor="new-adv-type">Type</label>
      <select id="new-adv-type" className={styles.formInput} value={type} onChange={(e) => setType(e.target.value as AdventureType | '')}>
        <option value="">— Choose a Type —</option>
        {ADVENTURE_TYPES.map((t) => (
          <option key={t.key} value={t.key}>{t.label}</option>
        ))}
      </select>
      <label className={styles.formLabel} htmlFor="new-adv-hook">Hook</label>
      <textarea
        id="new-adv-hook"
        className={styles.formTextarea}
        placeholder="Devastated and desperate for help, Rosa the Blacksmith barges in…"
        value={hook}
        onChange={(e) => setHook(e.target.value)}
      />
      <div className={`action-grid ${styles.newFormActions}`}>
        <button className={`tap-inline ${styles.lightButton}`} disabled={!concept.trim()} onClick={() => onCreate(concept.trim(), type || null, hook.trim())}>
          Start Adventure
        </button>
        <button className={`tap-inline ${styles.lightButton}`} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SecretRow({
  secret,
  readOnly,
  onSave,
  onRemove,
}: {
  secret: AdventureSecret;
  readOnly: boolean;
  onSave: (s: AdventureSecret) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.secretRow}>
      <textarea
        aria-label="Secret"
        className={`${styles.secretText} ${secret.Revealed ? styles.secretRevealed : ''}`}
        defaultValue={secret.Text}
        placeholder="A single, evocative sentence…"
        disabled={readOnly}
        onBlur={(e) => onSave({ ...secret, Text: e.target.value })}
      />
      <div className={styles.secretActions}>
        <button type="button" className={`tap-inline ${styles.secretToggle}`} disabled={readOnly} onClick={() => onSave({ ...secret, Revealed: !secret.Revealed })}>
          {secret.Revealed ? 'Revealed' : 'Reveal'}
        </button>
        <button type="button" className={`tap-inline ${styles.secretRemove}`} disabled={readOnly} onClick={onRemove} aria-label="Remove Secret">
          &times;
        </button>
      </div>
    </div>
  );
}

function AdventureCard({
  adventure,
  library,
  archived,
  onSave,
  onRemove,
}: {
  adventure: Adventure;
  library: Library;
  archived: boolean;
  onSave: (a: Adventure) => void;
  onRemove: () => void;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // A Concluded Adventure locks its own fields, same treatment a Resolved Clock already gets
  // (ClocksPanel.tsx) — nothing about a finished story should keep mutating. Reopen/Remove stay
  // available regardless (gated on `archived` alone, below), since those are the two actions that
  // make sense to take *on* a Concluded Adventure.
  const readOnly = archived || adventure.Status === 'Concluded';
  const typeDef = ADVENTURE_TYPES.find((t) => t.key === adventure.Type);
  const currentStep = currentCountdownStep(adventure);

  function commit(mutator: (draft: Adventure) => void) {
    const draft: Adventure = structuredClone(adventure);
    mutator(draft);
    onSave(draft);
  }

  function toggleRef(field: 'NpcIds' | 'LocationIds', id: string) {
    commit((d) => {
      d[field] = d[field].includes(id) ? d[field].filter((x) => x !== id) : [...d[field], id];
    });
  }

  function addSecret() {
    commit((d) => { d.Secrets.push({ Id: newId('sec'), Text: '', Revealed: false }); });
  }

  function saveSecret(secret: AdventureSecret) {
    commit((d) => { d.Secrets = d.Secrets.map((s) => (s.Id === secret.Id ? secret : s)); });
  }

  function removeSecret(id: string) {
    commit((d) => { d.Secrets = d.Secrets.filter((s) => s.Id !== id); });
  }

  function tickCountdown(delta: number) {
    commit((d) => { d.CountdownMarks = tickAdventureCountdown(d, delta); });
  }

  function saveStepText(index: number, text: string) {
    commit((d) => { d.CountdownSteps[index] = { ...d.CountdownSteps[index], Text: text }; });
  }

  return (
    <div className={`${styles.card} ${adventure.Status === 'Concluded' ? styles.cardConcluded : ''}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>{adventure.Concept || 'Untitled Adventure'}</h2>
        {typeDef && <span className={styles.badge}>{typeDef.label}</span>}
        {adventure.Status === 'Concluded' && <span className={styles.concludedBadge}>Concluded</span>}
        <button className={`tap-inline ${styles.removeButton}`} onClick={() => setConfirmingRemove(true)} aria-label={`Remove ${adventure.Concept || 'this Adventure'}`}>
          &times;
        </button>
      </div>

      <div className={styles.field}>
        <Field label="Concept" htmlFor={`adv-concept-${adventure.Id}`}>
          <textarea
            id={`adv-concept-${adventure.Id}`}
            className={styles.textarea}
            defaultValue={adventure.Concept}
            disabled={readOnly}
            onBlur={(e) => commit((d) => { d.Concept = e.target.value.trim(); })}
          />
        </Field>
      </div>

      <div className={styles.field}>
        <Field label="Type" htmlFor={`adv-type-${adventure.Id}`}>
          <Select
            id={`adv-type-${adventure.Id}`}
            value={adventure.Type ?? ''}
            disabled={readOnly}
            onChange={(e) => commit((d) => { d.Type = (e.target.value || null) as Adventure['Type']; })}
          >
            <option value="">— Choose a Type —</option>
            {ADVENTURE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </Select>
        </Field>
        {typeDef && <p className={`prose ${styles.secretHint}`}>{typeDef.summary} Elements to include: {typeDef.elements}</p>}
      </div>

      <div className={styles.field}>
        <Field label="Hook" htmlFor={`adv-hook-${adventure.Id}`}>
          <textarea
            id={`adv-hook-${adventure.Id}`}
            className={styles.textarea}
            defaultValue={adventure.Hook}
            disabled={readOnly}
            onBlur={(e) => commit((d) => { d.Hook = e.target.value.trim(); })}
          />
        </Field>
      </div>

      <h3 id={`adv-villain-heading-${adventure.Id}`} className={styles.sectionLabel}>Villain</h3>
      <Select
        aria-labelledby={`adv-villain-heading-${adventure.Id}`}
        value={adventure.VillainId ?? ''}
        disabled={readOnly}
        onChange={(e) => commit((d) => { d.VillainId = e.target.value || null; })}
      >
        <option value="">— None —</option>
        {library.villains.map((v) => (
          <option key={v.Id} value={v.Id}>{v.Name}</option>
        ))}
      </Select>

      <div className={styles.refPair}>
        <div>
          <h3 id={`adv-npcs-heading-${adventure.Id}`} className={styles.sectionLabel}>NPCs</h3>
          {library.npcs.length === 0 && <p className={styles.empty}>No NPCs authored yet — add some in Content Admin.</p>}
          <div role="group" aria-labelledby={`adv-npcs-heading-${adventure.Id}`} className={styles.refList}>
            {library.npcs.map((npc) => (
              <CheckboxRow key={npc.Id} checked={adventure.NpcIds.includes(npc.Id)} disabled={readOnly} onToggle={() => toggleRef('NpcIds', npc.Id)}>
                {npc.Name}
              </CheckboxRow>
            ))}
          </div>
        </div>

        <div>
          <h3 id={`adv-locations-heading-${adventure.Id}`} className={styles.sectionLabel}>Locations</h3>
          {library.locations.length === 0 && <p className={styles.empty}>No Locations authored yet — add some in Content Admin.</p>}
          <div role="group" aria-labelledby={`adv-locations-heading-${adventure.Id}`} className={styles.refList}>
            {library.locations.map((loc) => (
              <CheckboxRow key={loc.Id} checked={adventure.LocationIds.includes(loc.Id)} disabled={readOnly} onToggle={() => toggleRef('LocationIds', loc.Id)}>
                {loc.Name}
              </CheckboxRow>
            ))}
          </div>
        </div>
      </div>

      <h3 className={styles.sectionLabel}>Secrets</h3>
      <p className={`prose ${styles.secretHint}`}>Aim for about {SUGGESTED_SECRET_COUNT} — floating, never tied to a specific NPC or Location.</p>
      {adventure.Secrets.map((s) => (
        <SecretRow key={s.Id} secret={s} readOnly={readOnly} onSave={saveSecret} onRemove={() => removeSecret(s.Id)} />
      ))}
      {!readOnly && (
        <button type="button" className={`tap-inline ${styles.lightButton}`} onClick={addSecret}>
          + Secret
        </button>
      )}

      <h3 className={styles.sectionLabel}>Countdown</h3>
      <p className={styles.countdownReadout}>
        {currentStep ? <>Currently at: <strong>{currentStep.Name}</strong></> : 'Not begun.'}
      </p>
      <div className={styles.segments}>
        {adventure.CountdownSteps.map((_, i) => (
          <span key={i} className={`${styles.segment} ${i < adventure.CountdownMarks ? styles.segmentFilled : ''}`} />
        ))}
      </div>
      {!readOnly && (
        <div className={`action-grid ${styles.tickRow}`}>
          <button className={`tap-inline ${styles.actionButton}`} disabled={adventure.CountdownMarks >= adventure.CountdownSteps.length} onClick={() => tickCountdown(1)}>Advance</button>
          <button className={`tap-inline ${styles.actionButton}`} disabled={adventure.CountdownMarks <= 0} onClick={() => tickCountdown(-1)}>Back up</button>
        </div>
      )}
      {adventure.CountdownSteps.map((step, i) => (
        <div key={step.Name} className={styles.stepRow}>
          <label className={`${styles.stepName} ${i === adventure.CountdownMarks - 1 ? styles.stepReached : ''}`} htmlFor={`adv-step-${adventure.Id}-${step.Name}`}>
            {step.Name}
          </label>
          <textarea
            id={`adv-step-${adventure.Id}-${step.Name}`}
            className={styles.textarea}
            defaultValue={step.Text}
            disabled={readOnly}
            placeholder="What happens at this stage if the Heroes don't interfere…"
            onBlur={(e) => saveStepText(i, e.target.value)}
          />
        </div>
      ))}

      {!archived && (
        <div className={styles.footer}>
          <button
            className={`tap-inline ${styles.actionButton}`}
            onClick={() => commit((d) => { d.Status = d.Status === 'Active' ? 'Concluded' : 'Active'; })}
          >
            {adventure.Status === 'Active' ? 'Conclude Adventure' : 'Reopen Adventure'}
          </button>
        </div>
      )}

      {confirmingRemove && (
        <ConfirmModal
          title="Remove this Adventure?"
          body={`${adventure.Concept || 'This Adventure'} will be removed. This can't be undone from here.`}
          confirmLabel="Remove"
          onConfirm={() => { onRemove(); setConfirmingRemove(false); }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  );
}

export function AdventuresPanel({ campaignId, boot, library }: { campaignId: string; boot: CampaignBootstrap; library: Library }) {
  const archived = boot.campaign.Status === 'Archived';
  const adventureActions = useAdventureActions(campaignId);
  const [creating, setCreating] = useState(false);
  const [showConcluded, setShowConcluded] = useState(false);

  const active = boot.adventures.filter((a) => a.Status === 'Active');
  const concluded = boot.adventures.filter((a) => a.Status === 'Concluded');

  return (
    <div>
      {!archived && (
        creating ? (
          <NewAdventureForm
            onCreate={(concept, type, hook) => {
              adventureActions.create(concept, type, hook);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button className={`tap-inline ${styles.lightButton}`} onClick={() => setCreating(true)}>
            New Adventure
          </button>
        )
      )}

      {active.length === 0 && <p className={styles.empty}>No Adventures right now.</p>}
      {active.map((a) => (
        <AdventureCard key={a.Id} adventure={a} library={library} archived={archived} onSave={adventureActions.save} onRemove={() => adventureActions.remove(a.Id)} />
      ))}

      {concluded.length > 0 && (
        <>
          <SectionHead
            title="Concluded"
            size="sm"
            extra={
              <button type="button" className={`tap-inline ${styles.lightButton}`} onClick={() => setShowConcluded((v) => !v)} aria-expanded={showConcluded}>
                {showConcluded ? 'Hide' : 'Show'} ({concluded.length})
              </button>
            }
          />
          {showConcluded &&
            concluded.map((a) => (
              <AdventureCard key={a.Id} adventure={a} library={library} archived={archived} onSave={adventureActions.save} onRemove={() => adventureActions.remove(a.Id)} />
            ))}
        </>
      )}
    </div>
  );
}

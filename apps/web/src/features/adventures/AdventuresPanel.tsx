import { lazy, Suspense, useState } from 'react';
import type { Adventure, AdventureSecret, AdventureType, CampaignBootstrap, GlossaryMatcher, GmContentKind, Library } from '@asohav/shared';
import { ADVENTURE_TYPES, canEditGmContent, currentCountdownStep, newId, SUGGESTED_SECRET_COUNT, tickAdventureCountdown } from '@asohav/shared';
import { useAdventureActions } from '../../lib/mutations.js';
import { useLibraryWithGmContent } from '../../lib/useGmContent.js';
import { useMe } from '../../lib/useMe.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import { Field } from '../../components/form/Field.js';
import { ProseField } from '../../components/form/ProseField.js';
import { Select } from '../../components/form/Select.js';
import { SectionHead } from '../../components/SectionHead.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { gmContentLabel, readOnlyExplanation, unresolvedIds, type GmEntry } from './gmContentUi.js';
import styles from './AdventuresPanel.module.css';

// The authoring form pulls in Content Admin's whole field editor (stat-block editor included), which
// a GM only needs once they tap "New …"/"Edit" — so it loads then, not with the Adventure Prep page.
const GmContentFormModal = lazy(() => import('./GmContentFormModal.js').then((m) => ({ default: m.GmContentFormModal })));

/** Who is looking — decides which GM-authored entries get an Edit button. */
interface Viewer {
  userId: string;
  isAdmin: boolean;
}

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
  matcher,
  onSave,
  onRemove,
}: {
  secret: AdventureSecret;
  readOnly: boolean;
  matcher: GlossaryMatcher | null;
  onSave: (s: AdventureSecret) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.secretRow}>
      <ProseField
        label="Secret"
        className={`${styles.secretText} ${secret.Revealed ? styles.secretRevealed : ''}`}
        value={secret.Text}
        placeholder="A single, evocative sentence…"
        disabled={readOnly}
        matcher={matcher}
        onCommit={(next) => onSave({ ...secret, Text: next })}
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
  viewer,
  archived,
  onSave,
  onRemove,
}: {
  adventure: Adventure;
  library: Library;
  viewer: Viewer;
  archived: boolean;
  onSave: (a: Adventure) => void;
  onRemove: () => void;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // Which authoring form is open: a new entry of a kind, or an existing one being edited.
  const [authoring, setAuthoring] = useState<{ kind: GmContentKind; entry?: GmEntry } | null>(null);
  // A Concluded Adventure locks its own fields, same treatment a Resolved Clock already gets
  // (ClocksPanel.tsx) — nothing about a finished story should keep mutating. Reopen/Remove stay
  // available regardless (gated on `archived` alone, below), since those are the two actions that
  // make sense to take *on* a Concluded Adventure.
  const readOnly = archived || adventure.Status === 'Concluded';
  // Adventure Prep's prose fields link glossary terms as of open issue 21 — see ProseField.
  const matcher = useGlossaryMatcher();
  const typeDef = ADVENTURE_TYPES.find((t) => t.key === adventure.Type);
  const currentStep = currentCountdownStep(adventure);

  // A reference can outlive its target: an author may delete a site-wide entry, or switch it back to
  // "just my campaigns", after another GM has put it in an Adventure. Those ids stay on the
  // Adventure (nothing here may drop them silently) and show as a row the GM can clear.
  const selectedVillain = adventure.VillainId ? library.villains.find((v) => v.Id === adventure.VillainId) : undefined;
  const villainUnavailable = Boolean(adventure.VillainId) && !selectedVillain;
  const canEditVillain = selectedVillain ? canEditGmContent(selectedVillain, viewer.userId, viewer.isAdmin) : false;
  const villainNote = selectedVillain ? readOnlyExplanation(selectedVillain, canEditVillain) : null;
  const missingNpcIds = unresolvedIds(adventure.NpcIds, library.npcs);

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

  // A freshly created entry is attached to this Adventure straight away — the GM wrote it *for*
  // this story, and making them find it again in the picker is a step with no purpose.
  function handleAuthored(saved: GmEntry, created: boolean) {
    const kind = authoring?.kind;
    setAuthoring(null);
    if (!created) return;
    if (kind === 'villain') commit((d) => { d.VillainId = saved.Id; });
    else commit((d) => { if (!d.NpcIds.includes(saved.Id)) d.NpcIds.push(saved.Id); });
  }

  // Deleting an entry this Adventure uses would otherwise leave an "Unavailable" row behind for the
  // one deletion the GM just made on purpose; other Adventures that reference it still get that row.
  function handleAuthoredDeleted(id: string) {
    if (adventure.VillainId !== id && !adventure.NpcIds.includes(id)) return;
    commit((d) => {
      if (d.VillainId === id) d.VillainId = null;
      d.NpcIds = d.NpcIds.filter((x) => x !== id);
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
          <ProseField
            id={`adv-concept-${adventure.Id}`}
            label="Concept"
            className={styles.textarea}
            value={adventure.Concept}
            disabled={readOnly}
            matcher={matcher}
            onCommit={(next) => commit((d) => { d.Concept = next.trim(); })}
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
          <ProseField
            id={`adv-hook-${adventure.Id}`}
            label="Hook"
            className={styles.textarea}
            value={adventure.Hook}
            disabled={readOnly}
            matcher={matcher}
            onCommit={(next) => commit((d) => { d.Hook = next.trim(); })}
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
        {villainUnavailable && <option value={adventure.VillainId ?? ''} disabled>Unavailable Villain</option>}
        {library.villains.map((v) => (
          <option key={v.Id} value={v.Id}>{gmContentLabel(v, viewer.userId)}</option>
        ))}
      </Select>
      {villainUnavailable && (
        <div className={styles.unavailable}>
          <span className={styles.unavailableText}>This Adventure&rsquo;s Villain is no longer available — its author may have deleted it or made it private.</span>
          <button type="button" className={`tap-inline ${styles.actionButton}`} disabled={readOnly} onClick={() => commit((d) => { d.VillainId = null; })}>
            Clear Villain
          </button>
        </div>
      )}
      {villainNote && <p className={`prose ${styles.secretHint}`}>{villainNote}</p>}
      <div className={`action-grid ${styles.authorActions}`}>
        <button type="button" className={`tap-inline ${styles.actionButton}`} disabled={readOnly} onClick={() => setAuthoring({ kind: 'villain' })}>
          New Villain…
        </button>
        {selectedVillain && canEditVillain && (
          <button type="button" className={`tap-inline ${styles.actionButton}`} disabled={readOnly} onClick={() => setAuthoring({ kind: 'villain', entry: selectedVillain })}>
            Edit Villain
          </button>
        )}
      </div>

      <div className={styles.refPair}>
        <div>
          <h3 id={`adv-npcs-heading-${adventure.Id}`} className={styles.sectionLabel}>NPCs</h3>
          <div className={`action-grid ${styles.authorActions}`}>
            <button type="button" className={`tap-inline ${styles.actionButton}`} disabled={readOnly} onClick={() => setAuthoring({ kind: 'npc' })}>
              New NPC…
            </button>
          </div>
          {library.npcs.length === 0 && <p className={styles.empty}>No NPCs yet — write your own with New NPC…, or ask a Content Admin to add shared ones.</p>}
          {missingNpcIds.map((id) => (
            <div key={id} className={styles.unavailable}>
              <span className={styles.unavailableText}>Unavailable NPC — its author may have deleted it or made it private.</span>
              <button type="button" className={`tap-inline ${styles.actionButton}`} disabled={readOnly} onClick={() => toggleRef('NpcIds', id)}>
                Remove
              </button>
            </div>
          ))}
          <div role="group" aria-labelledby={`adv-npcs-heading-${adventure.Id}`} className={styles.refList}>
            {library.npcs.map((npc) => {
              const mayEdit = canEditGmContent(npc, viewer.userId, viewer.isAdmin);
              return (
                <div key={npc.Id} className={styles.npcRow}>
                  <div className={styles.npcRowMain}>
                    <CheckboxRow checked={adventure.NpcIds.includes(npc.Id)} disabled={readOnly} onToggle={() => toggleRef('NpcIds', npc.Id)}>
                      {gmContentLabel(npc, viewer.userId)}
                    </CheckboxRow>
                  </div>
                  {mayEdit && (
                    <button
                      type="button"
                      className={`tap-inline ${styles.actionButton} ${styles.rowEdit}`}
                      disabled={readOnly}
                      aria-label={`Edit ${npc.Name || 'NPC'}`}
                      onClick={() => setAuthoring({ kind: 'npc', entry: npc })}
                    >
                      Edit
                    </button>
                  )}
                  {npc.Custom && !mayEdit && <span className={styles.readOnlyTag}>read-only</span>}
                </div>
              );
            })}
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
        <SecretRow key={s.Id} secret={s} readOnly={readOnly} matcher={matcher} onSave={saveSecret} onRemove={() => removeSecret(s.Id)} />
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
          <ProseField
            id={`adv-step-${adventure.Id}-${step.Name}`}
            label={step.Name}
            className={styles.textarea}
            value={step.Text}
            disabled={readOnly}
            matcher={matcher}
            placeholder="What happens at this stage if the Heroes don't interfere…"
            onCommit={(next) => saveStepText(i, next)}
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

      {authoring && (
        <Suspense fallback={null}>
          <GmContentFormModal
            kind={authoring.kind}
            entry={authoring.entry}
            onSaved={handleAuthored}
            onDeleted={handleAuthoredDeleted}
            onClose={() => setAuthoring(null)}
          />
        </Suspense>
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

export function AdventuresPanel({ campaignId, boot, library: sharedLibrary }: { campaignId: string; boot: CampaignBootstrap; library: Library }) {
  const archived = boot.campaign.Status === 'Archived';
  // Adventure Prep is a GM surface, but the fetch is gated on the role anyway so a Player who
  // somehow rendered this never asks for content the server would refuse them (403).
  const library = useLibraryWithGmContent(sharedLibrary, boot.membership.Role === 'GM');
  const { data: me } = useMe();
  const viewer: Viewer = { userId: boot.membership.UserId, isAdmin: me?.user.IsAdmin ?? false };
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
        <AdventureCard key={a.Id} adventure={a} library={library} viewer={viewer} archived={archived} onSave={adventureActions.save} onRemove={() => adventureActions.remove(a.Id)} />
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
              <AdventureCard key={a.Id} adventure={a} library={library} viewer={viewer} archived={archived} onSave={adventureActions.save} onRemove={() => adventureActions.remove(a.Id)} />
            ))}
        </>
      )}
    </div>
  );
}

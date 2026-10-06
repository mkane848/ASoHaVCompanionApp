import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { GmContentKind, GmContentScope } from '@asohav/shared';
import { getCollection, gmContentCollectionKey } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { useGmContentActions } from '../../lib/useGmContent.js';
import { FieldEditor } from '../admin/FieldEditor.js';
import modal from '../../styles/modal.module.css';
import styles from './GmContentFormModal.module.css';
import {
  SCOPE_OPTIONS,
  UNPUBLISH_WARNING,
  blankDraft,
  changedData,
  createData,
  draftFromEntry,
  isFormDirty,
  kindNoun,
  missingRequired,
  type Draft,
  type GmEntry,
} from './gmContentUi.js';

const NO_OPTIONS: { value: string; label: string }[] = [];

/** Create or edit one GM-authored Villain or NPC. The fields are not hand-written: they are
 *  `schema.ts`'s own `villains`/`npcs` field list rendered by Content Admin's `FieldEditor`, the
 *  same declaration the server validates against, so the two authoring surfaces cannot disagree
 *  about what a Villain is. Reachable only for an entry the viewer may edit — the caller offers no
 *  Edit button on someone else's site-wide entry, and the server refuses it regardless. */
export function GmContentFormModal({
  kind,
  entry,
  onSaved,
  onDeleted,
  onClose,
}: {
  kind: GmContentKind;
  /** Present to edit; absent to create. */
  entry?: GmEntry;
  onSaved: (entry: GmEntry, created: boolean) => void;
  onDeleted?: (id: string) => void;
  onClose: () => void;
}) {
  const actions = useGmContentActions();
  const noun = kindNoun(kind);
  const fields = getCollection(gmContentCollectionKey(kind))?.fields ?? [];

  const [original] = useState<Draft>(() => (entry ? draftFromEntry(kind, entry) : blankDraft(kind)));
  const [originalScope] = useState<GmContentScope>(() => entry?.Custom?.Scope ?? 'Mine');
  const [draft, setDraft] = useState<Draft>(original);
  const [scope, setScope] = useState<GmContentScope>(originalScope);
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);

  const dirty = isFormDirty({ original, draft, originalScope, scope });
  const missing = missingRequired(kind, draft);

  // Escape, a backdrop tap and Cancel all route through here, so none of them can silently throw
  // away what was typed. A pristine form closes straight away.
  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  };
  const dialogRef = useModalA11y<HTMLDivElement>(requestClose);

  async function save() {
    setShowErrors(true);
    setServerError(null);
    if (missing.length > 0) return;
    setBusy(true);
    try {
      if (!entry) {
        const saved = await actions.create({ kind, scope, data: createData(kind, draft) });
        onSaved(saved, true);
        return;
      }
      const data = changedData(kind, original, draft);
      const scopeChanged = scope !== originalScope;
      if (Object.keys(data).length === 0 && !scopeChanged) {
        onClose();
        return;
      }
      const saved = await actions.update(kind, entry.Id, {
        ...(Object.keys(data).length > 0 ? { data } : {}),
        ...(scopeChanged ? { scope } : {}),
      });
      onSaved(saved, false);
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : `Could not save this ${noun}. Try again.`);
      setBusy(false);
    }
  }

  async function remove() {
    if (!entry) return;
    setConfirmingDelete(false);
    setBusy(true);
    setServerError(null);
    try {
      await actions.remove(kind, entry.Id);
      onDeleted?.(entry.Id);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : `Could not delete this ${noun}. Try again.`);
      setBusy(false);
    }
  }

  // A radio group built from buttons (this app uses no native checkboxes/radios — see
  // CheckboxRow): arrow keys move the selection and focus together, and only the chosen option is
  // in the tab order, which is what a native radio group does.
  function onScopeKey(e: KeyboardEvent<HTMLDivElement>) {
    const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    if (!forward && !back) return;
    e.preventDefault();
    const at = SCOPE_OPTIONS.findIndex((o) => o.value === scope);
    const next = SCOPE_OPTIONS[(at + (forward ? 1 : -1) + SCOPE_OPTIONS.length) % SCOPE_OPTIONS.length]!;
    setScope(next.value);
    scopeRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[SCOPE_OPTIONS.indexOf(next)]?.focus();
  }

  const unpublishing = originalScope === 'SiteWide' && scope === 'Mine';

  return (
    <>
      <div className={modal.backdrop} onClick={requestClose}>
        <div
          ref={dialogRef}
          className={`${modal.dialog} ${styles.dialog}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gm-content-title"
          tabIndex={-1}
        >
          <div className={modal.head}>
            <h2 id="gm-content-title" className={modal.title}>{entry ? `Edit ${noun}` : `New ${noun}`}</h2>
            <p className={modal.subtitle}>
              Add it to Adventures and Combats in any campaign you run.
            </p>
          </div>
          <div className={`${modal.body} ${styles.form}`}>
            {showErrors && missing.length > 0 && (
              <div role="alert" className={styles.formError}>
                Not saved — fill in {missing.length === 1 ? 'the field' : `the ${missing.length} fields`} marked below.
              </div>
            )}
            {serverError && <div role="alert" className={styles.formError}>{serverError}</div>}

            {fields.map((f) => (
              <FieldEditor
                key={f.name}
                field={f}
                value={draft[f.name]}
                options={NO_OPTIONS}
                onChange={(v) => setDraft((d) => ({ ...d, [f.name]: v }))}
                error={showErrors && missing.includes(f.name) ? 'Required.' : undefined}
              />
            ))}

            <div className={styles.scope}>
              <span id="gm-content-scope-label" className={styles.scopeLabel}>Who can use it</span>
              <div
                ref={scopeRef}
                role="radiogroup"
                aria-labelledby="gm-content-scope-label"
                className={styles.scopeOptions}
                onKeyDown={onScopeKey}
              >
                {SCOPE_OPTIONS.map((o) => {
                  const on = scope === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      className={`${styles.scopeOption} ${on ? styles.scopeOptionOn : ''}`}
                      onClick={() => setScope(o.value)}
                    >
                      <span className={styles.scopeTitle}>{o.title}</span>
                      <span className={styles.scopeDescription}>{o.description}</span>
                    </button>
                  );
                })}
              </div>
              {unpublishing && <p className={styles.scopeWarning}>{UNPUBLISH_WARNING}</p>}
            </div>

            <div className={`action-grid ${styles.actions}`}>
              <button type="button" className={`tap-inline ${styles.save}`} disabled={busy} onClick={save}>
                {busy ? 'Saving…' : entry ? 'Save changes' : `Create ${noun}`}
              </button>
              <button type="button" className={`tap-inline ${styles.secondary}`} disabled={busy} onClick={requestClose}>
                Cancel
              </button>
              {entry && (
                <button type="button" className={`tap-inline ${styles.delete}`} disabled={busy} onClick={() => setConfirmingDelete(true)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmingDelete && entry && (
        <ConfirmModal
          title={`Delete "${entry.Name || `this ${noun}`}"?`}
          body={
            entry.Custom?.Scope === 'SiteWide'
              ? `This removes the ${noun} for every GM. Adventures that use it will show it as unavailable, and it can't be undone.`
              : `This removes the ${noun} from every campaign you run. Adventures that use it will show it as unavailable, and it can't be undone.`
          }
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
      {confirmingDiscard && (
        <ConfirmModal
          title="Discard your changes?"
          body={entry ? `What you changed in this ${noun} won't be saved.` : `This new ${noun} hasn't been saved yet.`}
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={onClose}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </>
  );
}

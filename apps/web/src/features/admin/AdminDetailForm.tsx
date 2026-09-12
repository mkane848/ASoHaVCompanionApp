import { useState } from 'react';
import type { CollectionDef, Library, ReferencedByRow } from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { FieldEditor } from './FieldEditor.js';
import styles from './AdminDetailForm.module.css';

/** Which `required` fields are still empty. Read off the same `schema.ts` flag the server enforces
 *  in `validateCollectionBody` — the same declaration consulted on both sides, not a second copy of
 *  a rule — and matched to its emptiness test exactly (null/undefined, or a blank string). Type
 *  checking stays server-side; this exists so a rejected save points at the field instead of
 *  putting one terse line at the bottom of a long form. */
function missingRequired(col: CollectionDef, draft: Record<string, unknown>): string[] {
  return col.fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = draft[f.name];
      return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
    })
    .map((f) => f.name);
}

export function AdminDetailForm({
  col,
  draft,
  library,
  referencedBy,
  jsonTexts,
  onChangeField,
  onChangeJsonText,
  onSave,
  onDuplicate,
  onDelete,
}: {
  col: CollectionDef;
  draft: Record<string, any> | null;
  library: Library;
  referencedBy: ReferencedByRow[];
  jsonTexts: Record<string, string>;
  onChangeField: (name: string, value: unknown) => void;
  onChangeJsonText: (name: string, text: string) => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  if (!draft) {
    return <p className={styles.placeholder}>Choose something on the left, or create a new one.</p>;
  }

  /* An unsaved draft has nothing to destroy — discarding it is the same as navigating away — so
     the confirm is reserved for a record that actually exists on the server. */
  const isPersisted = Boolean(draft.Id);
  const breaksRefs = referencedBy.length;
  const missing = missingRequired(col, draft);

  return (
    <div>
      <div className={styles.head}>
        <h2 className={styles.title}>{draft.Name || `New ${col.singular}`}</h2>
        <button
          className={styles.save}
          onClick={() => {
            setShowErrors(missing.length > 0);
            if (!missing.length) onSave();
          }}
        >
          Save
        </button>
        {/* Duplicate is the biggest authoring win the schema gives away for free, and it only
            makes sense for something already saved — there is nothing to copy from a half-typed
            new record. It copies the record as saved and lands you on an unsaved one, so the
            caller routes it through the same unsaved-changes guard as any other navigation. */}
        {isPersisted && (
          <button className={styles.duplicate} onClick={onDuplicate}>
            Duplicate
          </button>
        )}
        <button className={styles.delete} onClick={() => (isPersisted ? setConfirmingDelete(true) : onDelete())}>
          Delete
        </button>
      </div>
      <div className={styles.id}>{draft.Id ?? 'unsaved'}</div>
      {showErrors && missing.length > 0 && (
        <div role="alert" className={styles.formError}>
          Not saved — fill in {missing.length === 1 ? 'the field' : `the ${missing.length} fields`} marked below.
        </div>
      )}

      {col.fields.map((f) => {
        let options: { value: string; label: string }[] = [];
        if ((f.type === 'ref' || f.type === 'multiref') && f.collection) {
          options = (((library as any)[f.collection] as any[]) ?? []).map((o) => ({ value: o.Id, label: o.Name || o.Id }));
        }
        return (
          <FieldEditor
            key={f.name}
            field={f}
            value={draft[f.name]}
            jsonText={jsonTexts[f.name]}
            options={options}
            onChange={(v) => onChangeField(f.name, v)}
            onChangeJsonText={(t) => onChangeJsonText(f.name, t)}
            error={showErrors && missing.includes(f.name) ? 'Required.' : undefined}
          />
        );
      })}

      {breaksRefs > 0 && (
        <div className={styles.refs}>
          <div className={styles.refsLabel}>Referenced by &mdash; deleting this will break these</div>
          {referencedBy.map((r, i) => (
            <div key={i} className={styles.refRow}>
              {r.label} &middot; <strong>{r.name}</strong> <span className={styles.refField}>({r.field})</span>
            </div>
          ))}
        </div>
      )}

      {/* Delete used to fire on a single click, in a codebase whose own convention gives
          ConfirmModal to anything that "destroys a single record" — the Play Data views two nav
          entries away already did. The reference count is folded into the body rather than
          blocking outright, because breaking a reference is sometimes exactly what you mean to do
          and the Validation panel surfaces the dangling ones afterward. Confirming here is also
          the informed consent the server asks for: `DELETE` refuses (409) unless the client sends
          `?force=true`, which `AdminPanelPage` only does once this dialog has named the count. */}
      {confirmingDelete && (
        <ConfirmModal
          title={`Delete "${draft.Name || draft.Id}"?`}
          body={
            breaksRefs > 0
              ? `This permanently removes the ${col.singular.toLowerCase()} and leaves ${breaksRefs} reference${breaksRefs === 1 ? '' : 's'} to it dangling — they are listed below the form, and will show up in Validation afterward. There is no undo, but the changelog keeps a copy you can restore from.`
              : `This permanently removes the ${col.singular.toLowerCase()}. Nothing else references it. There is no undo, but the changelog keeps a copy you can restore from.`
          }
          confirmLabel={breaksRefs > 0 ? `Delete and break ${breaksRefs}` : 'Delete'}
          onConfirm={() => { setConfirmingDelete(false); onDelete(); }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

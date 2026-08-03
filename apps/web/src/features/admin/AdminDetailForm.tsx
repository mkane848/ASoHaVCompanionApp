import type { CollectionDef, Library, ReferencedByRow } from '@asohav/shared';
import { FieldEditor } from './FieldEditor.js';
import styles from './AdminDetailForm.module.css';

export function AdminDetailForm({
  col,
  draft,
  library,
  referencedBy,
  jsonTexts,
  onChangeField,
  onChangeJsonText,
  onSave,
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
  onDelete: () => void;
}) {
  if (!draft) {
    return <p className={styles.placeholder}>Choose something on the left, or create a new one.</p>;
  }

  return (
    <div>
      <div className={styles.head}>
        <h2 className={styles.title}>{draft.Name || `New ${col.singular}`}</h2>
        <button className={styles.save} onClick={onSave}>
          Save
        </button>
        <button className={styles.delete} onClick={onDelete}>
          Delete
        </button>
      </div>
      <div className={styles.id}>{draft.Id ?? 'unsaved'}</div>

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
          />
        );
      })}

      {referencedBy.length > 0 && (
        <div className={styles.refs}>
          <div className={styles.refsLabel}>Referenced by &mdash; deleting this will break these</div>
          {referencedBy.map((r, i) => (
            <div key={i} className={styles.refRow}>
              {r.label} &middot; <strong>{r.name}</strong> <span className={styles.refField}>({r.field})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

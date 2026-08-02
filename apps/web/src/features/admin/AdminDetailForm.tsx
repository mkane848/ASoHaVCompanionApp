import type { CollectionDef, Library, ReferencedByRow } from '@asohav/shared';
import { FieldEditor } from './FieldEditor.js';

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
    return <p style={{ fontSize: 13, color: 'var(--ink-45)', fontStyle: 'italic' }}>Choose something on the left, or create a new one.</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, margin: 0, flex: 1 }}>{draft.Name || `New ${col.singular}`}</h2>
        <button onClick={onSave} style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: '8px 14px' }}>
          Save
        </button>
        <button onClick={onDelete} style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--danger-line)', color: 'var(--danger)', padding: '8px 14px' }}>
          Delete
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-45)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>{draft.Id ?? 'unsaved'}</div>

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
        <div style={{ marginTop: 22, padding: '14px 16px', background: 'var(--panel)', border: '1px solid var(--rule)' }}>
          <div style={{ fontSize: 10.5, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--ink-45)', marginBottom: 7 }}>Referenced by &mdash; deleting this will break these</div>
          {referencedBy.map((r, i) => (
            <div key={i} style={{ fontSize: 12.5, padding: '3px 0' }}>
              {r.label} &middot; <strong>{r.name}</strong> <span style={{ color: 'var(--ink-45)' }}>({r.field})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

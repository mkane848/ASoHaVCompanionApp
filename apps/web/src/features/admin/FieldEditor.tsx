import type { FieldDef } from '@asohav/shared';
import shared from './adminShared.module.css';
import styles from './FieldEditor.module.css';


export function FieldEditor({
  field,
  value,
  jsonText,
  options,
  onChange,
  onChangeJsonText,
}: {
  field: FieldDef;
  value: unknown;
  jsonText?: string;
  options: { value: string; label: string }[]; // for ref/enum
  onChange: (value: unknown) => void;
  onChangeJsonText?: (text: string) => void;
}) {
  const label = field.label || field.name;
  const fieldId = `field-${field.name}`;
  const labelId = `${fieldId}-label`;

  return (
    <div className={styles.field}>
      <label id={labelId} htmlFor={fieldId} className={shared.fieldLabel}>{label}</label>

      {field.type === 'text' && <input id={fieldId} className={styles.input} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />}

      {field.type === 'textarea' && <textarea id={fieldId} className={styles.textarea} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} rows={3} />}

      {field.type === 'int' && (
        <input
          id={fieldId}
          className={styles.number}
          type="number"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
        />
      )}

      {field.type === 'bool' && (
        <button id={fieldId} aria-labelledby={labelId} className={styles.bool} onClick={() => onChange(!value)}>
          {value ? 'Yes' : 'No'}
        </button>
      )}

      {field.type === 'enum' && (
        <select id={fieldId} className={styles.enumSelect} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}

      {field.type === 'ref' && (
        <select id={fieldId} className={styles.input} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">— none —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {field.type === 'multiref' && (
        <div id={fieldId} role="group" aria-labelledby={labelId} className={styles.chips}>
          {options.map((o) => {
            const cur = Array.isArray(value) ? (value as string[]) : [];
            const on = cur.includes(o.value);
            return (
              <button
                key={o.value}
                aria-pressed={on}
                className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                onClick={() => onChange(on ? cur.filter((x) => x !== o.value) : [...cur, o.value])}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      {field.type === 'taglist' && (
        <input
          id={fieldId}
          value={Array.isArray(value) ? (value as string[]).join(', ') : (value as string) ?? ''}
          onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          placeholder="comma separated"
          className={styles.input}
        />
      )}

      {field.type === 'json' && (
        <textarea
          id={fieldId}
          value={jsonText ?? (value == null ? '' : JSON.stringify(value, null, 2))}
          onChange={(e) => onChangeJsonText?.(e.target.value)}
          rows={8}
          className={styles.json}
        />
      )}

      {field.hint && <div className={shared.hint}>{field.hint}</div>}
    </div>
  );
}

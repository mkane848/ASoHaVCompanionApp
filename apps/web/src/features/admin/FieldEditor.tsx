import type { FieldDef } from '@asohav/shared';

const inputStyle = { width: '100%', background: 'var(--panel)', border: '1px solid var(--rule-field)', fontSize: 13.5, padding: '7px 9px', outline: 'none' };
const labelStyle = { display: 'block', fontSize: 10.5, letterSpacing: '.11em', textTransform: 'uppercase' as const, color: 'var(--ink-45)', marginBottom: 4 };
const hintStyle = { fontSize: 11.5, color: 'var(--ink-45)', marginTop: 3, fontStyle: 'italic' as const };

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

  return (
    <div style={{ marginBottom: 15 }}>
      <label style={labelStyle}>{label}</label>

      {field.type === 'text' && <input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} style={inputStyle} />}

      {field.type === 'textarea' && <textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...inputStyle, lineHeight: 1.55, resize: 'vertical' }} />}

      {field.type === 'int' && (
        <input
          type="number"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
          style={{ ...inputStyle, width: 120 }}
        />
      )}

      {field.type === 'bool' && (
        <button onClick={() => onChange(!value)} style={{ fontSize: 12, background: 'var(--panel)', border: '1px solid var(--rule-field)', padding: '7px 13px' }}>
          {value ? 'Yes' : 'No'}
        </button>
      )}

      {field.type === 'enum' && (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}

      {field.type === 'ref' && (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} style={inputStyle}>
          <option value="">— none —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {field.type === 'multiref' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {options.map((o) => {
            const cur = Array.isArray(value) ? (value as string[]) : [];
            const on = cur.includes(o.value);
            return (
              <button
                key={o.value}
                onClick={() => onChange(on ? cur.filter((x) => x !== o.value) : [...cur, o.value])}
                style={
                  on
                    ? { fontSize: 12, background: 'var(--gold-tint)', border: '1px solid var(--gold)', color: 'var(--ink)', padding: '5px 10px' }
                    : { fontSize: 12, background: 'transparent', border: '1px solid var(--rule-field)', color: 'var(--ink-55)', padding: '5px 10px' }
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      {field.type === 'taglist' && (
        <input
          value={Array.isArray(value) ? (value as string[]).join(', ') : (value as string) ?? ''}
          onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          placeholder="comma separated"
          style={inputStyle}
        />
      )}

      {field.type === 'json' && (
        <textarea
          value={jsonText ?? (value == null ? '' : JSON.stringify(value, null, 2))}
          onChange={(e) => onChangeJsonText?.(e.target.value)}
          rows={8}
          style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }}
        />
      )}

      {field.hint && <div style={hintStyle}>{field.hint}</div>}
    </div>
  );
}

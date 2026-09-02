import type { FieldDef, MoveResult, MoveResults } from '@asohav/shared';
import shared from './adminShared.module.css';
import styles from './FieldEditor.module.css';

const EMPTY_MOVE_RESULT: MoveResult = { Description: '', Options: [], ChooseCount: 0 };
const EMPTY_MOVE_RESULTS: MoveResults = { Tier3: EMPTY_MOVE_RESULT, Tier2: EMPTY_MOVE_RESULT, Tier1: EMPTY_MOVE_RESULT };
const MOVE_RESULT_TIERS: { key: keyof MoveResults; label: string }[] = [
  { key: 'Tier3', label: '10+' },
  { key: 'Tier2', label: '7–9' },
  { key: 'Tier1', label: 'Miss' },
];

/** One Tier's Description/Options/ChooseCount, for the `moveResults` field type below. The
 *  Options textarea deliberately doesn't trim/filter blank lines on every keystroke (only on
 *  blur) — filtering as-you-type would eat the blank line `Enter` just produced before you get a
 *  chance to type the next option into it. */
function MoveResultTierEditor({ fieldId, result, onChange }: { fieldId: string; result: MoveResult; onChange: (r: MoveResult) => void }) {
  const tier = MOVE_RESULT_TIERS.find((t) => fieldId.endsWith(t.key))!;
  const descId = `${fieldId}-desc`;
  const optsId = `${fieldId}-opts`;
  const countId = `${fieldId}-count`;
  return (
    <div className={styles.tierGroup}>
      <div className={styles.tierLabel}>{tier.label}</div>
      <label htmlFor={descId} className={shared.hint}>Description</label>
      <textarea id={descId} className={styles.textarea} rows={2} value={result.Description} onChange={(e) => onChange({ ...result, Description: e.target.value })} />
      <label htmlFor={optsId} className={shared.hint}>Options (one per line)</label>
      <textarea
        id={optsId}
        className={styles.textarea}
        rows={3}
        value={result.Options.join('\n')}
        onChange={(e) => onChange({ ...result, Options: e.target.value.split('\n') })}
        onBlur={(e) => onChange({ ...result, Options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
      />
      <label htmlFor={countId} className={shared.hint}>Choose count</label>
      <input
        id={countId}
        type="number"
        className={styles.number}
        value={result.ChooseCount}
        onChange={(e) => onChange({ ...result, ChooseCount: parseInt(e.target.value, 10) || 0 })}
      />
    </div>
  );
}

function MoveResultsEditor({ fieldId, value, onChange }: { fieldId: string; value: MoveResults | null | undefined; onChange: (v: MoveResults) => void }) {
  const results = value ?? EMPTY_MOVE_RESULTS;
  return (
    <div id={fieldId} className={styles.moveResults}>
      {MOVE_RESULT_TIERS.map((t) => (
        <MoveResultTierEditor
          key={t.key}
          fieldId={`${fieldId}-${t.key}`}
          result={results[t.key] ?? EMPTY_MOVE_RESULT}
          onChange={(r) => onChange({ ...results, [t.key]: r })}
        />
      ))}
    </div>
  );
}

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

      {field.type === 'moveResults' && (
        field.required || value != null ? (
          <>
            <MoveResultsEditor fieldId={fieldId} value={value as MoveResults | null} onChange={onChange} />
            {!field.required && (
              <button type="button" className={`tap-inline ${styles.bool}`} onClick={() => onChange(null)}>
                Remove
              </button>
            )}
          </>
        ) : (
          <button type="button" className={`tap-inline ${styles.bool}`} onClick={() => onChange(EMPTY_MOVE_RESULTS)}>
            Add
          </button>
        )
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

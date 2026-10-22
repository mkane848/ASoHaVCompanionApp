import type { StatusSeverity } from '@asohav/shared';
import { statusAbsorb, statusesAbsorb } from '@asohav/shared';
import { Select } from './form/Select.js';
import { TextInput } from './form/TextInput.js';
import styles from './StatusPicks.module.css';

const SEVERITIES: StatusSeverity[] = ['Minor', 'Major', 'Severe'];

/** One Status a Hero is taking to soak up incoming Strain. `Key` is only a stable React key. */
export interface StatusPick {
  Key: string;
  Severity: StatusSeverity;
  Name: string;
}

let nextKey = 0;
/** A new pick in the first severity that still has room (Minor if none does; the row then shows
 *  itself as blocked). */
export function newStatusPick(free: Record<StatusSeverity, number>, existing: StatusPick[]): StatusPick {
  nextKey += 1;
  const open = SEVERITIES.find((s) => free[s] - existing.filter((p) => p.Severity === s).length > 0);
  return { Key: `pick-${nextKey}`, Severity: open ?? 'Minor', Name: '' };
}

/** Whether another Status can still be added on top of `picks`. */
export function canAddStatusPick(free: Record<StatusSeverity, number>, picks: StatusPick[]): boolean {
  return SEVERITIES.some((s) => free[s] - picks.filter((p) => p.Severity === s).length > 0);
}

/** Whether every pick has a name and the set fits the open slots. */
export function statusPicksReady(free: Record<StatusSeverity, number>, picks: StatusPick[]): boolean {
  return (
    picks.length > 0 &&
    picks.every((p) => p.Name.trim().length > 0) &&
    SEVERITIES.every((s) => picks.filter((p) => p.Severity === s).length <= free[s])
  );
}

/** V0.7 (L531): "You can use more than one Status slot if available." The Hero lists every Status
 *  they take to soak up this hit; each absorbs its fixed 2/4/6 and the amounts add. `free` is how
 *  many slots of each severity are open *before* these picks. Shared by the sheet's Take Strain
 *  modal and Combat's incoming-offer panel. */
export function StatusPicks({
  picks,
  free,
  onChange,
  idPrefix,
}: {
  picks: StatusPick[];
  free: Record<StatusSeverity, number>;
  onChange: (next: StatusPick[]) => void;
  idPrefix: string;
}) {
  const update = (key: string, patch: Partial<StatusPick>) => onChange(picks.map((p) => (p.Key === key ? { ...p, ...patch } : p)));
  /** Room left in `severity` for the row being edited: its own slot stays selectable. */
  const roomFor = (severity: StatusSeverity, rowKey: string) => free[severity] - picks.filter((p) => p.Key !== rowKey && p.Severity === severity).length > 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>Each Status absorbs Minor 2 · Major 4 · Severe 6, and they add up.</div>
      {picks.map((p, i) => (
        <div key={p.Key} className={styles.row} role="group" aria-label={`Status ${i + 1}`}>
          <Select
            className={styles.severity}
            aria-label={`Status ${i + 1} severity`}
            value={p.Severity}
            onChange={(e) => update(p.Key, { Severity: e.target.value as StatusSeverity })}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s} disabled={!roomFor(s, p.Key)}>
                {s} ({statusAbsorb(s)}){!roomFor(s, p.Key) ? ' — no free slot' : ''}
              </option>
            ))}
          </Select>
          <TextInput
            id={`${idPrefix}-name-${i}`}
            className={styles.name}
            aria-label={`Status ${i + 1} name`}
            value={p.Name}
            onChange={(e) => update(p.Key, { Name: e.target.value })}
            placeholder="Broken Arm, Concussed…"
          />
          <button
            type="button"
            className={`tap-inline ${styles.remove}`}
            aria-label={`Remove Status ${i + 1}`}
            onClick={() => onChange(picks.filter((x) => x.Key !== p.Key))}
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`tap-inline ${styles.add}`}
        disabled={!canAddStatusPick(free, picks)}
        onClick={() => onChange([...picks, newStatusPick(free, picks)])}
      >
        + {picks.length === 0 ? 'Take a Status' : 'Add another Status'}
      </button>
      {picks.length > 0 && <div className={styles.total}>Absorbs {statusesAbsorb(picks.map((p) => p.Severity))} in all.</div>}
    </div>
  );
}

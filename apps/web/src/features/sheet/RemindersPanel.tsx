import { useState } from 'react';
import type { CharacterSheet, ReminderKind } from '@asohav/shared';
import { newId } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import styles from './RemindersPanel.module.css';

const VALUE_CHOICES = [3, 2, 1, -1, -2, -3];

function signed(value: number): string {
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/** The Hero's Forward and Ongoing reminders (revised V0.6 slice 9; the 2026-09-03 meeting's "help
 *  players remember forward and ongoing benefits… without automating fictional judgment"). Added
 *  here or from a Move's quick-add in the Moves drawer; ticked into a roll in the roll helper,
 *  where a Forward is used up when the tier is reported. Removing one needs no confirmation — it
 *  is a note the player wrote, not game state anything else depends on. */
export function RemindersPanel({ sheet, commit }: { sheet: CharacterSheet; commit: (m: (d: CharacterSheet) => void) => void }) {
  const [text, setText] = useState('');
  const [value, setValue] = useState(1);
  const [kind, setKind] = useState<ReminderKind>('Forward');
  const [source, setSource] = useState('');

  function add() {
    const trimmed = text.trim();
    if (!trimmed) return;
    commit((d) => {
      d.Reminders = [...d.Reminders, { Id: newId('rem'), Text: trimmed, Value: value, Kind: kind, Source: source.trim() }];
    });
    setText('');
    setValue(1);
    setKind('Forward');
    setSource('');
  }

  function remove(id: string) {
    commit((d) => {
      d.Reminders = d.Reminders.filter((r) => r.Id !== id);
    });
  }

  return (
    <Panel id="p-reminders" collapseId="reminders">
      <PanelHeader>Reminders</PanelHeader>
      <p className={styles.hint}>
        A Forward applies to your next roll and is used up when you report its tier; an Ongoing one stays until you
        remove it. Tick them in the roll helper.
      </p>

      {sheet.Reminders.length === 0 ? (
        <p className={styles.empty}>No reminders.</p>
      ) : (
        <ul className={styles.list}>
          {sheet.Reminders.map((r) => (
            <li key={r.Id} className={styles.row}>
              <span className={styles.value}>{signed(r.Value)}</span>
              <span className={styles.text}>
                {r.Text}
                <span className={styles.meta}>
                  {' '}· {r.Kind}
                  {r.Source && ` · ${r.Source}`}
                </span>
              </span>
              <button type="button" className={`tap-inline ${styles.remove}`} onClick={() => remove(r.Id)} aria-label={`Remove reminder: ${r.Text}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.form}>
        <input
          className={`tap-inline ${styles.input} ${styles.wide}`}
          value={text}
          placeholder="What it's for — e.g. acting on what you learned"
          onChange={(e) => setText(e.target.value)}
          aria-label="Reminder"
        />
        <select className={`tap-inline ${styles.input}`} value={value} onChange={(e) => setValue(Number(e.target.value))} aria-label="Value">
          {VALUE_CHOICES.map((v) => (
            <option key={v} value={v}>{signed(v)}</option>
          ))}
        </select>
        <select className={`tap-inline ${styles.input}`} value={kind} onChange={(e) => setKind(e.target.value as ReminderKind)} aria-label="Forward or Ongoing">
          <option value="Forward">Forward</option>
          <option value="Ongoing">Ongoing</option>
        </select>
        <input
          className={`tap-inline ${styles.input} ${styles.wide}`}
          value={source}
          placeholder="From (optional) — e.g. Consult the Past"
          onChange={(e) => setSource(e.target.value)}
          aria-label="Where it came from"
        />
        <button type="button" className={`tap-inline ${styles.add}`} disabled={!text.trim()} onClick={add}>
          Add reminder
        </button>
      </div>
    </Panel>
  );
}

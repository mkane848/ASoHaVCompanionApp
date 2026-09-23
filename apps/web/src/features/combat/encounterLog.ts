import type { Encounter } from '@asohav/shared';
import { newId, nowIso } from '@asohav/shared';

/** A mutator that appends one line to the Encounter's History, newest first — returned rather than
 *  applied so it composes inside any `commitEncounter` call. */
export function log(text: string) {
  return (d: Encounter) => {
    d.History.unshift({ Id: newId('ch'), At: nowIso(), Text: text });
  };
}

import type { CharacterSheet } from '@asohav/shared';
import { getSheet, saveSheet } from './repo.js';
import { StaleDocumentError } from './staleDocument.js';

/** A server-side change to a sheet that its owner may be saving at the same moment (the GM clearing
 *  Dying, a Dying choice, a Scar removed, a Resurrection link, Strain cleared when Combat ends).
 *
 *  `sheet` must be as it was just read, not yet changed. `apply` makes the change and may throw to
 *  refuse it. The save carries the `UpdatedAt` the sheet was read at; if the owner saved in
 *  between, the sheet is read again, `apply` runs on the fresh copy and the save is tried once
 *  more. A second conflict is thrown as the 409 it is. Before 0.84.0 these routes wrote
 *  unconditionally, so whichever of the two saves landed second erased the other. */
export async function changeSheet<T>(
  sheet: CharacterSheet,
  campaignId: string,
  apply: (sheet: CharacterSheet) => T,
): Promise<{ sheet: CharacterSheet; result: T }> {
  const readAt = sheet.UpdatedAt || undefined;
  const result = apply(sheet);
  try {
    await saveSheet(sheet, campaignId, readAt);
    return { sheet, result };
  } catch (err) {
    if (!(err instanceof StaleDocumentError)) throw err;
    const fresh = await getSheet(sheet.CharacterId);
    if (!fresh) throw err;
    const freshReadAt = fresh.UpdatedAt || undefined;
    const freshResult = apply(fresh);
    await saveSheet(fresh, campaignId, freshReadAt);
    return { sheet: fresh, result: freshResult };
  }
}

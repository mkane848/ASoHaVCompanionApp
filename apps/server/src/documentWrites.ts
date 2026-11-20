import type { Encounter, Party } from '@asohav/shared';
import { getParty, listEncountersForCampaign, saveEncounter, saveParty } from './repo.js';
import { StaleDocumentError } from './staleDocument.js';

/** A server-side change to the Party or an Encounter that a client may be saving at the same moment.
 *  The same contract as `changeSheet` (sheetWrites.ts): `doc` is as it was just read, `apply` makes
 *  the change and may throw to refuse it, the save carries the `UpdatedAt` the document was read at,
 *  and after a conflict the document is read again, `apply` runs on the fresh copy, and the save is
 *  tried once more. A second conflict is thrown as the 409 it is.
 *
 *  `apply` must not set `UpdatedAt` itself: the save stamps it, and the value read is the
 *  precondition. Before 0.86.1 these writers read, changed and saved with no precondition, so two
 *  Drama gains at once kept one, and a replacement Hero's creation saved the Party it had read at the
 *  start of the request over anything changed since (state-machine model check, 2026-11-20). */
async function changeStamped<D extends { UpdatedAt: string }, R>(
  doc: D,
  apply: (doc: D) => R,
  save: (doc: D, expectedUpdatedAt: string | undefined) => Promise<void>,
  reread: () => Promise<D | null>,
): Promise<{ doc: D; result: R }> {
  const readAt = doc.UpdatedAt || undefined;
  const result = apply(doc);
  try {
    await save(doc, readAt);
    return { doc, result };
  } catch (err) {
    if (!(err instanceof StaleDocumentError)) throw err;
    const fresh = await reread();
    if (!fresh) throw err;
    const freshReadAt = fresh.UpdatedAt || undefined;
    const freshResult = apply(fresh);
    await save(fresh, freshReadAt);
    return { doc: fresh, result: freshResult };
  }
}

export async function changeParty<R>(party: Party, apply: (party: Party) => R): Promise<{ party: Party; result: R }> {
  const { doc, result } = await changeStamped(party, apply, saveParty, () => getParty(party.CampaignId));
  return { party: doc, result };
}

export async function changeEncounter<R>(encounter: Encounter, apply: (encounter: Encounter) => R): Promise<{ encounter: Encounter; result: R }> {
  const { doc, result } = await changeStamped(
    encounter,
    apply,
    saveEncounter,
    async () => (await listEncountersForCampaign(encounter.CampaignId)).find((e) => e.Id === encounter.Id) ?? null,
  );
  return { encounter: doc, result };
}

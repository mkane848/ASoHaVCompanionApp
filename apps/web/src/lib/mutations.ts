import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Adventure, AdventureType, Bond, CampaignBootstrap, CharacterSheet, Clock, ClockKind, DyingChoiceInput, Encounter, Party, ResurrectionChoiceRequest, ResurrectionClockRequest, World } from '@asohav/shared';
import { api, isStaleDocumentError } from './api.js';
import { tracked } from './liveSync.js';
import { DocumentSaveQueue, type SaveQueueDeps } from './saveQueue.js';
import { useToastStore } from '../store/toastStore.js';

import { describeError } from './describeError.js';
export { describeError };

/** Runs a server call, toasting its failure instead of leaving an unhandled rejection; resolves
 *  true once it succeeded, so a caller can keep a draft until then. */
export function useGuarded() {
  const showToast = useToastStore((st) => st.show);
  return async (call: () => Promise<unknown>, fallback: string): Promise<boolean> => {
    try {
      await call();
      return true;
    } catch (err) {
      showToast(describeError(err, fallback));
      return false;
    }
  };
}

/** Shared optimistic-update shape for the whole-document fields hung off the bootstrap query
 *  (sheet, Party, Encounter, World). Each field gets its own call to this, all reading and writing
 *  the same `['bootstrap', campaignId]` cache entry, which holds one document per field.
 *
 *  Two things follow from sharing that one cache entry:
 *
 *  1. The edit is written to the cache synchronously in the returned callback, not in a later
 *     microtask, so two commits fired back to back in the same tick, including two *different*
 *     fields (a Party Rapport spend alongside an Encounter log line), each see the other's write
 *     and compose instead of one clobbering the other.
 *  2. Every write, including a rollback, goes through this field's own `get`/`set` pair, never a
 *     whole-`CampaignBootstrap` snapshot, which would also wipe what a sibling field's commit or a
 *     live refetch had layered on in the meantime.
 *
 *  Since 0.84.0 the sending is `DocumentSaveQueue`'s (saveQueue.ts): one save in flight per
 *  document, carrying the `UpdatedAt` the edit started from, with a server-refused save refetched,
 *  reapplied and resent once. Rollback and the toast are its too. The whole run is `tracked`, so
 *  live refetches wait for the queue to empty rather than landing between two of its saves, and
 *  the cache is reconciled with one invalidate when it does. */
function useOptimisticCommit<T extends { UpdatedAt: string }>(
  campaignId: string | undefined,
  opts: {
    get: (boot: CampaignBootstrap) => T | null | undefined;
    set: (boot: CampaignBootstrap, value: T) => CampaignBootstrap;
    save: (campaignId: string, value: T, expectedUpdatedAt: string | undefined) => Promise<T>;
    errorMessage: string;
  },
) {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  // One queue per campaign, kept across renders: it outlives the render that made it, so its
  // callbacks are refreshed from the current render on every commit (setDeps below).
  const queues = useRef(new Map<string, DocumentSaveQueue<T>>());

  function depsFor(cid: string): SaveQueueDeps<T> {
    const key = ['bootstrap', cid];
    return {
      read: () => {
        const boot = qc.getQueryData<CampaignBootstrap>(key);
        return (boot && opts.get(boot)) ?? null;
      },
      write: (doc) => qc.setQueryData<CampaignBootstrap>(key, (old) => (old ? opts.set(old, doc) : old)),
      save: (doc, expected) => opts.save(cid, doc, expected),
      // Straight from the API, not through the query: a commit made meanwhile cancels the
      // bootstrap query, which would cancel this fetch with it.
      fetchFresh: async () => opts.get(await api.campaign.bootstrap(cid)) ?? null,
      notify: showToast,
      errorMessage: opts.errorMessage,
    };
  }

  return (mutator: (draft: T) => void) => {
    if (!campaignId) return;
    const key = ['bootstrap', campaignId];
    // Not awaited: the cancellation signal to any in-flight fetch is set synchronously, so a stale
    // response cannot land after the write below and clobber it.
    qc.cancelQueries({ queryKey: key });
    const deps = depsFor(campaignId);
    let queue = queues.current.get(campaignId);
    if (queue) queue.setDeps(deps);
    else queues.current.set(campaignId, (queue = new DocumentSaveQueue<T>(deps)));
    const wasIdle = !queue.busy;
    const run = queue.commit(mutator);
    if (run && wasIdle) {
      void tracked(run).finally(() => {
        qc.invalidateQueries({ queryKey: key });
      });
    }
  };
}

/** The sheet is edited by its owner, but not only by them: the GM clearing Dying, a Dying choice,
 *  Scar removal, Resurrection and the end of Combat all write it on the server too. Those writes
 *  and this one both carry the stale-save precondition, so neither erases the other. */
export function useCommitSheet(campaignId: string | undefined, characterId: string | undefined) {
  const commit = useOptimisticCommit<CharacterSheet>(campaignId, {
    get: (boot) => boot.mySheet,
    set: (boot, mySheet) => ({ ...boot, mySheet }),
    save: async (cid, sheet, expected) => (await api.sheet.save(cid, characterId as string, sheet, expected)).sheet,
    errorMessage: "Couldn't save your sheet — try again.",
  });
  return (mutator: (draft: CharacterSheet) => void) => {
    if (!characterId) return;
    commit(mutator);
  };
}

/** Rapport has no handshake — any party member may spend it directly. Same optimistic pattern. */
export function useCommitParty(campaignId: string | undefined) {
  return useOptimisticCommit<Party>(campaignId, {
    get: (boot) => boot.party,
    set: (boot, party) => ({ ...boot, party }),
    save: async (cid, party, expected) => (await api.party.save(cid, party, expected)).party,
    errorMessage: "Couldn't save the party — try again.",
  });
}

/** World-building is fully collaborative — any campaign member may write directly, same trust
 *  model and optimistic pattern as Party. */
export function useCommitWorld(campaignId: string | undefined) {
  return useOptimisticCommit<World>(campaignId, {
    get: (boot) => boot.world,
    set: (boot, world) => ({ ...boot, world }),
    save: async (cid, world, expected) => (await api.world.save(cid, world, expected)).world,
    errorMessage: "Couldn't save the world — try again.",
  });
}

function replaceBond(qc: ReturnType<typeof useQueryClient>, campaignId: string, bond: Bond) {
  qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => {
    if (!old) return old;
    return { ...old, bonds: old.bonds.map((b) => (b.Id === bond.Id ? bond : b)) };
  });
}

/** Bond writes go through the handshake — the server resolves the state transition, so these
 *  simply call the API and apply the authoritative result rather than guessing it locally.
 *
 *  A failure raises the toast here, once, for every caller — then rethrows, so a caller that
 *  awaits can keep the player's input rather than resetting as if it worked. Every caller used to
 *  fire and forget, which made a refused proposal a silent unhandled rejection; this path runs
 *  through `withBondLock()`'s direct-pg row lock, which has never been verified against the live
 *  database (HANDOFF.md), so a failure on it is exactly the one that has to be seen. Callers must
 *  not toast again. */
export function useBondActions(campaignId: string | undefined) {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  async function run(call: (cid: string) => Promise<{ bond: Bond }>) {
    if (!campaignId) return;
    try {
      const { bond } = await tracked(call(campaignId));
      replaceBond(qc, campaignId, bond);
    } catch (err) {
      showToast(describeError(err, "Couldn't update the Bond — try again."));
      throw err;
    }
  }

  return {
    propose: (bondId: string, type: string, payload: Record<string, unknown>, note?: string) =>
      run((cid) => api.bond.propose(cid, bondId, type, payload, note)),
    accept: (bondId: string) => run((cid) => api.bond.accept(cid, bondId)),
    reject: (bondId: string, withdrawn: boolean) => run((cid) => api.bond.reject(cid, bondId, withdrawn)),
  };
}

/** Encounter writes are trusted whole-document replaces (see combat.ts's PUT), same shape as
 *  Party — optimistic-local, then reconciled against whatever the server actually persisted. */
export function useCommitEncounter(campaignId: string | undefined) {
  return useOptimisticCommit<Encounter>(campaignId, {
    get: (boot) => boot.encounter,
    set: (boot, encounter) => ({ ...boot, encounter }),
    save: async (cid, encounter, expected) => (await api.combat.save(cid, encounter, expected)).encounter,
    errorMessage: "Couldn't save the Encounter — try again.",
  });
}

function replaceClock(qc: ReturnType<typeof useQueryClient>, campaignId: string, clock: Clock) {
  qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => {
    if (!old) return old;
    const exists = old.clocks.some((c) => c.Id === clock.Id);
    return { ...old, clocks: exists ? old.clocks.map((c) => (c.Id === clock.Id ? clock : c)) : [...old.clocks, clock] };
  });
}

/** Clock writes apply the server's authoritative result rather than guessing it locally, same
 *  shape as `useBondActions` — `clocks` is a list within `CampaignBootstrap`, not a single field,
 *  so this can't reuse `useOptimisticCommit`'s get/set-one-field shape. */
export function useClockActions(campaignId: string | undefined) {
  const qc = useQueryClient();
  const guarded = useGuarded();
  // Saves of one Clock are chained so their PUTs reach the server in tap order, and numbered so
  // only the newest one's response or rollback is applied.
  const queues = useRef(new Map<string, Promise<boolean>>());
  const newest = useRef(new Map<string, number>());
  // The UpdatedAt the server returned for a Clock's last save while more saves of it are queued:
  // the next save in the chain must carry it as its precondition (0.84.0), since the cache still
  // holds the stamp the chain started from. Cleared when the chain empties.
  const confirmedAt = useRef(new Map<string, string>());
  return {
    create: (title: string, kind: ClockKind, segments?: number) =>
      guarded(async () => {
        if (campaignId) replaceClock(qc, campaignId, (await tracked(api.clocks.create(campaignId, title, kind, segments))).clock);
      }, "Couldn't create the Clock — try again."),
    /** Writes the new Clock into the cache at once, so a second tap before the first answers builds
     *  on it rather than on the stale prop (two "+1" taps used to send the same value twice and
     *  lose a tick); the server's copy replaces it when the newest save answers, and a failed
     *  newest save restores what was there before. */
    save: (clock: Clock): Promise<boolean> => {
      if (!campaignId) return Promise.resolve(false);
      const cid = campaignId;
      const key = ['bootstrap', cid];
      qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<CampaignBootstrap>(key)?.clocks.find((c) => c.Id === clock.Id);
      replaceClock(qc, cid, clock);
      const number = (newest.current.get(clock.Id) ?? 0) + 1;
      newest.current.set(clock.Id, number);
      const isNewest = () => newest.current.get(clock.Id) === number;
      const run = (queues.current.get(clock.Id) ?? Promise.resolve(true)).then(async () => {
        const expected = confirmedAt.current.get(clock.Id) ?? previous?.UpdatedAt;
        let stale = false;
        const saved = await guarded(async () => {
          try {
            const { clock: fromServer } = await tracked(api.clocks.save(cid, clock, expected));
            confirmedAt.current.set(clock.Id, fromServer.UpdatedAt);
            if (isNewest()) replaceClock(qc, cid, fromServer);
          } catch (err) {
            // Someone else saved this Clock first. A Clock save carries a whole Clock rather than an
            // edit, so it cannot be reapplied on their copy: show theirs and say so.
            if (isStaleDocumentError(err)) stale = true;
            throw err;
          }
        }, "Couldn't save the Clock — try again.");
        if (stale) {
          const fresh = (await api.campaign.bootstrap(cid).catch(() => null))?.clocks.find((c) => c.Id === clock.Id);
          if (fresh) {
            confirmedAt.current.set(clock.Id, fresh.UpdatedAt);
            if (isNewest()) replaceClock(qc, cid, fresh);
          }
        } else if (!saved && isNewest() && previous) {
          replaceClock(qc, cid, previous);
        }
        if (isNewest()) confirmedAt.current.delete(clock.Id);
        return saved;
      });
      queues.current.set(clock.Id, run);
      return run;
    },
    remove: (clockId: string) =>
      guarded(async () => {
        if (!campaignId) return;
        await tracked(api.clocks.remove(campaignId, clockId));
        qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => (old ? { ...old, clocks: old.clocks.filter((c) => c.Id !== clockId) } : old));
      }, "Couldn't remove the Clock — try again."),
  };
}

function replaceAdventure(qc: ReturnType<typeof useQueryClient>, campaignId: string, adventure: Adventure) {
  qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => {
    if (!old) return old;
    const exists = old.adventures.some((a) => a.Id === adventure.Id);
    return { ...old, adventures: exists ? old.adventures.map((a) => (a.Id === adventure.Id ? adventure : a)) : [...old.adventures, adventure] };
  });
}

/** Adventure writes apply the server's authoritative result rather than guessing it locally, same
 *  shape as `useClockActions` — `adventures` is a list within `CampaignBootstrap`, not a single
 *  field. Unlike Clocks, every action here is GM-only server-side; this hook doesn't duplicate
 *  that check client-side (AdventuresPage/AdventuresPanel simply aren't reachable/rendered for a
 *  non-GM, since campaign.ts's bootstrap route never even sends them Adventure data — see
 *  CLAUDE.md's "Architecture: Adventures"). */
export function useAdventureActions(campaignId: string | undefined) {
  const qc = useQueryClient();
  return {
    create: async (concept: string, type: AdventureType | null, hook: string) => {
      if (!campaignId) return;
      const { adventure } = await api.adventures.create(campaignId, concept, type, hook);
      replaceAdventure(qc, campaignId, adventure);
    },
    save: async (adventure: Adventure) => {
      if (!campaignId) return;
      const { adventure: saved } = await api.adventures.save(campaignId, adventure);
      replaceAdventure(qc, campaignId, saved);
    },
    remove: async (adventureId: string) => {
      if (!campaignId) return;
      await api.adventures.remove(campaignId, adventureId);
      qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => (old ? { ...old, adventures: old.adventures.filter((a) => a.Id !== adventureId) } : old));
    },
  };
}

/** What the Dying-choice UI can ask of the server for one Hero (V0.7 slice 8b). Each resolves true
 *  when the server accepted it; a refusal raises the toast here and resolves false. */
export interface DeathActions {
  choose: (input: DyingChoiceInput) => Promise<boolean>;
  removeScar: (scarId: string) => Promise<boolean>;
  /** GM only (V0.7 slice 8c): link, make-and-link or unlink a Dead Hero's Resurrection Clock. */
  linkClock: (body: ResurrectionClockRequest) => Promise<boolean>;
  /** The player's final say once that Clock is complete. */
  resurrect: (choice: ResurrectionChoiceRequest['Choice']) => Promise<boolean>;
}

/** The Dying choice and Scar removal are real server transitions (`sheet.ts`'s dedicated routes), not
 *  whole-sheet PUTs: the GM may act on any Hero and a Dead Hero's PUT is refused. So, like the Bond
 *  actions, they apply the server's authoritative sheet to the cache rather than guessing it. */
export function useDeathActions(campaignId: string | undefined) {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  async function run(call: (cid: string) => Promise<{ sheet: CharacterSheet }>): Promise<boolean> {
    if (!campaignId) return false;
    try {
      const { sheet } = await tracked(call(campaignId));
      qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => {
        if (!old) return old;
        const peek = old.peekSheets?.[sheet.CharacterId];
        return {
          ...old,
          mySheet: old.mySheet?.CharacterId === sheet.CharacterId ? sheet : old.mySheet,
          peekSheets: peek ? { ...old.peekSheets, [sheet.CharacterId]: sheet } : old.peekSheets,
        };
      });
      void qc.invalidateQueries({ queryKey: ['bootstrap', campaignId] });
      return true;
    } catch (err) {
      showToast(describeError(err, "Couldn't record that — try again."));
      return false;
    }
  }

  return (characterId: string): DeathActions => ({
    choose: (input) => run((cid) => api.sheet.dyingChoice(cid, characterId, input)),
    removeScar: (scarId) => run((cid) => api.sheet.removeScar(cid, characterId, scarId)),
    linkClock: (body) => run((cid) => api.sheet.resurrectionClock(cid, characterId, body)),
    resurrect: (choice) => run((cid) => api.sheet.resurrection(cid, characterId, { Choice: choice })),
  });
}

import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Adventure, AdventureType, Bond, CampaignBootstrap, CharacterSheet, Clock, ClockKind, Encounter, Party, World } from '@asohav/shared';
import { api } from './api.js';
import { useToastStore } from '../store/toastStore.js';

function describeError(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Shared optimistic-update shape for the three whole-document fields hung off the bootstrap
 *  query (sheet/party/encounter). Sheet, Party, and Encounter each get their own call to this —
 *  three independent `useMutation`s that happen to read/write the same `['bootstrap', campaignId]`
 *  cache entry, since that's one JSONB-shaped document with three sub-fields, not three documents.
 *
 *  Two things follow from sharing that one cache entry:
 *
 *  1. The cancel/snapshot/write step runs synchronously in the returned callback rather than
 *     inside React Query's `onMutate` — `onMutate` only starts once `mutate()`'s internal async
 *     pipeline reaches it, which is at least one microtask later. Deferring the write that long
 *     would break a guarantee the old plain-`setQueryData` version had for free: two commits fired
 *     back to back in the same tick — including two *different* fields, e.g. a Party Rapport
 *     spend alongside an Encounter log line — each see the other's already-applied write, so they
 *     compose, instead of both reading the same stale base and one clobbering the other.
 *     `qc.setQueryData`'s functional-updater form still reads the latest cache synchronously, so
 *     that guarantee carries over unchanged.
 *  2. Rollback-on-error resets only *this* field, read and written through the same `get`/`set`
 *     pair via the functional-updater form — not a whole-`CampaignBootstrap` snapshot restore.
 *     A snapshot restore would also wipe out whatever a sibling field's commit (or a Realtime
 *     invalidation) had already layered on top of the same cache entry in the meantime, for a
 *     failure that has nothing to do with that other field.
 *
 *     And it happens only if the failed commit is still the latest one this hook has issued. The
 *     field is one whole document (a Party is one value, not its tags), so restoring the value from
 *     before commit N would also erase commit N+1's edit, which was built on top of N and may still
 *     be in flight. A newer commit carries this one's change inside its own whole-document PUT
 *     anyway, so when one exists the rollback is skipped and that commit's result, plus the
 *     settle-time invalidate, reconciles the cache. The toast is shown either way.
 *
 *     The failure is caught on `mutateAsync`'s own promise rather than a per-call
 *     `mutate(v, { onError })`. TanStack runs per-call callbacks only for the observer's *latest*
 *     mutation, which did keep a superseded commit from rolling back — but by dropping its failure
 *     entirely, toast and all, along with any failure that landed after the page unmounted. The
 *     explicit commit number keeps the first half on purpose and loses the second.
 *
 *  `useMutation` owns the actual network call and settle-time invalidate, which — regardless of
 *  the rollback above — is what actually reconciles the cache with whatever the server accepted. */
function useOptimisticCommit<T>(
  campaignId: string | undefined,
  opts: {
    get: (boot: CampaignBootstrap) => T | null | undefined;
    set: (boot: CampaignBootstrap, value: T) => CampaignBootstrap;
    save: (campaignId: string, value: T) => Promise<unknown>;
    errorMessage: string;
  },
) {
  const qc = useQueryClient();
  const key = ['bootstrap', campaignId];
  const showToast = useToastStore((s) => s.show);
  // Increases by one per commit issued; a failure compares its own number against it. Per hook
  // instance, which is per field per page — the scope a whole-document replace actually races in.
  const latestCommit = useRef(0);

  const mutation = useMutation({
    mutationFn: (value: T) => opts.save(campaignId as string, value),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return (mutator: (draft: T) => void) => {
    if (!campaignId) return;
    // Not awaited: cancelQueries' cancellation signal to any in-flight fetch is set synchronously
    // (so a stale response can't land after our write below and clobber it); the promise it
    // returns just confirms that, and waiting on it is exactly the microtask delay we're avoiding.
    qc.cancelQueries({ queryKey: key });
    const boot = qc.getQueryData<CampaignBootstrap>(key);
    const current = boot && opts.get(boot);
    if (current == null) return;
    const previousValue = current;
    const draft = structuredClone(current);
    mutator(draft);
    qc.setQueryData<CampaignBootstrap>(key, (old) => (old ? opts.set(old, draft) : old));
    const commitNumber = ++latestCommit.current;
    mutation.mutateAsync(draft).catch((err: unknown) => {
      if (commitNumber === latestCommit.current) {
        qc.setQueryData<CampaignBootstrap>(key, (old) => (old ? opts.set(old, previousValue) : old));
      }
      showToast(describeError(err, opts.errorMessage));
    });
  };
}

/** The sheet is single-writer (its own owner), so there's no conflicting source of truth to
 *  reconcile against beyond whatever the server ends up accepting. */
export function useCommitSheet(campaignId: string | undefined, characterId: string | undefined) {
  const commit = useOptimisticCommit<CharacterSheet>(campaignId, {
    get: (boot) => boot.mySheet,
    set: (boot, mySheet) => ({ ...boot, mySheet }),
    save: (cid, sheet) => api.sheet.save(cid, characterId as string, sheet),
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
    save: (cid, party) => api.party.save(cid, party),
    errorMessage: "Couldn't save the party — try again.",
  });
}

/** World-building is fully collaborative — any campaign member may write directly, same trust
 *  model and optimistic pattern as Party. */
export function useCommitWorld(campaignId: string | undefined) {
  return useOptimisticCommit<World>(campaignId, {
    get: (boot) => boot.world,
    set: (boot, world) => ({ ...boot, world }),
    save: (cid, world) => api.world.save(cid, world),
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
      const { bond } = await call(campaignId);
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
    save: (cid, encounter) => api.combat.save(cid, encounter),
    errorMessage: "Couldn't save the Encounter — try again.",
  });
}

function replaceEncounter(qc: ReturnType<typeof useQueryClient>, campaignId: string, encounter: Encounter | null) {
  qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => (old ? { ...old, encounter } : old));
}

/** Start/end are real lifecycle transitions (see combat.ts's dedicated routes), so these apply
 *  the server's authoritative result rather than guessing it locally, same as Bond actions. */
export function useCombatLifecycle(campaignId: string | undefined) {
  const qc = useQueryClient();
  return {
    start: async (options: { combatGoal: string; initiatedByHeroes: boolean; sharedGoal: boolean; illPreparedOrOffBalance: boolean }) => {
      if (!campaignId) return;
      const { encounter } = await api.combat.start(campaignId, options);
      replaceEncounter(qc, campaignId, encounter);
    },
    end: async (encounterId: string) => {
      if (!campaignId) return;
      const { encounter } = await api.combat.end(campaignId, encounterId);
      replaceEncounter(qc, campaignId, encounter);
    },
  };
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
  return {
    create: async (title: string, kind: ClockKind, segments?: number) => {
      if (!campaignId) return;
      const { clock } = await api.clocks.create(campaignId, title, kind, segments);
      replaceClock(qc, campaignId, clock);
    },
    save: async (clock: Clock) => {
      if (!campaignId) return;
      const { clock: saved } = await api.clocks.save(campaignId, clock);
      replaceClock(qc, campaignId, saved);
    },
    remove: async (clockId: string) => {
      if (!campaignId) return;
      await api.clocks.remove(campaignId, clockId);
      qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => (old ? { ...old, clocks: old.clocks.filter((c) => c.Id !== clockId) } : old));
    },
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

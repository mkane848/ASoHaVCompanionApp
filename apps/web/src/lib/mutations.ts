import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Bond, CampaignBootstrap, CharacterSheet, Encounter, Party } from '@asohav/shared';
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
    mutation.mutate(draft, {
      onError: (err) => {
        qc.setQueryData<CampaignBootstrap>(key, (old) => (old ? opts.set(old, previousValue) : old));
        showToast(describeError(err, opts.errorMessage));
      },
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

function replaceBond(qc: ReturnType<typeof useQueryClient>, campaignId: string, bond: Bond) {
  qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => {
    if (!old) return old;
    return { ...old, bonds: old.bonds.map((b) => (b.Id === bond.Id ? bond : b)) };
  });
}

/** Bond writes go through the handshake — the server resolves the state transition, so these
 *  simply call the API and apply the authoritative result rather than guessing it locally. */
export function useBondActions(campaignId: string | undefined) {
  const qc = useQueryClient();
  return {
    propose: async (bondId: string, type: string, payload: Record<string, unknown>, note?: string) => {
      if (!campaignId) return;
      const { bond } = await api.bond.propose(campaignId, bondId, type, payload, note);
      replaceBond(qc, campaignId, bond);
    },
    accept: async (bondId: string) => {
      if (!campaignId) return;
      const { bond } = await api.bond.accept(campaignId, bondId);
      replaceBond(qc, campaignId, bond);
    },
    reject: async (bondId: string, withdrawn: boolean) => {
      if (!campaignId) return;
      const { bond } = await api.bond.reject(campaignId, bondId, withdrawn);
      replaceBond(qc, campaignId, bond);
    },
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
    start: async (combatGoal: string) => {
      if (!campaignId) return;
      const { encounter } = await api.combat.start(campaignId, combatGoal);
      replaceEncounter(qc, campaignId, encounter);
    },
    end: async (encounterId: string) => {
      if (!campaignId) return;
      const { encounter } = await api.combat.end(campaignId, encounterId);
      replaceEncounter(qc, campaignId, encounter);
    },
  };
}

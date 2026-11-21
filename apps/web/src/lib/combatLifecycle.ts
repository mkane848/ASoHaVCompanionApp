import { useQueryClient } from '@tanstack/react-query';
import type { CampaignBootstrap, Encounter, ResolveStrainOfferRequest, ResolveStrainOfferResult } from '@asohav/shared';
import { api } from './api.js';
import { tracked } from './liveSync.js';
import { describeError, useGuarded } from './mutations.js';
import { useToastStore } from '../store/toastStore.js';

// Its own module, reached only from the lazy CombatPanel, so it stays out of the entry chunk
// (first-load JS sits at bundle-budget.mjs's cap).
function replaceEncounter(qc: ReturnType<typeof useQueryClient>, campaignId: string, encounter: Encounter | null) {
  qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => (old ? { ...old, encounter } : old));
}

/** Start/end are real lifecycle transitions (see combat.ts's dedicated routes), so these apply
 *  the server's authoritative result rather than guessing it locally, same as Bond actions. */
export function useCombatLifecycle(campaignId: string | undefined) {
  const qc = useQueryClient();
  const guarded = useGuarded();
  // Resolves true once the server accepted the change, so a caller can keep the GM's draft until then.
  return {
    start: (options: { combatGoal: string; initiatedByHeroes: boolean; sharedGoal: boolean; illPreparedOrOffBalance: boolean }) =>
      guarded(async () => {
        if (campaignId) replaceEncounter(qc, campaignId, (await api.combat.start(campaignId, options)).encounter);
      }, "Couldn't start Combat — try again."),
    end: (encounterId: string) =>
      guarded(async () => {
        if (campaignId) replaceEncounter(qc, campaignId, (await api.combat.end(campaignId, encounterId)).encounter);
      }, "Couldn't end Combat — try again."),
  };
}

/** Resolving an incoming Strain offer (0.86.2): one server request that removes the offer and writes
 *  the Hero's sheet, exactly once, instead of two separate optimistic saves that could apply the same
 *  offer twice (HANDOFF.md open issue 27). Not optimistic: the result is the server's, applied to the
 *  cache when it arrives. Resolves to the outcome, or null after a refusal (already toasted). */
export function useResolveOffer(campaignId: string | undefined) {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return async (encounterId: string, offerId: string, body: ResolveStrainOfferRequest): Promise<ResolveStrainOfferResult | null> => {
    if (!campaignId) return null;
    try {
      const out = await tracked(api.combat.resolveOffer(campaignId, encounterId, offerId, body));
      qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) =>
        old
          ? {
              ...old,
              encounter: out.encounter,
              mySheet: old.mySheet?.CharacterId === out.sheet.CharacterId ? out.sheet : old.mySheet,
              party: out.party ?? old.party,
            }
          : old,
      );
      return out.outcome;
    } catch (err) {
      showToast(describeError(err, "Couldn't resolve the Strain — try again."));
      // Whatever happened, show what the server now holds (the offer may already be gone).
      void qc.invalidateQueries({ queryKey: ['bootstrap', campaignId] });
      return null;
    }
  };
}

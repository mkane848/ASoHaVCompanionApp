import { useQueryClient } from '@tanstack/react-query';
import type { CampaignBootstrap, Encounter } from '@asohav/shared';
import { api } from './api.js';
import { useGuarded } from './mutations.js';

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


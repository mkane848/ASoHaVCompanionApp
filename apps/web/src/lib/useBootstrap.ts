import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import { useLiveCampaign } from './useLiveCampaign.js';
import { useToastStore } from '../store/toastStore.js';

export function useBootstrap(campaignId: string | undefined) {
  useLiveCampaign(campaignId ?? null);
  const query = useQuery({
    queryKey: ['bootstrap', campaignId],
    queryFn: () => api.campaign.bootstrap(campaignId!),
    enabled: !!campaignId,
  });
  useAnnounceCombatStart(query.data?.encounter?.Id ?? null);
  return query;
}

/** Combat has no broadcast layer of its own — useLiveCampaign's Realtime subscription already
 *  invalidates this query the moment a combat_encounters row is inserted, so every viewer's copy
 *  of `boot.encounter` updates on its own; this just watches for the resulting transition and
 *  raises a Toast. Tracked against the *last seen* Encounter id, not just "an Encounter exists",
 *  so opening a page mid-fight (the id is already non-null the first time this runs) doesn't
 *  claim Combat just started — only an id actually flipping from null to something while already
 *  mounted does. Lives here rather than inside CombatPanel because CombatPanel doesn't mount at
 *  all for a player with no active Encounter (see CampaignPage's "cheap inline stub" for that
 *  case), so it would never observe the null starting point; every page that shows campaign state
 *  calls useBootstrap regardless. */
function useAnnounceCombatStart(encounterId: string | null) {
  const seen = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (seen.current === undefined) {
      seen.current = encounterId;
      return;
    }
    if (seen.current === null && encounterId !== null) {
      useToastStore.getState().show('Combat has started — the party gains +1 Rapport.', 'status');
    }
    seen.current = encounterId;
  }, [encounterId]);
}

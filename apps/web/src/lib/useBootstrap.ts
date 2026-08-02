import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import { useLiveCampaign } from './useLiveCampaign.js';

export function useBootstrap(campaignId: string | undefined) {
  useLiveCampaign(campaignId ?? null);
  return useQuery({
    queryKey: ['bootstrap', campaignId],
    queryFn: () => api.campaign.bootstrap(campaignId!),
    enabled: !!campaignId,
  });
}

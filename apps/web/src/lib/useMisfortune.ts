import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { CampaignBootstrap, MisfortuneAction, Party } from '@asohav/shared';
import { api } from './api.js';
import { useToastStore } from '../store/toastStore.js';

/** The four Misfortune changes (revised V0.6, slice 2), each through the dedicated route rather than
 *  the party's whole-document PUT, which keeps the stored value — Misfortune is a GM resource on a
 *  member-writable document. Applies the server's result to the cache like `useBondActions`.
 *
 *  `gain` is for any member (a reported 6-); `spend`, `reset` and `beginSession` are GM-only and the
 *  server refuses them otherwise. The campaign id defaults to the route's `:campaignId`, so a
 *  component deep in the sheet (the tier report, Take Strain) can call this without plumbing. */
export function useMisfortune(campaignId?: string) {
  const params = useParams<{ campaignId: string }>();
  const cid = campaignId ?? params.campaignId;
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  async function change(action: MisfortuneAction, note?: string) {
    if (!cid) return;
    try {
      const { party } = await api.party.misfortune(cid, { Action: action, Note: note });
      qc.setQueryData<CampaignBootstrap>(['bootstrap', cid], (old) => (old ? { ...old, party: party as Party } : old));
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : "Couldn't update Misfortune — try again.");
    }
  }

  return {
    gain: (note: string) => change('Gain', note),
    spend: (note: string) => change('Spend', note),
    reset: () => change('Reset'),
    beginSession: () => change('BeginSession'),
  };
}

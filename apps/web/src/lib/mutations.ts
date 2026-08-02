import { useQueryClient } from '@tanstack/react-query';
import type { Bond, CampaignBootstrap, CharacterSheet, Party } from '@asohav/shared';
import { api } from './api.js';

/** Optimistically mutates the caller's own sheet in the bootstrap cache, then fires the
 *  PUT in the background. The sheet is single-writer (its own owner), so there's no
 *  conflicting source of truth to reconcile against. */
export function useCommitSheet(campaignId: string | undefined, characterId: string | undefined) {
  const qc = useQueryClient();
  return (mutator: (draft: CharacterSheet) => void) => {
    if (!campaignId || !characterId) return;
    qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => {
      if (!old || !old.mySheet) return old;
      const draft = structuredClone(old.mySheet);
      mutator(draft);
      api.sheet.save(campaignId, characterId, draft).catch((err) => console.error('sheet save failed', err));
      return { ...old, mySheet: draft };
    });
  };
}

/** Rapport has no handshake — any party member may spend it directly. Same optimistic pattern. */
export function useCommitParty(campaignId: string | undefined) {
  const qc = useQueryClient();
  return (mutator: (draft: Party) => void) => {
    if (!campaignId) return;
    qc.setQueryData<CampaignBootstrap>(['bootstrap', campaignId], (old) => {
      if (!old) return old;
      const draft = structuredClone(old.party);
      mutator(draft);
      api.party.save(campaignId, draft).catch((err) => console.error('party save failed', err));
      return { ...old, party: draft };
    });
  };
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

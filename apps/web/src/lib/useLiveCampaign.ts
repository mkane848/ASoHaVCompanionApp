import { useEffect } from 'react';
import { supabase } from './supabaseClient.js';
import { queryClient } from './queryClient.js';

/** Subscribes to the campaign's Supabase Realtime channel and invalidates the relevant
 *  queries when Party, a Bond, a sheet, a Combat Encounter, or the content library changes
 *  elsewhere.
 *
 *  No access-control logic lives here: `party`/`bonds`/`character_sheets`/`combat_encounters`
 *  all have RLS SELECT policies (supabase/migrations/0001-0006, 0010), and Realtime evaluates
 *  those same policies per subscribing client before delivering a postgres_changes event — so a
 *  player who isn't a campaign member, or isn't the sheet's owner/GM, simply never receives that
 *  row's events. `library` is readable by any authenticated user, so it's subscribed unfiltered. */
export function useLiveCampaign(campaignId: string | null) {
  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign:${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party', filter: `campaign_id=eq.${campaignId}` },
        () => queryClient.invalidateQueries({ queryKey: ['bootstrap', campaignId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bonds', filter: `campaign_id=eq.${campaignId}` },
        () => queryClient.invalidateQueries({ queryKey: ['bootstrap', campaignId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'character_sheets', filter: `campaign_id=eq.${campaignId}` },
        () => queryClient.invalidateQueries({ queryKey: ['bootstrap', campaignId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'combat_encounters', filter: `campaign_id=eq.${campaignId}` },
        () => queryClient.invalidateQueries({ queryKey: ['bootstrap', campaignId] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library' }, () => {
        queryClient.invalidateQueries({ queryKey: ['library'] });
        queryClient.invalidateQueries({ queryKey: ['changelog'] });
        queryClient.invalidateQueries({ queryKey: ['validation'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);
}

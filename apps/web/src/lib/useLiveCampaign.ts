import { useEffect } from 'react';
import { supabase } from './supabaseClient.js';
import { queryClient } from './queryClient.js';

/** Subscribes to the campaign's Supabase Realtime channel and invalidates the relevant
 *  queries when Party, a Bond, a sheet, a Combat Encounter, a Clock, the World document, the
 *  campaign row itself, a Membership, a Character, or the content library changes elsewhere.
 *
 *  No access-control logic lives here: `party`/`bonds`/`character_sheets`/`combat_encounters`/
 *  `clocks`/`world`/`campaigns`/`memberships`/`characters` all have RLS SELECT policies
 *  (supabase/migrations/0001-0006, 0010-0011, 0013, 0015), and Realtime evaluates those same policies
 *  per subscribing client before delivering a postgres_changes event — so a player who isn't a
 *  campaign member, or isn't the sheet's owner/GM, simply never receives that row's events.
 *  `library` is readable by any authenticated user, so it's subscribed unfiltered.
 *
 *  `campaigns`/`memberships`/`characters` (0.38.0 item 3) are what make phase changes, readiness
 *  toggles, roster changes and character creation appear live — see WorkPlan-0.38.0.md item 2 for
 *  why this needed a migration (publication membership, not RLS) and its own doc comment for the
 *  `campaigns` filter using `id` rather than `campaign_id`.
 *
 *  **`adventures` (V0.5 slice 9) is deliberately NOT subscribed here**, unlike every other
 *  campaign table above. A `postgres_changes` payload carries the row's full `data` column
 *  regardless of whether this hook's handler reads it — membership-scoped RLS gates *whether* a
 *  client receives an event, not *what* of the row it contains. Every other table this app syncs
 *  is fully track-and-display (everyone's meant to see everything), but an Adventure can carry
 *  unrevealed Secret text a GM is deliberately holding back from the table. Subscribing here would
 *  leak that text to every player's browser the instant the GM saved it, even though
 *  AdventuresPage never renders for a non-GM and campaign.ts's bootstrap route never sends them the
 *  data over plain REST either. Since only the GM ever edits an Adventure, live-push has little
 *  value here anyway — a GM's own AdventuresPage just refetches normally. */
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clocks', filter: `campaign_id=eq.${campaignId}` },
        () => queryClient.invalidateQueries({ queryKey: ['bootstrap', campaignId] }),
      )
      .on(
        // World-building (V0.6 slice 8) is fully track-and-display — the whole table builds it
        // together — so unlike `adventures` below, this one IS subscribed.
        'postgres_changes',
        { event: '*', schema: 'public', table: 'world', filter: `campaign_id=eq.${campaignId}` },
        () => queryClient.invalidateQueries({ queryKey: ['bootstrap', campaignId] }),
      )
      .on(
        // Filtered on `id`, not `campaign_id` — this row IS the campaign (0.38.0 item 3).
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
        () => queryClient.invalidateQueries({ queryKey: ['bootstrap', campaignId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memberships', filter: `campaign_id=eq.${campaignId}` },
        () => queryClient.invalidateQueries({ queryKey: ['bootstrap', campaignId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'characters', filter: `campaign_id=eq.${campaignId}` },
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

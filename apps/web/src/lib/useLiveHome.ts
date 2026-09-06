import { useEffect } from 'react';
import { supabase } from './supabaseClient.js';
import { queryClient } from './queryClient.js';

/** Subscribes to a per-user Realtime channel and invalidates `['me']` when a campaign, a
 *  membership, a character, party, or a Bond changes anywhere — the Home-tile analog of
 *  `useLiveCampaign`, added `0.38.0` item 4 so a GM closing signup, a player marking Ready, or a
 *  new invite being accepted appears on Home with no refresh.
 *
 *  **Unfiltered rather than an `id=in.(<the user's campaign ids>)` filter**, for two reasons: the
 *  joinless RLS policies on `campaigns`/`memberships`/`characters`/`party`/`bonds` already scope
 *  delivery per subscribing client (the same property `useLiveCampaign`'s unfiltered `library`
 *  subscription already relies on), and an id list derived from the current `me` response goes
 *  stale the instant the user joins a new campaign — which is one of the events Home most needs
 *  to react to.
 *
 *  `character_sheets` is deliberately **excluded** despite being published: the only thing Home
 *  reads from it is day-granularity `LastPlayedAt`, and invalidating `['me']` on every sheet
 *  commit would be a lot of refetching for a date that hasn't changed. */
export function useLiveHome(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const invalidateMe = () => queryClient.invalidateQueries({ queryKey: ['me'] });

    const channel = supabase
      .channel(`home:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, invalidateMe)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships' }, invalidateMe)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, invalidateMe)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party' }, invalidateMe)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonds' }, invalidateMe)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

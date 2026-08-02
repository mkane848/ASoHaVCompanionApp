import { useEffect, useRef } from 'react';
import type { WsEvent } from '@asohav/shared';
import { queryClient } from './queryClient.js';
import { supabase } from './supabaseClient.js';

/** Subscribes to the campaign's real-time channel and invalidates the relevant queries
 *  when Party, a Bond, a sheet, or the content library changes elsewhere. */
export function useLiveCampaign(campaignId: string | null) {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // The token fetch is async, so the effect may already have cleaned up (component
      // unmounted, campaignId changed) by the time it resolves — don't open a socket for a
      // subscription nobody wants anymore.
      if (cancelled || !session) return;

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(session.access_token)}`);
      socketRef.current = ws;

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'subscribe', campaignId }));
      });

      ws.addEventListener('message', (ev) => {
        let msg: WsEvent;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === 'party:update' || msg.type === 'bond:update' || msg.type === 'sheet:update') {
          queryClient.invalidateQueries({ queryKey: ['bootstrap', campaignId] });
        } else if (msg.type === 'library:update') {
          queryClient.invalidateQueries({ queryKey: ['library'] });
          queryClient.invalidateQueries({ queryKey: ['changelog'] });
          queryClient.invalidateQueries({ queryKey: ['validation'] });
        }
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [campaignId]);
}

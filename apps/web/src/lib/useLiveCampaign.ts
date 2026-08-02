import { useEffect, useRef } from 'react';
import type { WsEvent } from '@asohav/shared';
import { queryClient } from './queryClient.js';

/** Subscribes to the campaign's real-time channel and invalidates the relevant queries
 *  when Party, a Bond, a sheet, or the content library changes elsewhere. */
export function useLiveCampaign(campaignId: string | null) {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
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

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [campaignId]);
}

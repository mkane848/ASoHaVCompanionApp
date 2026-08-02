import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { WsEvent } from '@asohav/shared';
import { userForToken, tokenFromCookieHeader } from './auth.js';
import { membershipFor } from './repo.js';

interface Conn {
  ws: WebSocket;
  userId: string;
  campaignId: string | null;
  isGM: boolean;
}

const conns = new Set<Conn>();

export function setupWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const token = tokenFromCookieHeader(req.headers.cookie);
    const user = token ? userForToken(token) : null;
    if (!user) {
      ws.close(4001, 'unauthenticated');
      return;
    }
    const conn: Conn = { ws, userId: user.id, campaignId: null, isGM: false };
    conns.add(conn);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && typeof msg.campaignId === 'string') {
          const m = membershipFor(msg.campaignId, user.id);
          if (m) {
            conn.campaignId = msg.campaignId;
            conn.isGM = m.Role === 'GM';
          }
        }
      } catch {
        // ignore malformed client messages
      }
    });

    ws.on('close', () => conns.delete(conn));
    ws.on('error', () => conns.delete(conn));
  });
}

function send(conn: Conn, event: WsEvent) {
  if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(JSON.stringify(event));
}

/** Broadcast to every connection subscribed to a campaign. Used for Party and Bond updates,
 *  which are shared/table-owned and visible to the whole table. */
export function broadcastToCampaign(campaignId: string, event: WsEvent) {
  for (const c of conns) {
    if (c.campaignId === campaignId) send(c, event);
  }
}

/** Sheet updates go only to the sheet's own owner and any GM connections for that campaign —
 *  other players don't get a live feed of someone else's sheet. */
export function broadcastSheetUpdate(campaignId: string, ownerUserId: string, event: WsEvent) {
  for (const c of conns) {
    if (c.campaignId === campaignId && (c.userId === ownerUserId || c.isGM)) send(c, event);
  }
}

export function broadcastLibraryUpdate() {
  for (const c of conns) send(c, { type: 'library:update' });
}

import type { Server as HttpServer } from 'node:http';
import type { RawData } from 'ws';
import { WebSocketServer, WebSocket } from 'ws';
import type { WsEvent } from '@asohav/shared';
import { verifyAccessToken } from './supabase.js';
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
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');

    // Auth now requires an async round-trip to Supabase (no more synchronous cookie/session
    // lookup), so messages can arrive before it resolves — buffer them until `conn` exists.
    let conn: Conn | null = null;
    const pending: RawData[] = [];

    ws.on('message', (raw) => {
      if (conn) handleMessage(conn, raw);
      else pending.push(raw);
    });

    ws.on('close', () => { if (conn) conns.delete(conn); });
    ws.on('error', () => { if (conn) conns.delete(conn); });

    (async () => {
      const authUser = token ? await verifyAccessToken(token) : null;
      if (!authUser) { ws.close(4001, 'unauthenticated'); return; }
      conn = { ws, userId: authUser.id, campaignId: null, isGM: false };
      conns.add(conn);
      for (const raw of pending) await handleMessage(conn, raw);
      pending.length = 0;
    })();
  });
}

async function handleMessage(conn: Conn, raw: RawData) {
  try {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'subscribe' && typeof msg.campaignId === 'string') {
      const m = await membershipFor(msg.campaignId, conn.userId);
      if (m) {
        conn.campaignId = msg.campaignId;
        conn.isGM = m.Role === 'GM';
      }
    }
  } catch {
    // ignore malformed client messages
  }
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

import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { db, chatMessages, lots } from "@/db";
import { eq } from "drizzle-orm";
import { placeBid, closeLot } from "@/lib/auction";
import { chargeOrder } from "@/lib/payments";

const port = Number(process.env.WS_PORT ?? 3001);

const wss = new WebSocketServer({ port });

type ClientMeta = { userId?: string; showId?: string };
const clients = new Map<WebSocket, ClientMeta>();
const rooms = new Map<string, Set<WebSocket>>();

function join(ws: WebSocket, showId: string) {
  let room = rooms.get(showId);
  if (!room) {
    room = new Set();
    rooms.set(showId, room);
  }
  room.add(ws);
  clients.get(ws)!.showId = showId;
}

function leave(ws: WebSocket) {
  const meta = clients.get(ws);
  if (meta?.showId) {
    rooms.get(meta.showId)?.delete(ws);
  }
  clients.delete(ws);
}

function broadcast(showId: string, msg: unknown) {
  const room = rooms.get(showId);
  if (!room) return;
  const data = JSON.stringify(msg);
  for (const ws of room) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

const Inbound = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    userId: z.string().uuid(),
    showId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("chat"),
    body: z.string().min(1).max(500),
  }),
  z.object({
    type: z.literal("bid"),
    lotId: z.string().uuid(),
    amountCents: z.number().int().positive(),
  }),
]);

wss.on("connection", (ws) => {
  clients.set(ws, {});

  ws.on("message", async (raw) => {
    let msg: z.infer<typeof Inbound>;
    try {
      msg = Inbound.parse(JSON.parse(raw.toString()));
    } catch {
      ws.send(JSON.stringify({ type: "error", reason: "bad_message" }));
      return;
    }

    const meta = clients.get(ws)!;

    if (msg.type === "hello") {
      meta.userId = msg.userId;
      join(ws, msg.showId);
      ws.send(JSON.stringify({ type: "joined", showId: msg.showId }));
      return;
    }

    if (!meta.userId || !meta.showId) {
      ws.send(JSON.stringify({ type: "error", reason: "not_joined" }));
      return;
    }

    if (msg.type === "chat") {
      const [row] = await db
        .insert(chatMessages)
        .values({ showId: meta.showId, userId: meta.userId, body: msg.body })
        .returning();
      broadcast(meta.showId, {
        type: "chat",
        id: row.id,
        userId: row.userId,
        body: row.body,
        createdAt: row.createdAt,
      });
      return;
    }

    if (msg.type === "bid") {
      const result = await placeBid({
        lotId: msg.lotId,
        userId: meta.userId,
        amountCents: msg.amountCents,
      });

      if (!result.ok) {
        ws.send(JSON.stringify({ type: "bid_rejected", reason: result.reason }));
        return;
      }

      broadcast(meta.showId, {
        type: "bid_accepted",
        lotId: result.lotId,
        currentBidCents: result.newCurrentBidCents,
        currentBidUserId: result.currentBidUserId,
        endsAt: result.endsAt,
        bidCount: result.bidCount,
      });
      return;
    }
  });

  ws.on("close", () => leave(ws));
});

setInterval(async () => {
  for (const [showId] of rooms) {
    const liveLots = await db
      .select({ id: lots.id, endsAt: lots.endsAt })
      .from(lots)
      .where(eq(lots.showId, showId));

    const now = Date.now();
    for (const lot of liveLots) {
      if (lot.endsAt && lot.endsAt.getTime() <= now) {
        const closed = await closeLot(lot.id);
        if (!closed) continue;
        broadcast(showId, { type: "lot_closed", ...closed });

        if (closed.sold && "orderId" in closed && closed.orderId) {
          chargeOrder(closed.orderId).then((result) => {
            broadcast(showId, {
              type: "order_charged",
              orderId: closed.orderId,
              lotId: closed.lotId,
              ok: result.ok,
              reason: result.ok ? undefined : result.reason,
            });
          });
        }
      }
    }
  }
}, 1000);

console.log(`[ws] listening on :${port}`);

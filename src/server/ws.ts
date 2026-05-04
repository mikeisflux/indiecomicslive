import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { placeBid, closeLot } from "@/lib/auction";
import { chargeOrder } from "@/lib/payments";
import {
  cleanupExpiredData,
  isIPBlocked,
  recordSuspiciousActivity,
} from "@/lib/bot-blocker";

const port = Number(process.env.WS_PORT ?? 3001);

const wss = new WebSocketServer({ port });

function clientIP(req: import("http").IncomingMessage): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string") return cf.trim();
  return req.socket.remoteAddress ?? null;
}

type ClientMeta = { userId?: string; showId?: string; ip?: string };
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

wss.on("connection", async (ws, req) => {
  const ip = clientIP(req);
  if (await isIPBlocked(ip)) {
    ws.send(JSON.stringify({ type: "error", reason: "blocked" }));
    ws.close(1008, "blocked");
    return;
  }

  clients.set(ws, { ip: ip ?? undefined });

  ws.on("message", async (raw) => {
    let msg: z.infer<typeof Inbound>;
    try {
      msg = Inbound.parse(JSON.parse(raw.toString()));
    } catch {
      // Malformed payloads are noisy from real clients (clock skew,
      // browser extensions injecting garbage) — only escalate on a
      // clear pattern. Log but don't auto-ban from a single bad msg.
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
      const row = await prisma.chatMessage.create({
        data: { showId: meta.showId, userId: meta.userId, body: msg.body },
      });
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
        // Bidding rejection alone isn't suspicious, but a flurry of
        // below-min-increment or already-high-bidder rejections from
        // the same IP looks like a scripted bidder. Track it.
        if (
          result.reason === "below_min_increment" ||
          result.reason === "already_high_bidder"
        ) {
          recordSuspiciousActivity(meta.ip ?? null, `bid_${result.reason}`, {
            path: "ws/bid",
          }).catch(() => {});
        }
        ws.send(
          JSON.stringify({ type: "bid_rejected", reason: result.reason }),
        );
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
    const liveLots = await prisma.lot.findMany({
      where: { showId, status: "live" },
      select: { id: true, endsAt: true },
    });

    const now = Date.now();
    for (const lot of liveLots) {
      if (lot.endsAt && lot.endsAt.getTime() <= now) {
        const closed = await closeLot(lot.id);
        if (!closed) continue;
        broadcast(showId, { type: "lot_closed", ...closed });

        if (closed.sold && "orderId" in closed && closed.orderId) {
          const orderId = closed.orderId;
          chargeOrder(orderId).then((result) => {
            broadcast(showId, {
              type: "order_charged",
              orderId,
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

// Hourly cleanup of expired BlockedIP rows + 7-day-old SuspiciousActivity.
setInterval(
  () => {
    cleanupExpiredData().catch((err) =>
      console.error("[ws] bot-blocker cleanup error", err),
    );
  },
  60 * 60 * 1000,
);
// Run once at startup so a cold restart doesn't carry stale rows for an hour.
cleanupExpiredData().catch(() => {});

console.log(`[ws] listening on :${port}`);

import "./load-env";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { placeBid, closeLot } from "@/lib/auction";
import { chargeOrder } from "@/lib/payments";
import { pushToUser } from "@/lib/push";
import {
  cleanupExpiredData,
  isIPBlocked,
  recordSuspiciousActivity,
} from "@/lib/bot-blocker";

const port = Number(process.env.WS_PORT ?? 3001);

// Plain HTTP server alongside WebSocketServer so server-side code in
// the Next.js process (e.g. /api/seller/shows/[id]/pin) can POST a
// message into a show room without holding a WebSocket itself.
//   POST /internal/broadcast
//     X-Broadcast-Token: <WS_INTERNAL_SECRET>
//     { showId, msg } → broadcast(showId, msg)
//   GET  /internal/health → { ok, rooms, clients }
const httpServer = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/internal/broadcast") {
    const expected = process.env.WS_INTERNAL_SECRET;
    const provided = req.headers["x-broadcast-token"];
    if (!expected || provided !== expected) {
      res.statusCode = 401;
      res.end();
      return;
    }
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > 8192) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body) as { showId?: string; msg?: unknown };
        if (
          !parsed.showId ||
          typeof parsed.showId !== "string" ||
          parsed.msg == null
        ) {
          res.statusCode = 400;
          res.end();
          return;
        }
        broadcast(parsed.showId, parsed.msg);
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.statusCode = 400;
        res.end();
      }
    });
    return;
  }
  if (req.method === "GET" && req.url === "/internal/health") {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({ ok: true, rooms: rooms.size, clients: clients.size }),
    );
    return;
  }
  res.statusCode = 404;
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(port);

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

type ClientMeta = {
  userId?: string;
  showId?: string;
  ip?: string;
  reactionTimes?: number[];
};
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

// Allowed sticker types for the floating-reaction layer (heart-spam
// in the player). Add new stickers here + in the client viewer.
const REACTION_KINDS = [
  "heart",
  "fire",
  "wow",
  "laugh",
  "money",
  "comic",
] as const;

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
  z.object({
    type: z.literal("reaction"),
    kind: z.enum(REACTION_KINDS),
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

      // Broadcast every step (manual + each proxy resolution) and
      // push an outbid notification to whoever got displaced at each
      // step. The final state lives on the last event.
      for (const ev of result.events) {
        broadcast(meta.showId, {
          type: "bid_accepted",
          lotId: ev.lotId,
          currentBidCents: ev.amountCents,
          currentBidUserId: ev.bidderId,
          endsAt: ev.endsAt,
          bidCount: ev.bidCount,
          proxy: ev.proxy,
        });
        if (
          ev.previousHighBidderId &&
          ev.previousHighBidderId !== ev.bidderId
        ) {
          const dollars = (ev.amountCents / 100).toFixed(2);
          pushToUser(ev.previousHighBidderId, {
            kind: "outbid",
            title: `You've been outbid — ${ev.lotTitle}`,
            body: `New high bid is $${dollars}. Tap to bid back.`,
            url: ev.showId ? `/s/${ev.showId}` : "/",
          }).catch(() => {});
        }
      }
      return;
    }

    if (msg.type === "reaction") {
      // Cap reactions at ~20/sec per user so one client can't flood
      // the room. Tracked in a tiny in-memory bucket on the meta.
      const now = Date.now();
      meta.reactionTimes = (meta.reactionTimes ?? []).filter(
        (t) => t > now - 1000,
      );
      if (meta.reactionTimes.length >= 20) return; // silently drop
      meta.reactionTimes.push(now);
      broadcast(meta.showId, {
        type: "reaction",
        kind: msg.kind,
        userId: meta.userId,
        at: now,
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

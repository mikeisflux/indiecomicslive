import { NextResponse } from "next/server";
import { isIPBlocked } from "@/lib/bot-blocker";
import { getClientIP } from "@/lib/client-ip";

// Wrap any route handler so requests from blocked IPs short-circuit
// with a 403 before the handler runs. Doubles as a marker — `withBotBlock`
// in a route file is grep-friendly when auditing which endpoints have
// the gate vs not.
//
// The kernel firewall (iptables, populated by botblock-watcher) is the
// real performance protection; this is the application-layer fallback
// for the few seconds before the kernel rule lands.

export type RouteHandler<Ctx = unknown> = (
  req: Request,
  ctx: Ctx,
) => Promise<Response> | Response;

export function withBotBlock<Ctx>(handler: RouteHandler<Ctx>): RouteHandler<Ctx> {
  return async (req, ctx) => {
    const ip = getClientIP(req);
    if (await isIPBlocked(ip)) {
      return NextResponse.json({ error: "blocked" }, { status: 403 });
    }
    return handler(req, ctx);
  };
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildIceServers, loadTurnConfig } from "@/lib/turn";

export const dynamic = "force-dynamic";

// Issue short-lived TURN credentials for the calling user. Browser
// fetches this on player/publisher mount, passes the iceServers array
// to the WebRTC adaptor, and the connection automatically falls back
// to relay when direct WebRTC fails (symmetric NAT, restrictive
// firewalls, etc.).
//
// Authenticated only — TURN bandwidth is expensive and the credential
// is HMAC-validated by coturn so a logged-out scraper can't abuse it.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    // Still return a public STUN fallback so the age-gated home page
    // can preview thumbnails without auth. No TURN relay though.
    return NextResponse.json({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
      ttlSeconds: 0,
    });
  }
  const config = loadTurnConfig();
  const iceServers = buildIceServers({ config, userId: session.user.id });
  return NextResponse.json({
    iceServers,
    ttlSeconds: config?.ttlSeconds ?? 0,
  });
}

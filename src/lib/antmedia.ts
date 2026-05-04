// Ant Media Server integration. Self-hosted streaming — no per-stream
// fees, no AUP risk for adult content, sub-second WebRTC latency.
//
// Streams are auto-created by Ant Media on first publish, so we don't
// need a "create stream" REST call. Each show gets streamId = show.id.
//
// Access control via JWT tokens (configure "JWT Stream Security
// Settings" in Ant Media's web panel). Server signs short-lived tokens
// with shared HS256 secret; Ant Media's JWT Filter validates on
// publish/play.

import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";

export interface AntMediaConfig {
  /** e.g. "stream.example.com" — no protocol, no port. */
  host: string;
  /** e.g. "WebRTCAppEE" or "LiveApp". */
  app: string;
  /** HTTPS/WSS port. Ant Media defaults to 5443. */
  port: number;
  /** Secret for signing JWT publish/play tokens (HS256). */
  jwtSecret: string;
  /** Optional shared secret for /webhook publish/play notifications. */
  webhookSecret: string | null;
  /** REST API basic-auth (admin:password) for management calls. */
  restAuth: string | null;
}

export function loadAntMediaConfig(): AntMediaConfig | null {
  const host = process.env.ANT_MEDIA_HOST;
  const jwtSecret = process.env.ANT_MEDIA_JWT_SECRET;
  if (!host || !jwtSecret) return null;
  return {
    host,
    app: process.env.ANT_MEDIA_APP || "WebRTCAppEE",
    port: Number(process.env.ANT_MEDIA_PORT ?? 5443),
    jwtSecret,
    webhookSecret: process.env.ANT_MEDIA_WEBHOOK_SECRET || null,
    restAuth:
      process.env.ANT_MEDIA_REST_USER && process.env.ANT_MEDIA_REST_PASS
        ? Buffer.from(
            `${process.env.ANT_MEDIA_REST_USER}:${process.env.ANT_MEDIA_REST_PASS}`,
          ).toString("base64")
        : null,
  };
}

export function baseUrl(config: AntMediaConfig, scheme: "https" | "wss") {
  return `${scheme}://${config.host}:${config.port}/${config.app}`;
}

export type TokenType = "publish" | "play";

export async function signStreamToken(opts: {
  config: AntMediaConfig;
  streamId: string;
  type: TokenType;
  ttlSeconds?: number;
}): Promise<string> {
  const { config, streamId, type } = opts;
  const ttl = opts.ttlSeconds ?? (type === "publish" ? 60 * 60 * 4 : 60 * 30);
  const secret = new TextEncoder().encode(config.jwtSecret);
  return await new SignJWT({ streamId, type })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret);
}

export async function verifyStreamToken(
  config: AntMediaConfig,
  token: string,
): Promise<{ streamId?: string; type?: string } | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(config.jwtSecret),
    );
    return {
      streamId: typeof payload.streamId === "string" ? payload.streamId : undefined,
      type: typeof payload.type === "string" ? payload.type : undefined,
    };
  } catch {
    return null;
  }
}

export type PublishUrls = {
  /** WebSocket URL for the WebRTC publisher SDK. */
  webSocketUrl: string;
  /** Browser URL for the bundled WebRTC publish page (fallback). */
  publishPageUrl: string;
  /** RTMP URL for OBS / external encoders (sellers who prefer OBS). */
  rtmpUrl: string;
  /** Stream id and signed token. */
  streamId: string;
  publishToken: string;
};

export async function buildPublishUrls(
  config: AntMediaConfig,
  streamId: string,
): Promise<PublishUrls> {
  const publishToken = await signStreamToken({
    config,
    streamId,
    type: "publish",
  });
  return {
    webSocketUrl: `${baseUrl(config, "wss")}/websocket`,
    publishPageUrl: `${baseUrl(config, "https")}/publish.html?id=${encodeURIComponent(streamId)}&token=${encodeURIComponent(publishToken)}`,
    rtmpUrl: `rtmp://${config.host}/${config.app}/${streamId}?token=${publishToken}`,
    streamId,
    publishToken,
  };
}

export type PlayUrls = {
  webSocketUrl: string;
  hlsUrl: string;
  streamId: string;
  playToken: string;
};

export async function buildPlayUrls(
  config: AntMediaConfig,
  streamId: string,
): Promise<PlayUrls> {
  const playToken = await signStreamToken({
    config,
    streamId,
    type: "play",
  });
  return {
    webSocketUrl: `${baseUrl(config, "wss")}/websocket`,
    hlsUrl: `${baseUrl(config, "https")}/streams/${encodeURIComponent(streamId)}.m3u8?token=${encodeURIComponent(playToken)}`,
    streamId,
    playToken,
  };
}

// Verify Ant Media's HMAC webhook signature header.
// Configure "Stream Webhook" in Ant Media; this validates the X-AMS-Signature
// header (HMAC-SHA256 of the raw body using ANT_MEDIA_WEBHOOK_SECRET).
export function verifyAntMediaWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | null,
): boolean {
  if (!secret || !signatureHeader) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signatureHeader.replace(/^sha256=/, ""), "hex"),
    );
  } catch {
    return false;
  }
}

// REST API: get broadcast status (active / idle / etc.). Used to
// double-check a stream is actually live before flipping show.status.
export async function getBroadcastStatus(
  config: AntMediaConfig,
  streamId: string,
): Promise<{ status: string | null; viewerCount: number | null } | null> {
  if (!config.restAuth) return null;
  const url = `${baseUrl(config, "https")}/rest/v2/broadcasts/${encodeURIComponent(streamId)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${config.restAuth}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      hlsViewerCount?: number;
      webRTCViewerCount?: number;
    };
    return {
      status: data.status ?? null,
      viewerCount:
        (data.hlsViewerCount ?? 0) + (data.webRTCViewerCount ?? 0),
    };
  } catch {
    return null;
  }
}

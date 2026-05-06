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
  /** OBS "Server" / "URL" field — bare app endpoint, no stream id. */
  rtmpServerUrl: string;
  /** OBS "Stream Key" field — `<streamId>?token=<jwt>`. */
  rtmpStreamKey: string;
  /** Convenience: the full single-string RTMP URL for tools that take one. */
  rtmpFullUrl: string;
  /** Stream id and signed token. */
  streamId: string;
  publishToken: string;
  /** When the JWT publish token expires (seconds since epoch). */
  publishTokenExpSec: number;
};

export async function buildPublishUrls(
  config: AntMediaConfig,
  streamId: string,
): Promise<PublishUrls> {
  const ttl = 60 * 60 * 4;
  const publishToken = await signStreamToken({
    config,
    streamId,
    type: "publish",
    ttlSeconds: ttl,
  });
  const rtmpServerUrl = `rtmp://${config.host}/${config.app}`;
  const rtmpStreamKey = `${streamId}?token=${publishToken}`;
  return {
    webSocketUrl: `${baseUrl(config, "wss")}/websocket`,
    publishPageUrl: `${baseUrl(config, "https")}/publish.html?id=${encodeURIComponent(streamId)}&token=${encodeURIComponent(publishToken)}`,
    rtmpServerUrl,
    rtmpStreamKey,
    rtmpFullUrl: `${rtmpServerUrl}/${rtmpStreamKey}`,
    streamId,
    publishToken,
    publishTokenExpSec: Math.floor(Date.now() / 1000) + ttl,
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

// REST API: hit the version endpoint. Cheapest way to confirm the
// app box can actually reach the streaming box and auth correctly.
export async function probeAntMediaVersion(
  config: AntMediaConfig,
): Promise<{
  ok: boolean;
  reachable: boolean;
  authOk: boolean;
  versionName?: string;
  versionType?: string;
  latencyMs?: number;
  error?: string;
}> {
  // Per-app /version is unauthenticated on AMS Enterprise (2.16+).
  // Don't send any Authorization header here — AMS's REST filter
  // rejects ANY request that carries an unrecognized auth header
  // even on otherwise-public endpoints. (The legacy ANT_MEDIA_REST_USER
  // / ANT_MEDIA_REST_PASS env vars are still kept on AntMediaConfig
  // for other endpoints that genuinely require auth.)
  const url = `${baseUrl(config, "https")}/rest/v2/version`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - t0;

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reachable: true,
        authOk: false,
        latencyMs,
        error: "rest_auth_failed",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        reachable: true,
        authOk: false,
        latencyMs,
        error: `http_${res.status}`,
      };
    }
    const data = (await res.json()) as {
      versionName?: string;
      versionType?: string;
    };
    return {
      ok: true,
      reachable: true,
      authOk: true,
      versionName: data.versionName,
      versionType: data.versionType,
      latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      reachable: false,
      authOk: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : "fetch_failed",
    };
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

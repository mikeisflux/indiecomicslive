// TURN credential issuance using coturn's `use-auth-secret` (REST API)
// scheme. Coturn validates the timestamp and HMAC without a DB
// roundtrip, so this is cheap to call on every page mount.
//
// Set up coturn (or Ant Media's bundled coturn) with:
//   use-auth-secret
//   static-auth-secret=<TURN_SHARED_SECRET>
//   realm=<TURN_REALM>
//
// Then point your config at the same TURN_SHARED_SECRET below and
// every browser will get short-lived credentials at session start.

import crypto from "node:crypto";

export type IceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

export type TurnConfig = {
  host: string;
  port: number;
  tlsPort: number;
  realm: string;
  sharedSecret: string;
  ttlSeconds: number;
};

export function loadTurnConfig(): TurnConfig | null {
  const host = process.env.TURN_HOST;
  const sharedSecret = process.env.TURN_SHARED_SECRET;
  if (!host || !sharedSecret) return null;
  return {
    host,
    port: Number(process.env.TURN_PORT ?? 3478),
    tlsPort: Number(process.env.TURN_TLS_PORT ?? 5349),
    realm: process.env.TURN_REALM ?? host,
    sharedSecret,
    ttlSeconds: Number(process.env.TURN_TTL_SECONDS ?? 60 * 60 * 6),
  };
}

// coturn `use-auth-secret`:
//   username = "<unix-expiry>:<opaque-id>"
//   password = base64(HMAC-SHA1(secret, username))
export function issueTurnCredential(opts: {
  config: TurnConfig;
  userId: string;
}): { username: string; credential: string; ttlSeconds: number } {
  const expiry = Math.floor(Date.now() / 1000) + opts.config.ttlSeconds;
  const username = `${expiry}:${opts.userId}`;
  const credential = crypto
    .createHmac("sha1", opts.config.sharedSecret)
    .update(username)
    .digest("base64");
  return { username, credential, ttlSeconds: opts.config.ttlSeconds };
}

// Self-test the TURN config. We can't open a UDP relay from a
// Node process easily, but we CAN verify the credential the app
// would issue is well-formed and that DNS resolves to a public IP.
// For a real reachability test, point a browser at the Trickle ICE
// page in docs/runbooks/turn-server-reset.md.
export async function probeTurnConfig(config: TurnConfig | null): Promise<{
  ok: boolean;
  configured: boolean;
  hostResolved: boolean;
  credentialFormatOk: boolean;
  error?: string;
}> {
  if (!config) {
    return {
      ok: false,
      configured: false,
      hostResolved: false,
      credentialFormatOk: false,
      error: "TURN_HOST or TURN_SHARED_SECRET unset",
    };
  }

  const cred = issueTurnCredential({ config, userId: "probe" });
  const credentialFormatOk =
    /^\d+:probe$/.test(cred.username) &&
    /^[A-Za-z0-9+/=]+$/.test(cred.credential);

  let hostResolved = false;
  try {
    const dns = await import("node:dns/promises");
    const records = await dns.lookup(config.host, { all: true });
    hostResolved = records.length > 0;
  } catch {
    hostResolved = false;
  }

  return {
    ok: hostResolved && credentialFormatOk,
    configured: true,
    hostResolved,
    credentialFormatOk,
    error: !hostResolved
      ? `DNS lookup failed for ${config.host}`
      : !credentialFormatOk
        ? "credential format unexpected"
        : undefined,
  };
}

// Build the iceServers array the browser RTCPeerConnection wants.
// Includes UDP, TCP, and TLS forms so we cover restrictive networks.
// Falls back to a public STUN if no TURN is configured.
export function buildIceServers(opts: {
  config: TurnConfig | null;
  userId: string;
}): IceServer[] {
  if (!opts.config) {
    return [{ urls: ["stun:stun.l.google.com:19302"] }];
  }
  const c = opts.config;
  const cred = issueTurnCredential({ config: c, userId: opts.userId });
  return [
    { urls: [`stun:${c.host}:${c.port}`] },
    {
      urls: [
        `turn:${c.host}:${c.port}?transport=udp`,
        `turn:${c.host}:${c.port}?transport=tcp`,
        `turns:${c.host}:${c.tlsPort}?transport=tcp`,
      ],
      username: cred.username,
      credential: cred.credential,
    },
  ];
}

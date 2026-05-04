import Mux from "@mux/mux-node";
import crypto from "node:crypto";

const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;

if (!tokenId || !tokenSecret) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set");
  }
}

export const mux = new Mux({
  tokenId: tokenId ?? "missing",
  tokenSecret: tokenSecret ?? "missing",
});

export type CreateLiveStreamResult = {
  liveStreamId: string;
  streamKey: string;
  playbackId: string;
  rtmpUrl: string;
};

export async function createLiveStream(): Promise<CreateLiveStreamResult> {
  const policy =
    (process.env.MUX_PLAYBACK_POLICY as "public" | "signed") ?? "signed";

  const stream = await mux.video.liveStreams.create({
    playback_policy: [policy],
    new_asset_settings: { playback_policy: [policy] },
    latency_mode: "low",
    reconnect_window: 60,
  });

  const playbackId = stream.playback_ids?.[0]?.id;
  if (!playbackId || !stream.stream_key) {
    throw new Error("Mux did not return a playback id or stream key");
  }

  return {
    liveStreamId: stream.id,
    streamKey: stream.stream_key,
    playbackId,
    rtmpUrl: "rtmps://global-live.mux.com:443/app",
  };
}

export async function disableLiveStream(liveStreamId: string) {
  await mux.video.liveStreams.disable(liveStreamId);
}

export function verifyMuxWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret = process.env.MUX_WEBHOOK_SECRET,
): boolean {
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) return false;

  const payload = `${parts.t}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(parts.v1, "hex"),
    );
  } catch {
    return false;
  }
}

export function muxThumbnailUrl(playbackId: string, time = 0) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;
}

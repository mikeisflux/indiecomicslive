import { prisma } from "@/lib/prisma";
import { loadAntMediaConfig, baseUrl, signRestJwt } from "@/lib/antmedia";
import { r2PutObject, r2PresignedDownload } from "@/lib/r2";

// One row per ShowRecording. Resolves either a presigned R2 URL (if
// the recording has been migrated) or a direct AMS streams URL (if
// it's still living on the AMS box). Used by the replay player.
export async function recordingPlaybackUrl(opts: {
  r2Key: string;
}): Promise<string | null> {
  if (opts.r2Key.startsWith("recordings/")) {
    try {
      return await r2PresignedDownload({
        key: opts.r2Key,
        expiresIn: 60 * 60,
      });
    } catch {
      return null;
    }
  }
  // Otherwise treat r2Key as an AMS-relative file path (e.g. an MP4
  // that lives under <app>/streams/<file>). Strip leading slashes so
  // we don't double them.
  const config = loadAntMediaConfig();
  if (!config) return null;
  const path = opts.r2Key.replace(/^\/+/, "");
  return `${baseUrl(config, "https")}/streams/${path}`;
}

// Pull the MP4 off the AMS box and re-host it in R2. Updates the
// ShowRecording row's r2Key to the new R2 path on success. Idempotent
// — if r2Key already starts with "recordings/" we treat it as done.
export async function syncRecordingToR2(recordingId: string): Promise<{
  ok: boolean;
  r2Key?: string;
  reason?: string;
}> {
  const rec = await prisma.showRecording.findUnique({
    where: { id: recordingId },
    select: { id: true, showId: true, r2Key: true, sizeBytes: true },
  });
  if (!rec) return { ok: false, reason: "not_found" };
  if (rec.r2Key.startsWith("recordings/")) {
    return { ok: true, r2Key: rec.r2Key };
  }
  const config = loadAntMediaConfig();
  if (!config) return { ok: false, reason: "ams_not_configured" };

  const path = rec.r2Key.replace(/^\/+/, "");
  const url = `${baseUrl(config, "https")}/streams/${path}`;

  // Some AMS installs gate /streams behind the same JWT REST filter;
  // try with auth first, fall back to bare GET. Either way, the
  // server is reaching out to the AMS box on the same trust boundary.
  let res: Response | null = null;
  try {
    const jwt = signRestJwt(config.jwtSecret);
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) {
      res = await fetch(url);
    }
  } catch {
    res = null;
  }
  if (!res || !res.ok) return { ok: false, reason: "ams_fetch_failed" };

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) return { ok: false, reason: "empty_payload" };

  const filename = path.split("/").pop() || `${recordingId}.mp4`;
  const newKey = `recordings/${rec.showId}/${recordingId}/${filename}`;
  await r2PutObject({
    key: newKey,
    body: bytes,
    contentType: "video/mp4",
  });

  await prisma.showRecording.update({
    where: { id: rec.id },
    data: { r2Key: newKey, sizeBytes: bytes.length },
  });

  return { ok: true, r2Key: newKey };
}

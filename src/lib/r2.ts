import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicUrl = process.env.R2_PUBLIC_URL;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("R2 environment variables are not fully configured");
  }
}

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId ?? "missing",
    secretAccessKey: secretAccessKey ?? "missing",
  },
});

export type SignedUploadResult = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

export async function createSignedUpload(opts: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<SignedUploadResult> {
  if (!bucket || !publicUrl) {
    throw new Error("R2_BUCKET or R2_PUBLIC_URL not set");
  }

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ContentType: opts.contentType,
  });

  const uploadUrl = await getSignedUrl(r2, cmd, {
    expiresIn: opts.expiresIn ?? 60 * 5,
  });

  return {
    uploadUrl,
    publicUrl: `${publicUrl}/${opts.key}`,
    key: opts.key,
  };
}

export function r2Key(parts: string[]): string {
  return parts
    .map((p) => p.replace(/[^a-zA-Z0-9._-]/g, "_"))
    .filter(Boolean)
    .join("/");
}

// Upload bytes from the server (used by Inbound Parse webhook for
// stashing email attachments).
export async function r2PutObject(opts: {
  key: string;
  body: Buffer;
  contentType?: string;
}): Promise<void> {
  if (!bucket) throw new Error("R2_BUCKET not set");
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType ?? "application/octet-stream",
    }),
  );
}

// Generate a short-lived presigned URL for a download. Used by the
// admin inbox to let staff click an attachment link.
export async function r2PresignedDownload(opts: {
  key: string;
  filename?: string;
  expiresIn?: number;
}): Promise<string> {
  if (!bucket) throw new Error("R2_BUCKET not set");
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ResponseContentDisposition: opts.filename
      ? `attachment; filename="${opts.filename.replace(/"/g, "")}"`
      : undefined,
  });
  return getSignedUrl(r2, cmd, { expiresIn: opts.expiresIn ?? 60 * 10 });
}

// Fetch an object's bytes back into the server. Used by the inbox
// "forward" flow to copy original attachments into the new outbound
// email's SendGrid payload + R2 archive.
export async function r2GetObject(opts: { key: string }): Promise<Buffer> {
  if (!bucket) throw new Error("R2_BUCKET not set");
  const out = await r2.send(
    new GetObjectCommand({ Bucket: bucket, Key: opts.key }),
  );
  if (!out.Body) throw new Error("r2GetObject: empty body");
  // Body is a Node.js Readable when this runs server-side under Node.
  const chunks: Buffer[] = [];
  for await (const chunk of out.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function r2DeleteObject(key: string): Promise<void> {
  if (!bucket) throw new Error("R2_BUCKET not set");
  await r2
    .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    .catch(() => null);
}

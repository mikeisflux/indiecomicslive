import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

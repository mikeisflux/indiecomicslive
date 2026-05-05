// AES-256-GCM encryption-at-rest for bank account / KYC PII.
// Pattern from indiecrowdfund_2.0/src/lib/encryption.ts. Key from env
// (BANK_ACCOUNT_ENCRYPTION_KEY, 32 bytes base64). For full PCI-DSS scope
// later, swap this for KMS / HashiCorp Vault Transit — same surface
// (encryptCredential / decryptCredential).

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "BANK_ACCOUNT_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32`.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "BANK_ACCOUNT_ENCRYPTION_KEY must be 32 bytes (base64-decoded).",
    );
  }
  return key;
}

export function encryptCredential(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptCredential(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : digits;
}

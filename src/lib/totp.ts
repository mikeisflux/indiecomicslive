import crypto from "node:crypto";

// RFC 6238 TOTP — 30-second window, 6 digits, SHA-1 (per the spec
// most authenticator apps default to). Hand-rolled so we don't pull
// a third-party dep.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const cleaned = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of cleaned) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("invalid_base32_char");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): { base32: string; raw: Buffer } {
  const raw = crypto.randomBytes(20);
  return { base32: base32Encode(raw), raw };
}

function hotp(secret: Buffer, counter: bigint): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counter);
  const h = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = h[h.length - 1] & 0xf;
  const code =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function verifyTotp(
  secret: Buffer,
  code: string,
  at: number = Date.now(),
): boolean {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const counter = BigInt(Math.floor(at / 30000));
  // ±1 step tolerance for clock drift.
  for (const delta of [-1n, 0n, 1n]) {
    const c = counter + delta;
    if (c < 0n) continue;
    if (timingSafeEqStr(hotp(secret, c), cleaned)) return true;
  }
  return false;
}

export function otpauthUrl(opts: {
  secretBase32: string;
  account: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`);
  const issuer = encodeURIComponent(opts.issuer);
  return `otpauth://totp/${label}?secret=${opts.secretBase32}&issuer=${issuer}&period=30&digits=6&algorithm=SHA1`;
}

// Backup codes — 8 unique 10-digit codes formatted as XXXX-XXXX.
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  while (codes.length < 8) {
    const n = crypto.randomInt(0, 99999999);
    const s = String(n).padStart(8, "0");
    const formatted = `${s.slice(0, 4)}-${s.slice(4)}`;
    if (!codes.includes(formatted)) codes.push(formatted);
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  // Plain SHA-256 — backup codes are short-lived, single-use, and
  // already random; defense-in-depth is fine here.
  return crypto
    .createHash("sha256")
    .update(code.replace(/\s|-/g, "").toUpperCase())
    .digest("hex");
}

function timingSafeEqStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// scrypt-based password hash + verify for the admin credentials login.
// We only need it to gate /admin — magic-link is still the path for
// regular users. Format:  scrypt.N.r.p.<saltB64url>.<hashB64url>
//
// Separator is '.' (not '$') because dotenv-expand interprets '$X' in
// values as variable references — '$16384' would expand to nothing.
// Salt + key are base64url so they never contain '.', '$', or '='.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number; maxmem?: number },
) => Promise<Buffer>;

const N = 16384; // 2^14
const r = 8;
const p = 1;
const KEYLEN = 32;

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

export async function hashAdminPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(plain, salt, KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt.${N}.${r}.${p}.${b64url(salt)}.${b64url(key)}`;
}

export async function verifyAdminPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(".");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const block = Number(parts[2]);
  const para = Number(parts[3]);
  const salt = fromB64url(parts[4]);
  const expected = fromB64url(parts[5]);
  if (!Number.isFinite(cost) || !Number.isFinite(block) || !Number.isFinite(para)) {
    return false;
  }
  const got = await scrypt(plain, salt, expected.length, {
    N: cost,
    r: block,
    p: para,
    maxmem: 128 * 1024 * 1024,
  });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

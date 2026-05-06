#!/usr/bin/env node
// Generate a VAPID keypair for Web Push. Run once and copy the output
// into .env.local — VAPID_PUBLIC_KEY (base64url) and VAPID_PRIVATE_KEY
// (PKCS8 PEM). Set VAPID_SUBJECT too (mailto:hello@indiecomicslive.com
// or similar). Print the pubkey in the form the browser needs
// (NEXT_PUBLIC_VAPID_PUBLIC_KEY) — exposed to clients for subscribe().

import { generateKeyPairSync, createPublicKey } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

// Raw 65-byte uncompressed P-256 pubkey -> base64url
const rawPub = createPublicKey(publicKey)
  .export({ format: "der", type: "spki" });
// SPKI prefix is 26 bytes for P-256 EC; raw key is the trailing 65 bytes.
const rawKey = rawPub.subarray(rawPub.length - 65);
const pubB64u = rawKey.toString("base64url");

const pkcs8 = privateKey.export({ format: "pem", type: "pkcs8" }).toString();

console.log("# Add to .env.local — DO NOT COMMIT --");
console.log(`VAPID_PUBLIC_KEY=${pubB64u}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${pubB64u}`);
console.log("VAPID_PRIVATE_KEY=\"$(cat <<'PEM'");
console.log(pkcs8.trim());
console.log("PEM");
console.log(")\"");
console.log("VAPID_SUBJECT=mailto:hello@indiecomicslive.com");

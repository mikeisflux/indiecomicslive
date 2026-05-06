#!/usr/bin/env node
// Generate a VAPID keypair for Web Push. Run once and copy the output
// into .env.local — VAPID_PUBLIC_KEY (base64url), VAPID_PRIVATE_KEY
// (PKCS8 PEM), and VAPID_SUBJECT (mailto:…). Also prints
// NEXT_PUBLIC_VAPID_PUBLIC_KEY which the browser needs for subscribe().

import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

// Raw 65-byte uncompressed P-256 pubkey -> base64url. publicKey is
// already a KeyObject; export DER/SPKI then strip the 26-byte prefix.
const spki = publicKey.export({ format: "der", type: "spki" });
const rawKey = spki.subarray(spki.length - 65);
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

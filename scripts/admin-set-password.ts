// Set or rotate the admin password used at /staff-sign-in.
// Hashes the password with scrypt (matching src/lib/admin-password.ts)
// and writes ADMIN_EMAIL + ADMIN_PASSWORD_HASH into .env.local on the
// box. Re-run any time you want a new password.
//
// Usage:
//   sudo -u icl npx tsx scripts/admin-set-password.ts \
//        mikeisflux@indiecomicslive.com 'YourNewPassword'
//
// If you omit the password it'll prompt for one (no echo).

import path from "node:path";
import fs from "node:fs/promises";
import readline from "node:readline";
import { hashAdminPassword } from "../src/lib/admin-password";

async function readSecret(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return await new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function upsertEnvLine(file: string, key: string, value: string) {
  let body = "";
  try {
    body = await fs.readFile(file, "utf8");
  } catch {
    /* fresh file */
  }
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(body)) {
    body = body.replace(re, line);
  } else {
    if (body && !body.endsWith("\n")) body += "\n";
    body += line + "\n";
  }
  await fs.writeFile(file, body, { mode: 0o600 });
}

async function main() {
  const email = (process.argv[2] ?? "").trim();
  if (!email) {
    console.error("Usage: tsx scripts/admin-set-password.ts <email> [password]");
    process.exit(1);
  }
  let pw = process.argv[3];
  if (!pw) pw = await readSecret("New admin password: ");
  if (!pw || pw.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }
  const hash = await hashAdminPassword(pw);

  const envFile = path.resolve(process.cwd(), ".env.local");
  await upsertEnvLine(envFile, "ADMIN_EMAIL", email);
  await upsertEnvLine(envFile, "ADMIN_PASSWORD_HASH", hash);

  console.log(`\nWrote ADMIN_EMAIL + ADMIN_PASSWORD_HASH to ${envFile}.`);
  console.log("Restart the app for it to pick up the new env:");
  console.log("  sudo -u icl HOME=/home/icl pm2 restart indiecomicslive --update-env");
  console.log(`\nThen sign in at https://indiecomicslive.com/staff-sign-in`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

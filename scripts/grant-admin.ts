// Grant or revoke admin privileges by email.
// Usage:
//   npx tsx scripts/grant-admin.ts mike@example.com           → admin
//   npx tsx scripts/grant-admin.ts mike@example.com super     → super_admin
//   npx tsx scripts/grant-admin.ts mike@example.com revoke    → viewer
//
// Bootstrap pattern: after you sign in for the first time, run this
// once with `super` to give yourself the highest privileges. From then
// on you can promote others through /admin/users/[id].

import path from "node:path";
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2];
  const mode = (process.argv[3] ?? "admin").toLowerCase();

  if (!email) {
    console.error(
      "Usage: tsx scripts/grant-admin.ts <email> [admin|super|revoke]",
    );
    process.exit(1);
  }

  const role =
    mode === "super"
      ? "super_admin"
      : mode === "revoke"
        ? "viewer"
        : "admin";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role },
  });

  console.log(`${email} → ${role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Load env files in the same priority order Next.js uses
// (.env.local > .env.production > .env). Imported as the very
// first side-effect in any standalone Node entry point so that
// process.env is populated BEFORE other modules (notably
// @/lib/prisma) read DATABASE_URL.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

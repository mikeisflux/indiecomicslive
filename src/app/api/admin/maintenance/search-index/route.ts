import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/maintenance/search-index — one-shot, idempotent
// installer for the tsvector full-text search column + GIN index +
// trigger. Run once after the next deploy; subsequent calls are
// no-ops.
//
// Why this lives outside Prisma's db push: Prisma can't model
// generated columns / GIN indexes / triggers in the schema language.
export async function POST() {
  const me = await requireAdmin("/admin");

  await prisma.$executeRaw(
    Prisma.sql`ALTER TABLE lots ADD COLUMN IF NOT EXISTS search_vector tsvector`,
  );

  await prisma.$executeRaw(
    Prisma.sql`UPDATE lots
       SET search_vector = to_tsvector('english',
         coalesce(title, '') || ' ' || coalesce(description, ''))
       WHERE search_vector IS NULL`,
  );

  await prisma.$executeRaw(
    Prisma.sql`CREATE INDEX IF NOT EXISTS lots_search_vector_idx
       ON lots USING GIN (search_vector)`,
  );

  await prisma.$executeRaw(
    Prisma.sql`CREATE OR REPLACE FUNCTION lots_search_vector_update()
       RETURNS trigger AS $$
       BEGIN
         NEW.search_vector := to_tsvector('english',
           coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
         RETURN NEW;
       END;
       $$ LANGUAGE plpgsql`,
  );

  await prisma.$executeRaw(
    Prisma.sql`DROP TRIGGER IF EXISTS lots_search_vector_trigger ON lots`,
  );

  await prisma.$executeRaw(
    Prisma.sql`CREATE TRIGGER lots_search_vector_trigger
       BEFORE INSERT OR UPDATE OF title, description ON lots
       FOR EACH ROW EXECUTE FUNCTION lots_search_vector_update()`,
  );

  await logAudit({
    actorId: me.id,
    action: "maintenance.search_index",
  });

  return NextResponse.json({ ok: true });
}

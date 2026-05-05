import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";

// GET — return the current PlatformSetting row (creating it if missing).
export async function GET() {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const row = await prisma.platformSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  return NextResponse.json({ settings: row });
}

const Body = z.object({
  activeProcessor: z.enum(["nmi", "divinitycoin"]).optional(),
  divinityCoinEnabled: z.boolean().optional(),
  divinityCoinApiKey: z.string().max(500).nullable().optional(),
  divinityCoinPublicKey: z.string().max(500).nullable().optional(),
  divinityCoinPrivateKey: z.string().max(500).nullable().optional(),
  divinityCoinPartnerId: z.string().max(200).nullable().optional(),
  divinityCoinWebhookSecret: z.string().max(500).nullable().optional(),
  divinityCoinBaseUrl: z.string().url().max(500).nullable().optional(),
});

// PATCH — update one or more fields. Sentinel "" / null clears a field.
export async function PATCH(req: Request) {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_body",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const updated = await prisma.platformSetting.upsert({
    where: { id: "default" },
    update: { ...parsed.data, updatedBy: me.id },
    create: { id: "default", ...parsed.data, updatedBy: me.id },
  });

  await logAudit({
    actorId: me.id,
    action: "platform_settings.update",
    targetKind: "platform_settings",
    targetId: "default",
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ ok: true, settings: updated });
}


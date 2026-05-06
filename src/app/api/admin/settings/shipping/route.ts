import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { invalidateShippoCache } from "@/lib/shippo";

export const runtime = "nodejs";

interface Body {
  // Send a non-empty string to set, `null` to wipe, omit to leave alone.
  apiKey?: string | null;
  webhookSecret?: string | null;
}

export async function PUT(req: Request) {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const data: Record<string, unknown> = { updatedBy: me.id };
  if (Object.prototype.hasOwnProperty.call(body, "apiKey")) {
    if (body.apiKey === null) {
      data.shippoApiKey = null;
    } else if (typeof body.apiKey === "string" && body.apiKey.trim()) {
      data.shippoApiKey = body.apiKey.trim();
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "webhookSecret")) {
    if (body.webhookSecret === null) {
      data.shippoWebhookSecret = null;
    } else if (
      typeof body.webhookSecret === "string" &&
      body.webhookSecret.trim()
    ) {
      data.shippoWebhookSecret = body.webhookSecret.trim();
    }
  }

  if (Object.keys(data).length === 1) {
    return NextResponse.json(
      { error: "nothing_to_update" },
      { status: 400 },
    );
  }

  await prisma.platformSetting.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });

  invalidateShippoCache();

  await logAudit({
    actorId: me.id,
    action: "settings.shipping_updated",
    targetKind: "platform_setting",
    targetId: "default",
    metadata: {
      changedApiKey: Object.prototype.hasOwnProperty.call(data, "shippoApiKey"),
      changedWebhookSecret: Object.prototype.hasOwnProperty.call(
        data,
        "shippoWebhookSecret",
      ),
    },
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { invalidateRecaptchaCache } from "@/lib/recaptcha";

export const runtime = "nodejs";

interface Body {
  enabled?: boolean;
  siteKey?: string | null;
  // Optional. Omitted = keep existing. null = wipe. string = replace.
  secretKey?: string | null;
}

export async function PUT(req: Request) {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const data: Record<string, unknown> = {
    recaptchaEnabled: !!body.enabled,
    updatedBy: me.id,
  };
  if (typeof body.siteKey === "string") {
    data.recaptchaSiteKey = body.siteKey.trim() || null;
  } else if (body.siteKey === null) {
    data.recaptchaSiteKey = null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "secretKey")) {
    if (body.secretKey === null) {
      data.recaptchaSecretKey = null;
    } else if (typeof body.secretKey === "string" && body.secretKey.trim().length > 0) {
      data.recaptchaSecretKey = body.secretKey.trim();
    }
    // Empty string / undefined: leave secret unchanged.
  }

  // If enabling, require both keys to be (or become) set.
  if (data.recaptchaEnabled) {
    const current = await prisma.platformSetting.findUnique({
      where: { id: "default" },
    });
    const finalSite =
      "recaptchaSiteKey" in data
        ? (data.recaptchaSiteKey as string | null)
        : current?.recaptchaSiteKey ?? null;
    const finalSecret =
      "recaptchaSecretKey" in data
        ? (data.recaptchaSecretKey as string | null)
        : current?.recaptchaSecretKey ?? null;
    if (!finalSite || !finalSecret) {
      return NextResponse.json(
        { error: "missing_keys", message: "Site key and secret key are both required to enable reCAPTCHA." },
        { status: 400 },
      );
    }
  }

  await prisma.platformSetting.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });

  invalidateRecaptchaCache();

  await logAudit({
    actorId: me.id,
    action: "settings.recaptcha_updated",
    targetKind: "platform_setting",
    targetId: "default",
    metadata: {
      enabled: data.recaptchaEnabled,
      changedSecret: Object.prototype.hasOwnProperty.call(data, "recaptchaSecretKey"),
    },
  });

  return NextResponse.json({ ok: true });
}

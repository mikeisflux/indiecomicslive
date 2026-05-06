import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { sendEmailRich } from "@/lib/email-rich";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lock"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("unlock"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("ban"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("unban"), reason: z.string().max(500).optional() }),
  z.object({
    action: z.literal("chat_ban"),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("chat_unban"),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("set_role"),
    role: z.enum(["viewer", "seller", "admin", "super_admin"]),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("ip_block"),
    ip: z.string().min(3).max(64),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("send_password_reset"),
    reason: z.string().max(500).optional(),
  }),
]);

const RESET_TTL_MIN = 60;

function siteOrigin(): string {
  return (
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://indiecomicslive.com"
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, lastKnownIP: true },
  });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (target.id === me.id && parsed.data.action === "ban") {
    return NextResponse.json({ error: "cannot_ban_self" }, { status: 400 });
  }

  switch (parsed.data.action) {
    case "lock":
      await prisma.user.update({
        where: { id },
        data: {
          lockedAt: new Date(),
          lockedById: me.id,
          lockedReason: parsed.data.reason,
        },
      });
      break;
    case "unlock":
      await prisma.user.update({
        where: { id },
        data: { lockedAt: null, lockedById: null, lockedReason: null },
      });
      break;
    case "ban":
      await prisma.user.update({
        where: { id },
        data: { bannedAt: new Date() },
      });
      break;
    case "unban":
      await prisma.user.update({ where: { id }, data: { bannedAt: null } });
      break;
    case "chat_ban":
      await prisma.user.update({
        where: { id },
        data: {
          chatBannedAt: new Date(),
          chatBannedById: me.id,
          chatBanReason: parsed.data.reason,
        },
      });
      break;
    case "chat_unban":
      await prisma.user.update({
        where: { id },
        data: {
          chatBannedAt: null,
          chatBannedById: null,
          chatBanReason: null,
        },
      });
      break;
    case "set_role":
      await prisma.user.update({
        where: { id },
        data: { role: parsed.data.role },
      });
      break;
    case "ip_block": {
      const ip = parsed.data.ip;
      await prisma.iPBlocklist.upsert({
        where: { ipAddress: ip },
        update: {
          userId: id,
          bannedById: me.id,
          reason: parsed.data.reason,
        },
        create: {
          ipAddress: ip,
          userId: id,
          bannedById: me.id,
          reason: parsed.data.reason,
        },
      });
      break;
    }
    case "send_password_reset": {
      if (!target.email) {
        return NextResponse.json(
          { error: "no_email", message: "User has no email on file." },
          { status: 400 },
        );
      }
      // Mint a fresh single-use reset token. Same shape as the
      // self-service /forgot-password path so the existing
      // /reset-password page Just Works.
      const rawToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);
      await prisma.passwordResetToken.create({
        data: { userId: id, tokenHash, expiresAt },
      });
      const url = `${siteOrigin()}/reset-password?token=${rawToken}`;
      const subject = "Set a new Indie Comics Live password";
      const text = [
        `An admin sent you this link to set a new password.`,
        ``,
        url,
        ``,
        `This link expires in ${RESET_TTL_MIN} minutes. If you didn't expect this message, ignore it — nothing changes until the link is opened and a new password is saved.`,
      ].join("\n");
      const html = `
        <body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;padding:32px">
          <div style="max-width:480px;margin:0 auto">
            <h1 style="font-size:20px;margin:0 0 16px">Set a new password</h1>
            <p style="margin:0 0 24px;color:#aaa">
              An admin sent this link so you can set a new password for
              <strong style="color:#fff">${target.email}</strong>. It
              expires in ${RESET_TTL_MIN} minutes.
            </p>
            <p style="margin:0 0 24px">
              <a href="${url}"
                 style="display:inline-block;background:#ff3366;color:#fff;text-decoration:none;
                        padding:14px 28px;border-radius:999px;font-weight:700">
                Choose new password
              </a>
            </p>
            <p style="margin:0;color:#666;font-size:12px;word-break:break-all">${url}</p>
            <p style="margin:24px 0 0;color:#666;font-size:12px">
              Didn&rsquo;t expect this? You can safely ignore this email.
            </p>
          </div>
        </body>`;
      const send = await sendEmailRich({
        to: [target.email],
        subject,
        text,
        html,
      });
      if (!send.ok) {
        return NextResponse.json(
          {
            error: "email_failed",
            message: `Token saved but email send failed: ${send.error}`,
            status: send.status,
          },
          { status: 502 },
        );
      }
      break;
    }
  }

  await logAudit({
    actorId: me.id,
    action: `user.${parsed.data.action}`,
    targetKind: "user",
    targetId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true });
}

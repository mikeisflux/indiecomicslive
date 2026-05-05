"use server";

import { headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { sendEmailRich } from "@/lib/email-rich";

export interface ForgotPasswordResult {
  ok: boolean;
  // We always show "if the email matches we sent a link" so attackers
  // can't enumerate accounts. error/field are only used for validation
  // and captcha failures.
  error?: string;
  field?: "email" | "captcha";
  sent?: boolean;
}

const RESET_TTL_MIN = 60;

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

function siteOrigin(): string {
  return process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://indiecomicslive.com";
}

export async function forgotPasswordAction(
  prev: ForgotPasswordResult | null,
  formData: FormData,
): Promise<ForgotPasswordResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/.+@.+\..+/.test(email)) {
    return { ok: false, error: "Enter a valid email.", field: "email" };
  }
  const captcha = await verifyRecaptcha(
    formData.get("g-recaptcha-response")?.toString() ?? null,
    await clientIp(),
  );
  if (!captcha.ok) {
    return { ok: false, error: "Please complete the captcha.", field: "captcha" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Always pretend we succeeded so attackers can't enumerate accounts.
  if (!user) return { ok: true, sent: true };

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const url = `${siteOrigin()}/reset-password?token=${rawToken}`;
  const subject = "Reset your Indie Comics Live password";
  const text = [
    `Click the link to set a new password:`,
    url,
    ``,
    `This link expires in ${RESET_TTL_MIN} minutes. If you didn't ask to reset your password, ignore this email.`,
  ].join("\n");
  const html = `
    <body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;padding:32px">
      <div style="max-width:480px;margin:0 auto">
        <h1 style="font-size:20px;margin:0 0 16px">Reset your password</h1>
        <p style="margin:0 0 24px;color:#aaa">
          Click below to choose a new password. This link expires in ${RESET_TTL_MIN} minutes.
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
          Didn't ask for this? Ignore this email; nothing changes.
        </p>
      </div>
    </body>`;

  const send = await sendEmailRich({
    to: [email],
    subject,
    text,
    html,
  });
  if (!send.ok) {
    console.error("[forgot-password] email send failed", send.error);
    // Still return ok:true so we don't leak whether the email exists.
  }

  return { ok: true, sent: true };
}

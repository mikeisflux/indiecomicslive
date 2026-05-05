"use server";

import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { hashAdminPassword } from "@/lib/admin-password";
import { verifyRecaptcha } from "@/lib/recaptcha";

export interface ResetPasswordResult {
  ok: boolean;
  error?: string;
  field?: "password" | "token" | "captcha";
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export async function resetPasswordAction(
  prev: ResetPasswordResult | null,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!token) {
    return { ok: false, error: "Missing reset token.", field: "token" };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters.", field: "password" };
  }

  const captcha = await verifyRecaptcha(
    formData.get("g-recaptcha-response")?.toString() ?? null,
    await clientIp(),
  );
  if (!captcha.ok) {
    return { ok: false, error: "Please complete the captcha.", field: "captcha" };
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row || row.consumedAt || row.expiresAt < new Date()) {
    return {
      ok: false,
      error: "This reset link is invalid or expired. Request a new one.",
      field: "token",
    };
  }

  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) {
    return { ok: false, error: "Account not found.", field: "token" };
  }

  const passwordHash = await hashAdminPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    }),
    // Best-effort cleanup: invalidate any other outstanding reset
    // tokens for this user so a stolen older one can't be reused.
    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
        id: { not: row.id },
      },
      data: { consumedAt: new Date() },
    }),
  ]);

  await signIn("credentials", {
    email: user.email,
    password,
    redirectTo: "/",
  });

  return { ok: true };
}

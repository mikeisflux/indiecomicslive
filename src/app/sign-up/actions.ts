"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { hashAdminPassword } from "@/lib/admin-password";
import { verifyRecaptcha } from "@/lib/recaptcha";

export interface SignUpResult {
  ok: boolean;
  error?: string;
  field?: "email" | "password" | "name" | "captcha";
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

export async function signUpAction(
  prev: SignUpResult | null,
  formData: FormData,
): Promise<SignUpResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");

  if (!email || !/.+@.+\..+/.test(email)) {
    return { ok: false, error: "Enter a valid email.", field: "email" };
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      error: "An account with that email already exists. Sign in instead.",
      field: "email",
    };
  }

  const passwordHash = await hashAdminPassword(password);
  await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      role: "viewer",
    },
  });

  // signIn() throws a NEXT_REDIRECT to short-circuit the function; let
  // it bubble. On caller side this is the success path.
  await signIn("credentials", {
    email,
    password,
    redirectTo: callbackUrl.startsWith("/") ? callbackUrl : "/",
  });

  // Unreachable on success.
  return { ok: true };
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  base32Decode,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  otpauthUrl,
  verifyTotp,
} from "@/lib/totp";
import { encryptCredential, decryptCredential } from "@/lib/encryption";

export const runtime = "nodejs";

// Two-factor flow:
//   GET    — start enrollment (returns base32 secret + otpauth URL).
//            We store the proposed secret encrypted but DON'T enable
//            2FA yet — the user has to verify a code first.
//   POST   — verify a code against the proposed secret, flip
//            totpEnabledAt, mint backup codes (returned ONCE).
//   DELETE — disable 2FA. Requires either a current TOTP code or one
//            of the backup codes.

const ISSUER = "Indie Comics Live";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, totpEnabledAt: true },
  });
  if (!me) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (me.totpEnabledAt) {
    return NextResponse.json({ enabled: true });
  }
  const { base32, raw } = generateTotpSecret();
  await prisma.user.update({
    where: { id: me.id },
    data: { totpSecretEnc: encryptCredential(raw.toString("base64")) },
  });
  return NextResponse.json({
    enabled: false,
    secret: base32,
    otpauth: otpauthUrl({
      secretBase32: base32,
      account: me.email ?? me.id,
      issuer: ISSUER,
    }),
  });
}

const Verify = z.object({ code: z.string().min(6).max(7) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Verify.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, totpSecretEnc: true, totpEnabledAt: true },
  });
  if (!me?.totpSecretEnc) {
    return NextResponse.json({ error: "no_pending_secret" }, { status: 400 });
  }
  const raw = Buffer.from(decryptCredential(me.totpSecretEnc), "base64");
  if (!verifyTotp(raw, parsed.data.code)) {
    return NextResponse.json({ error: "wrong_code" }, { status: 400 });
  }
  // First successful verify enables 2FA; subsequent calls just verify.
  if (!me.totpEnabledAt) {
    const codes = generateBackupCodes();
    await prisma.user.update({
      where: { id: me.id },
      data: {
        totpEnabledAt: new Date(),
        totpBackupCodesHashed: codes.map(hashBackupCode),
      },
    });
    return NextResponse.json({ ok: true, backupCodes: codes });
  }
  return NextResponse.json({ ok: true });
}

const Disable = z.object({ code: z.string().min(6).max(20) });

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Disable.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      totpSecretEnc: true,
      totpEnabledAt: true,
      totpBackupCodesHashed: true,
    },
  });
  if (!me?.totpEnabledAt || !me.totpSecretEnc) {
    return NextResponse.json({ error: "not_enabled" }, { status: 400 });
  }
  const raw = Buffer.from(decryptCredential(me.totpSecretEnc), "base64");
  const code = parsed.data.code;
  const totpOk = verifyTotp(raw, code);
  const backupOk = me.totpBackupCodesHashed.includes(hashBackupCode(code));
  if (!totpOk && !backupOk) {
    return NextResponse.json({ error: "wrong_code" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: me.id },
    data: {
      totpSecretEnc: null,
      totpEnabledAt: null,
      totpBackupCodesHashed: [],
    },
  });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/encryption";

export const runtime = "nodejs";

// POST /api/seller/tax-form — captures the seller's W-9 (or W-8BEN
// equivalent for non-US). Legal name + TIN are encrypted at rest;
// address is a narrow JSON blob. Acts as a signature event — sets
// taxFormSignedAt to now. The 1099-K year-end report joins this with
// payouts; gating happens in src/lib/payouts.ts (sellers without a
// signed form are paused, not failed).
const Body = z.object({
  formType: z.enum(["W9", "W8"]),
  legalName: z.string().min(1).max(120),
  tin: z.string().min(4).max(20),
  address: z.object({
    line1: z.string().min(1).max(120),
    line2: z.string().max(120).optional().nullable(),
    city: z.string().min(1).max(80),
    state: z.string().max(40),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(2).max(2),
  }),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const tin = parsed.data.tin.replace(/[^0-9]/g, "");
  if (tin.length < 9) {
    return NextResponse.json({ error: "invalid_tin" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      taxFormType: parsed.data.formType,
      taxLegalNameEnc: encryptCredential(parsed.data.legalName),
      taxTinEnc: encryptCredential(tin),
      taxAddressJson: parsed.data.address as unknown as Record<string, unknown>,
      taxFormSignedAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}

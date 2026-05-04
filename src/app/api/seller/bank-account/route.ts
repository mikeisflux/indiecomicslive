import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  encryptCredential,
  maskAccountNumber,
} from "@/lib/encryption";

const Body = z.object({
  bankName: z.string().min(2).max(120),
  accountHolderFirstName: z.string().min(1).max(100),
  accountHolderLastName: z.string().min(1).max(100),
  accountNumber: z.string().min(4).max(34),
  routingNumber: z.string().regex(/^\d{9}$/, "routing number must be 9 digits"),
  accountType: z.enum(["checking", "savings"]).default("checking"),

  billingLine1: z.string().min(1).max(200),
  billingLine2: z.string().max(200).optional(),
  billingCity: z.string().min(1).max(100),
  billingState: z.string().min(1).max(100),
  billingZip: z.string().min(1).max(20),
  billingCountry: z.string().min(2).max(3),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const acct = await prisma.paymentCloudBankAccount.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      bankNameDisplay: true,
      accountLastFour: true,
      accountType: true,
      isVerified: true,
      verifiedAt: true,
    },
  });
  return NextResponse.json({ bankAccount: acct });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body" },
      { status: 400 },
    );
  }

  const acct = await prisma.paymentCloudBankAccount.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      bankNameEncrypted: encryptCredential(parsed.data.bankName),
      accountHolderFirstNameEncrypted: encryptCredential(
        parsed.data.accountHolderFirstName,
      ),
      accountHolderLastNameEncrypted: encryptCredential(
        parsed.data.accountHolderLastName,
      ),
      accountNumberEncrypted: encryptCredential(parsed.data.accountNumber),
      routingNumberEncrypted: encryptCredential(parsed.data.routingNumber),
      billingLine1Encrypted: encryptCredential(parsed.data.billingLine1),
      billingLine2Encrypted: parsed.data.billingLine2
        ? encryptCredential(parsed.data.billingLine2)
        : null,
      billingCityEncrypted: encryptCredential(parsed.data.billingCity),
      billingStateEncrypted: encryptCredential(parsed.data.billingState),
      billingZipEncrypted: encryptCredential(parsed.data.billingZip),
      billingCountryEncrypted: encryptCredential(parsed.data.billingCountry),
      bankNameDisplay: parsed.data.bankName,
      accountLastFour: maskAccountNumber(parsed.data.accountNumber),
      accountType: parsed.data.accountType,
    },
    update: {
      bankNameEncrypted: encryptCredential(parsed.data.bankName),
      accountHolderFirstNameEncrypted: encryptCredential(
        parsed.data.accountHolderFirstName,
      ),
      accountHolderLastNameEncrypted: encryptCredential(
        parsed.data.accountHolderLastName,
      ),
      accountNumberEncrypted: encryptCredential(parsed.data.accountNumber),
      routingNumberEncrypted: encryptCredential(parsed.data.routingNumber),
      billingLine1Encrypted: encryptCredential(parsed.data.billingLine1),
      billingLine2Encrypted: parsed.data.billingLine2
        ? encryptCredential(parsed.data.billingLine2)
        : null,
      billingCityEncrypted: encryptCredential(parsed.data.billingCity),
      billingStateEncrypted: encryptCredential(parsed.data.billingState),
      billingZipEncrypted: encryptCredential(parsed.data.billingZip),
      billingCountryEncrypted: encryptCredential(parsed.data.billingCountry),
      bankNameDisplay: parsed.data.bankName,
      accountLastFour: maskAccountNumber(parsed.data.accountNumber),
      accountType: parsed.data.accountType,
    },
    select: {
      id: true,
      bankNameDisplay: true,
      accountLastFour: true,
      accountType: true,
      isVerified: true,
    },
  });

  return NextResponse.json({ bankAccount: acct });
}

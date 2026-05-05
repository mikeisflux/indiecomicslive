import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptCredential, maskAccountNumber } from "@/lib/encryption";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

// Same shape as the NMI bank-account body, plus we send the bank info
// to Divinity Payments to create a Stripe Connect external account on
// their side. We store the returned external account id so future
// payouts go straight there. Encrypted PII still lives in our DB so
// staff can look up details / submit ACH disputes.
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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });

  // Hand the bank details off to Divinity Payments, which creates a
  // Stripe Connect external account on its partner-platform account.
  const r = await callDivinityCoinAPI("create-external-account", {
    platformUserId: session.user.id,
    email: user?.email ?? "",
    accountHolderName: `${parsed.data.accountHolderFirstName} ${parsed.data.accountHolderLastName}`,
    accountHolderType: "individual",
    accountType: parsed.data.accountType,
    routingNumber: parsed.data.routingNumber,
    accountNumber: parsed.data.accountNumber,
    bankName: parsed.data.bankName,
    address: {
      line1: parsed.data.billingLine1,
      line2: parsed.data.billingLine2 ?? undefined,
      city: parsed.data.billingCity,
      state: parsed.data.billingState,
      zip: parsed.data.billingZip,
      country: parsed.data.billingCountry,
    },
  });

  if (!r.ok) {
    return NextResponse.json(
      { error: "dc_external_account_failed", detail: r.error },
      { status: 502 },
    );
  }

  const externalAccountId =
    (r.data.externalAccountId as string | undefined) ??
    (r.data.bankAccountId as string | undefined) ??
    (r.data.id as string | undefined);

  const acct = await prisma.paymentCloudBankAccount.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      processor: "divinitycoin",
      divinityCoinExternalAccountId: externalAccountId ?? null,
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
      processor: "divinitycoin",
      divinityCoinExternalAccountId: externalAccountId ?? null,
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

  return NextResponse.json({ bankAccount: acct, externalAccountId });
}

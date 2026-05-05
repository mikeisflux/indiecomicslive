import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

// Current platform agreement version. Bump this when ToS / Seller
// Agreement / NSFW Policy materially change so we re-prompt.
export const AGREEMENT_VERSION = "2026-05-01";

const Body = z.object({
  legalFirstName: z.string().min(1).max(100),
  legalLastName: z.string().min(1).max(100),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  phone: z.string().min(5).max(40),

  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  addressCity: z.string().min(1).max(100),
  addressState: z.string().min(1).max(100),
  addressZip: z.string().min(1).max(20),
  addressCountry: z.string().min(2).max(3),

  storeName: z.string().min(2).max(120),
  storeBio: z.string().min(20).max(2000),
  businessFilingState: z.string().max(100).optional(),
  businessFilingNumber: z.string().max(100).optional(),
  businessFilingUrl: z.string().url().optional(),
  taxIdLast4: z.string().regex(/^\d{4}$/).optional(),

  primaryWebsite: z.string().url().optional(),
  socialLinks: z
    .object({
      twitter: z.string().url().optional(),
      instagram: z.string().url().optional(),
      youtube: z.string().url().optional(),
      tiktok: z.string().url().optional(),
      bluesky: z.string().url().optional(),
      website: z.string().url().optional(),
    })
    .partial()
    .optional(),
  priorPlatforms: z
    .array(
      z.object({
        platform: z.string().max(50),
        profileUrl: z.string().url(),
        campaignsLaunched: z.number().int().nonnegative().optional(),
        unfulfilled: z.number().int().nonnegative().optional(),
        notes: z.string().max(500).optional(),
      }),
    )
    .max(20)
    .optional(),
  unfulfilledCount: z.number().int().nonnegative().optional(),
  pastDeliveryIssues: z.boolean().optional(),

  contentCategories: z.array(z.string().max(60)).max(20),
  willListAdult: z.boolean(),

  agreedToSellerAgreement: z.literal(true),
  agreedToContentPolicy: z.literal(true),
  agreedToNsfwPolicy: z.boolean().optional(),
});

// Three-or-more-unfulfilled / 1-year-past-delivery rule from
// indiecrowdfund's creator agreement, adapted for our auction context.
function autoDisqualify(input: z.infer<typeof Body>): string | null {
  const unfulfilled = input.unfulfilledCount ?? 0;
  if (unfulfilled >= 3) {
    return "auto_dq_three_or_more_unfulfilled";
  }
  if (input.pastDeliveryIssues) {
    return "auto_dq_past_delivery_issues";
  }
  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const app = await prisma.sellerApplication.findUnique({
    where: { userId: session.user.id },
  });
  return NextResponse.json({ application: app });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_body",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const dq = autoDisqualify(parsed.data);
  const now = new Date();

  const dob = new Date(parsed.data.dateOfBirth);
  const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 18) {
    return NextResponse.json({ error: "must_be_18" }, { status: 400 });
  }

  const data = {
    userId: session.user.id,
    legalFirstName: parsed.data.legalFirstName,
    legalLastName: parsed.data.legalLastName,
    dateOfBirth: dob,
    phone: parsed.data.phone,

    addressLine1: parsed.data.addressLine1,
    addressLine2: parsed.data.addressLine2,
    addressCity: parsed.data.addressCity,
    addressState: parsed.data.addressState,
    addressZip: parsed.data.addressZip,
    addressCountry: parsed.data.addressCountry,

    storeName: parsed.data.storeName,
    storeBio: parsed.data.storeBio,
    businessFilingState: parsed.data.businessFilingState,
    businessFilingNumber: parsed.data.businessFilingNumber,
    businessFilingUrl: parsed.data.businessFilingUrl,
    taxIdLast4: parsed.data.taxIdLast4,

    primaryWebsite: parsed.data.primaryWebsite,
    socialLinks: parsed.data.socialLinks ?? Prisma.JsonNull,
    priorPlatforms: parsed.data.priorPlatforms ?? Prisma.JsonNull,
    unfulfilledCount: parsed.data.unfulfilledCount ?? 0,
    pastDeliveryIssues: parsed.data.pastDeliveryIssues ?? false,

    contentCategories: parsed.data.contentCategories,
    willListAdult: parsed.data.willListAdult,

    agreedToSellerAgreementAt: now,
    agreedToContentPolicyAt: now,
    agreedToNsfwPolicyAt: parsed.data.agreedToNsfwPolicy ? now : null,
    agreementVersion: AGREEMENT_VERSION,

    status: dq ? "rejected" : ("submitted" as const),
    submittedAt: now,
    rejectionReason: dq,
    reviewedAt: dq ? now : null,
  };

  const app = await prisma.sellerApplication.upsert({
    where: { userId: session.user.id },
    update: data,
    create: data,
  });

  // Mirror DOB onto the user row.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { dateOfBirth: dob },
  });

  return NextResponse.json({ application: app });
}

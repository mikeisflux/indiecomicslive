import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, SellerApplicationStatus } from "@/generated/prisma";
import { verifyRecaptcha } from "@/lib/recaptcha";

// Current platform agreement version. Bump this when ToS / Seller
// Agreement / NSFW Policy materially change so we re-prompt.
export const AGREEMENT_VERSION = "2026-05-01";

// Accept anything URL-ish: 'blah.com', 'www.blah.com', 'http://blah.com',
// 'https://Blah.Com/path?x=1', etc. Trim, treat empty as undefined,
// prepend https:// if no scheme, then validate with the URL constructor.
function coerceUrl(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    // Reject obvious garbage like 'https://abc' (no dot in host)
    if (!u.hostname.includes(".")) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}
const flexUrl = z.preprocess(coerceUrl, z.string().url().optional());

const Body = z.object({
  recaptchaToken: z.string().optional(),
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
  // Business registration is mandatory — the platform needs a real
  // entity on file for KYC + chargeback recourse. Sole proprietors
  // file a DBA / Sole Prop registration in their state.
  businessFilingState: z.string().min(1).max(100),
  businessFilingNumber: z.string().min(1).max(100),
  businessFilingUrl: z.preprocess(
    coerceUrl,
    z.string().url({ message: "Filing URL must be a valid URL" }),
  ),
  taxIdLast4: z.string().regex(/^\d{4}$/, {
    message: "Last 4 digits of EIN / SSN required",
  }),

  primaryWebsite: flexUrl,
  socialLinks: z
    .object({
      twitter: flexUrl,
      instagram: flexUrl,
      youtube: flexUrl,
      tiktok: flexUrl,
      bluesky: flexUrl,
      website: flexUrl,
      whatnot: flexUrl,
      ebay: flexUrl,
    })
    .partial()
    .optional(),
  priorPlatforms: z
    .array(
      z.object({
        platform: z.string().max(50),
        profileUrl: z.preprocess(
          coerceUrl,
          z.string().url({ message: "must be a valid URL" }),
        ),
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
// HEAD request with a short timeout. Returns true if the server
// responded with anything, false on network error / timeout. We don't
// care about the status code — even a 403 means the host exists.
async function checkReachable(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "indiecomicslive-seller-verify/1.0" },
    });
    clearTimeout(t);
    return r.status > 0;
  } catch {
    return false;
  }
}

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

  const h = await headers();
  const captchaIp =
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const captcha = await verifyRecaptcha(parsed.data.recaptchaToken ?? null, captchaIp);
  if (!captcha.ok) {
    return NextResponse.json(
      { error: "captcha_failed", message: "Captcha verification failed." },
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

  // Reachability sanity-check on the seller's primary website. Soft —
  // log the result for admin review, don't block submission. Most
  // social URLs (twitter/instagram/etc.) intentionally block bots so
  // we don't bother checking those.
  if (parsed.data.primaryWebsite) {
    void checkReachable(parsed.data.primaryWebsite).then((ok) => {
      console.log("[seller-apply] primaryWebsite reachable?", {
        url: parsed.data.primaryWebsite,
        ok,
        userId: session.user.id,
      });
    });
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

    status: (dq ? "rejected" : "submitted") as SellerApplicationStatus,
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

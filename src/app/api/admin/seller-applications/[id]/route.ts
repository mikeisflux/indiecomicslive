import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { sendEmail, siteUrl } from "@/lib/email";

const Body = z.object({
  decision: z.enum(["approve", "reject", "request_revision"]),
  reviewerNotes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(500).optional(),
});

// Admin moves an application through the review states. Three actions:
//   approve         — flips the user to seller role, fires Seller row
//   reject          — finals it as rejected with a reason
//   request_revision — ping the seller, ask them to fix specific things;
//                       sends an email with a link back to /seller/apply
//                       and parks the application in needs_revision
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const app = await prisma.sellerApplication.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!app) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (parsed.data.decision === "approve") {
    await prisma.$transaction(async (tx) => {
      await tx.sellerApplication.update({
        where: { id: app.id },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedById: me.id,
          reviewerNotes: parsed.data.reviewerNotes,
        },
      });
      // Only promote — never downgrade an existing admin/super_admin who
      // happens to be applying with the same account. updateMany with a
      // filtered where is a no-op when the row doesn't match.
      await tx.user.updateMany({
        where: { id: app.userId, role: "viewer" },
        data: { role: "seller" },
      });
      await tx.seller.upsert({
        where: { userId: app.userId },
        update: {
          approved: true,
          approvedAt: new Date(),
          approvedById: me.id,
          storeName: app.storeName,
          bio: app.storeBio,
        },
        create: {
          userId: app.userId,
          storeName: app.storeName,
          bio: app.storeBio,
          approved: true,
          approvedAt: new Date(),
          approvedById: me.id,
        },
      });
    });
    await logAudit({
      actorId: me.id,
      action: "seller_application.approve",
      targetKind: "seller_application",
      targetId: app.id,
      metadata: { sellerUserId: app.userId, notes: parsed.data.reviewerNotes },
    });
    if (app.user?.email) {
      const signIn = `${siteUrl()}/sign-in?email=${encodeURIComponent(app.user.email)}&callbackUrl=${encodeURIComponent("/seller")}`;
      const seller = `${siteUrl()}/seller`;
      void sendEmail({
        to: app.user.email,
        subject: "You're approved to sell on Indie Comics Live",
        text:
          `Hi ${app.user.name ?? ""},\n\n` +
          `Your seller application has been approved.\n\n` +
          `Sign in here to start setting up your store:\n${signIn}\n\n` +
          `(That link will email you a one-time sign-in code.)\n\n` +
          `Once you're in, your dashboard is at ${seller}.\n\n` +
          `— Indie Comics Live`,
        html:
          `<p>Hi ${app.user.name ?? ""},</p>` +
          `<p>Your seller application has been approved.</p>` +
          `<p style="margin:24px 0;"><a href="${signIn}" style="display:inline-block;background:#ff3366;color:#0a0a0a;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;">Sign in &amp; set up your store</a></p>` +
          `<p style="color:#666;font-size:13px;">That link will email you a one-time sign-in code. After signing in, you'll land at ${seller}.</p>` +
          `<p>— Indie Comics Live</p>`,
      });
    }
    return NextResponse.json({ ok: true, status: "approved" });
  }

  if (parsed.data.decision === "request_revision") {
    await prisma.sellerApplication.update({
      where: { id: app.id },
      data: {
        status: "needs_revision",
        reviewedAt: new Date(),
        reviewedById: me.id,
        reviewerNotes: parsed.data.reviewerNotes,
      },
    });
    await logAudit({
      actorId: me.id,
      action: "seller_application.request_revision",
      targetKind: "seller_application",
      targetId: app.id,
      metadata: {
        sellerUserId: app.userId,
        notes: parsed.data.reviewerNotes,
      },
    });
    if (app.user?.email) {
      const link = `${siteUrl()}/seller/apply`;
      void sendEmail({
        to: app.user.email,
        subject: "Action needed on your Indie Comics Live seller application",
        text:
          `Hi ${app.user.name ?? ""},\n\n` +
          `We've reviewed your seller application and need a few things updated before we can approve it.\n\n` +
          (parsed.data.reviewerNotes
            ? `Notes from the reviewer:\n${parsed.data.reviewerNotes}\n\n`
            : "") +
          `Open this link to update your application:\n${link}\n\n` +
          `Your previously-entered details are saved — you only need to fix what's flagged.\n\n— Indie Comics Live`,
        html:
          `<p>Hi ${app.user.name ?? ""},</p>` +
          `<p>We've reviewed your seller application and need a few things updated before we can approve it.</p>` +
          (parsed.data.reviewerNotes
            ? `<p><strong>Notes from the reviewer:</strong><br>${escapeHtml(parsed.data.reviewerNotes)}</p>`
            : "") +
          `<p><a href="${link}" style="display:inline-block;background:#ec4899;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600;">Open my application</a></p>` +
          `<p style="color:#666;font-size:13px;">Your previously-entered details are saved — you only need to fix what's flagged.</p>` +
          `<p>— Indie Comics Live</p>`,
      });
    }
    return NextResponse.json({ ok: true, status: "needs_revision" });
  }

  await prisma.sellerApplication.update({
    where: { id: app.id },
    data: {
      status: "rejected",
      reviewedAt: new Date(),
      reviewedById: me.id,
      reviewerNotes: parsed.data.reviewerNotes,
      rejectionReason: parsed.data.rejectionReason ?? "manual_rejection",
    },
  });
  await logAudit({
    actorId: me.id,
    action: "seller_application.reject",
    targetKind: "seller_application",
    targetId: app.id,
    metadata: {
      sellerUserId: app.userId,
      reason: parsed.data.rejectionReason,
      notes: parsed.data.reviewerNotes,
    },
  });
  if (app.user?.email) {
    void sendEmail({
      to: app.user.email,
      subject: "Your Indie Comics Live seller application",
      text:
        `Hi ${app.user.name ?? ""},\n\n` +
        `We're not able to move your seller application forward at this time.\n` +
        (parsed.data.rejectionReason
          ? `Reason: ${parsed.data.rejectionReason}\n`
          : "") +
        (parsed.data.reviewerNotes ? `\nNotes:\n${parsed.data.reviewerNotes}\n` : "") +
        `\n— Indie Comics Live`,
    });
  }

  return NextResponse.json({ ok: true, status: "rejected" });
}

// Inline-edit any field of a seller application from /admin/seller-applications/[id].
// Mirrors the public submit-form schema but every field is optional —
// admins can patch one thing at a time without re-supplying the rest.
// `userEmail` is the only field that lives on the User row, not on
// SellerApplication; we route that to a separate update inside the
// handler.
const PatchBody = z
  .object({
    userEmail: z.string().email().max(320),
    legalFirstName: z.string().min(1).max(100),
    legalLastName: z.string().min(1).max(100),
    phone: z.string().min(5).max(40),
    addressLine1: z.string().min(1).max(200),
    addressLine2: z.string().max(200).nullable(),
    addressCity: z.string().min(1).max(100),
    addressState: z.string().min(1).max(100),
    addressZip: z.string().min(1).max(20),
    addressCountry: z.string().min(2).max(3),
    storeName: z.string().min(2).max(120),
    storeBio: z.string().min(20).max(2000),
    primaryWebsite: z.string().nullable(),
    businessFilingState: z.string().max(100).nullable(),
    businessFilingNumber: z.string().max(100).nullable(),
    businessFilingUrl: z.string().nullable(),
    taxIdLast4: z.string().regex(/^\d{4}$/).nullable(),
    unfulfilledCount: z.number().int().nonnegative(),
    pastDeliveryIssues: z.boolean(),
    contentCategories: z.array(z.string().max(60)).max(20),
    willListAdult: z.boolean(),
    rejectionReason: z.string().max(500).nullable(),
    reviewerNotes: z.string().max(2000).nullable(),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
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

  const app = await prisma.sellerApplication.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!app) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Pull the email out — that field lives on User, not SellerApplication.
  const { userEmail, ...applicationFields } = parsed.data;

  // If the admin is changing the email to one that's different from the
  // current owner's, treat that as "transfer this application to a
  // different account" — find or create a User with the new email,
  // reassign the application + per-user seller data to them, and leave
  // the original user (often the admin themselves) untouched.
  let transferReport: {
    fromUserId: string;
    toUserId: string;
    createdNewUser: boolean;
  } | null = null;
  const normalizedEmail =
    typeof userEmail === "string" ? userEmail.toLowerCase().trim() : null;
  const shouldTransfer =
    normalizedEmail !== null &&
    normalizedEmail.length > 0 &&
    normalizedEmail !== (app.user.email ?? "").toLowerCase();

  if (shouldTransfer) {
    // Refuse if the destination user already has their own seller
    // application — overwriting it would lose data.
    const existingSeller = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, sellerApplication: { select: { id: true } } },
    });
    if (existingSeller?.sellerApplication) {
      return NextResponse.json(
        {
          error: "destination_already_has_application",
          message:
            "That email already has a seller application. Resolve that one first.",
        },
        { status: 409 },
      );
    }

    const targetUser =
      existingSeller ??
      (await prisma.user.create({
        data: { email: normalizedEmail, role: "viewer" },
        select: { id: true },
      }));

    transferReport = {
      fromUserId: app.user.id,
      toUserId: targetUser.id,
      createdNewUser: !existingSeller,
    };

    await prisma.$transaction(async (tx) => {
      // Move per-user seller data over. Each block is conditional on
      // the source row existing, since not every relation is populated.
      await tx.sellerApplication.update({
        where: { id: app.id },
        data: { userId: targetUser.id, ...applicationFields },
      });

      const cb = await tx.sellerChargebackCard.findUnique({
        where: { userId: app.user.id },
      });
      if (cb) {
        // Delete any orphan SellerChargebackCard already on the target
        // (rare; defends against a half-completed earlier transfer).
        await tx.sellerChargebackCard
          .delete({ where: { userId: targetUser.id } })
          .catch(() => null);
        await tx.sellerChargebackCard.update({
          where: { userId: app.user.id },
          data: { userId: targetUser.id },
        });
      }

      const bank = await tx.paymentCloudBankAccount.findUnique({
        where: { userId: app.user.id },
      });
      if (bank) {
        await tx.paymentCloudBankAccount
          .delete({ where: { userId: targetUser.id } })
          .catch(() => null);
        await tx.paymentCloudBankAccount.update({
          where: { userId: app.user.id },
          data: { userId: targetUser.id },
        });
      }
    });
  } else if (Object.keys(applicationFields).length > 0) {
    await prisma.sellerApplication.update({
      where: { id: app.id },
      data: applicationFields,
    });
  }

  await logAudit({
    actorId: me.id,
    action: transferReport ? "seller_application.transfer" : "seller_application.edit",
    targetKind: "seller_application",
    targetId: app.id,
    metadata: {
      fields: Object.keys(parsed.data),
      ...(transferReport ?? {}),
    } as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true, transfer: transferReport });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

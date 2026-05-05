import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { sendEmail, siteUrl } from "@/lib/email";

// Re-fire whichever notification email matches the application's
// current status. Common case: SendGrid bounced the first one because
// the sender wasn't verified yet; admin verifies, clicks Resend, and
// the seller actually gets the message this time.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const app = await prisma.sellerApplication.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!app) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!app.user?.email) {
    return NextResponse.json({ error: "no_user_email" }, { status: 400 });
  }

  let sent = false;
  if (app.status === "approved") {
    const signIn = `${siteUrl()}/sign-in?email=${encodeURIComponent(app.user.email)}&callbackUrl=${encodeURIComponent("/seller")}`;
    const seller = `${siteUrl()}/seller`;
    sent = await sendEmail({
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
        `<p style="color:#666;font-size:13px;">After signing in you'll land at ${seller}.</p>` +
        `<p>— Indie Comics Live</p>`,
    });
  } else if (app.status === "needs_revision") {
    const link = `${siteUrl()}/seller/apply`;
    sent = await sendEmail({
      to: app.user.email,
      subject: "Action needed on your Indie Comics Live seller application",
      text:
        `Hi ${app.user.name ?? ""},\n\n` +
        `Your seller application needs a few things updated before we can approve it.\n\n` +
        (app.reviewerNotes ? `Notes from the reviewer:\n${app.reviewerNotes}\n\n` : "") +
        `Open this link to update your application:\n${link}\n\n— Indie Comics Live`,
    });
  } else if (app.status === "rejected") {
    sent = await sendEmail({
      to: app.user.email,
      subject: "Your Indie Comics Live seller application",
      text:
        `Hi ${app.user.name ?? ""},\n\n` +
        `We're not able to move your seller application forward at this time.\n` +
        (app.rejectionReason ? `Reason: ${app.rejectionReason}\n` : "") +
        (app.reviewerNotes ? `\nNotes:\n${app.reviewerNotes}\n` : "") +
        `\n— Indie Comics Live`,
    });
  } else {
    return NextResponse.json(
      { error: "no_decision_yet", status: app.status },
      { status: 400 },
    );
  }

  await logAudit({
    actorId: me.id,
    action: "seller_application.resend_email",
    targetKind: "seller_application",
    targetId: app.id,
    metadata: { status: app.status, recipient: app.user.email, sent },
  });

  return NextResponse.json({ ok: sent, status: app.status });
}

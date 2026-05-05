import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { sendEmail, siteUrl } from "@/lib/email";
import { getActiveProcessor } from "@/lib/divinitycoin";

const Body = z.object({
  notify: z.boolean().optional(),
});

// POST /api/admin/seller-applications/[id]/migrate-processor
//
// Used when the platform flips its active payment processor (e.g.
// NMI → DivinityCoin). Existing seller applications still have a
// chargeback card vaulted under the OLD processor. This endpoint
// soft-deletes the old SellerChargebackCard row so the seller's next
// visit to /seller/apply step 4 collects a NEW card on the now-active
// processor. PCI rules don't allow us to silently move a vaulted card
// between processors; the seller has to re-enter.
//
// Optional `notify: true` triggers a SendGrid email asking them to do
// just that.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const app = await prisma.sellerApplication.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const target = await getActiveProcessor();

  const card = await prisma.sellerChargebackCard.findUnique({
    where: { userId: app.userId },
    select: { id: true, processor: true },
  });
  if (!card) {
    return NextResponse.json(
      { error: "no_card_on_file", target },
      { status: 404 },
    );
  }
  const fromProcessor = card.processor as unknown as "nmi" | "divinitycoin";
  if (fromProcessor === target) {
    return NextResponse.json(
      { error: "already_on_target_processor", target },
      { status: 400 },
    );
  }

  await prisma.sellerChargebackCard.delete({ where: { userId: app.userId } });

  await logAudit({
    actorId: me.id,
    action: "seller_application.migrate_processor",
    targetKind: "seller_application",
    targetId: app.id,
    metadata: {
      sellerUserId: app.userId,
      from: fromProcessor,
      to: target,
    },
  });

  let notified = false;
  if (parsed.data.notify && app.user?.email) {
    const link = `${siteUrl()}/seller/apply`;
    const friendlyTarget =
      target === "divinitycoin" ? "Divinity Payments" : "PaymentCloud";
    notified = await sendEmail({
      to: app.user.email,
      subject: "Action needed: re-add your chargeback card on Indie Comics Live",
      text:
        `Hi ${app.user.name ?? ""},\n\n` +
        `We've moved Indie Comics Live's payment processor to ${friendlyTarget}. ` +
        `For PCI compliance reasons we can't carry your chargeback card across — please ` +
        `add a new card on file:\n\n${link}\n\nIt's only the chargeback step (step 4) — your application data is saved.\n\n— Indie Comics Live`,
      html:
        `<p>Hi ${app.user.name ?? ""},</p>` +
        `<p>We've moved Indie Comics Live's payment processor to <strong>${friendlyTarget}</strong>. For PCI compliance reasons we can't carry your chargeback card across — please add a new card on file.</p>` +
        `<p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#ff3366;color:#0a0a0a;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;">Re-add my chargeback card</a></p>` +
        `<p style="color:#666;font-size:13px;">Your application data is saved — only the chargeback step (step 4) needs to be redone.</p>` +
        `<p>— Indie Comics Live</p>`,
    });
  }

  return NextResponse.json({
    ok: true,
    from: fromProcessor,
    to: target,
    notified,
  });
}

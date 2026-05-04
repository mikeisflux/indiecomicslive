import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { chargeOrder } from "@/lib/payments";
import {
  loadNmiConfig,
  refund as nmiRefund,
  voidTransaction,
} from "@/lib/nmi";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("retry_charge"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("refund_full"), reason: z.string().max(500).optional() }),
  z.object({
    action: z.literal("refund_partial"),
    amountCents: z.number().int().positive(),
    reason: z.string().max(500).optional(),
  }),
  z.object({ action: z.literal("void"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("mark_shipped"), reason: z.string().max(500).optional() }),
  z.object({
    action: z.literal("mark_delivered"),
    reason: z.string().max(500).optional(),
  }),
  z.object({ action: z.literal("cancel"), reason: z.string().max(500).optional() }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const action = parsed.data.action;

  if (action === "retry_charge") {
    const result = await chargeOrder(id);
    await logAudit({
      actorId: me.id,
      action: "order.retry_charge",
      targetKind: "order",
      targetId: id,
      metadata: { result, reason: parsed.data.reason },
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, transactionId: result.transactionId });
  }

  if (action === "refund_full" || action === "refund_partial") {
    if (!order.nmiTransactionId) {
      return NextResponse.json({ error: "no_transaction" }, { status: 400 });
    }
    const config = loadNmiConfig();
    if (!config)
      return NextResponse.json({ error: "nmi_not_configured" }, { status: 502 });

    const amount =
      action === "refund_full"
        ? order.amountCents / 100
        : parsed.data.amountCents / 100;
    const resp = await nmiRefund(config, order.nmiTransactionId, amount);
    if (resp.response !== "1") {
      await logAudit({
        actorId: me.id,
        action: "order.refund_failed",
        targetKind: "order",
        targetId: id,
        metadata: { responsetext: resp.responsetext, action, reason: parsed.data.reason },
      });
      return NextResponse.json(
        { error: resp.responsetext || "refund_declined" },
        { status: 400 },
      );
    }
    const isFull = action === "refund_full";
    await prisma.order.update({
      where: { id },
      data: isFull ? { status: "refunded" } : {},
    });
    await logAudit({
      actorId: me.id,
      action: isFull ? "order.refund_full" : "order.refund_partial",
      targetKind: "order",
      targetId: id,
      metadata: { amount, reason: parsed.data.reason },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "void") {
    if (!order.nmiTransactionId) {
      return NextResponse.json({ error: "no_transaction" }, { status: 400 });
    }
    const config = loadNmiConfig();
    if (!config)
      return NextResponse.json({ error: "nmi_not_configured" }, { status: 502 });
    const resp = await voidTransaction(config, order.nmiTransactionId);
    if (resp.response !== "1") {
      return NextResponse.json(
        { error: resp.responsetext || "void_failed" },
        { status: 400 },
      );
    }
    await prisma.order.update({
      where: { id },
      data: { status: "cancelled" },
    });
    await logAudit({
      actorId: me.id,
      action: "order.void",
      targetKind: "order",
      targetId: id,
      metadata: { reason: parsed.data.reason },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_shipped") {
    await prisma.order.update({ where: { id }, data: { status: "shipped" } });
    await logAudit({
      actorId: me.id,
      action: "order.mark_shipped",
      targetKind: "order",
      targetId: id,
      metadata: { reason: parsed.data.reason },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_delivered") {
    await prisma.order.update({
      where: { id },
      data: { status: "delivered" },
    });
    await logAudit({
      actorId: me.id,
      action: "order.mark_delivered",
      targetKind: "order",
      targetId: id,
      metadata: { reason: parsed.data.reason },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    await prisma.order.update({
      where: { id },
      data: { status: "cancelled" },
    });
    await logAudit({
      actorId: me.id,
      action: "order.cancel",
      targetKind: "order",
      targetId: id,
      metadata: { reason: parsed.data.reason },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

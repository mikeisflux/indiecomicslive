import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/support/[id] — fetch a ticket + thread. Buyer-side or
// admin can read. POST appends a reply.
async function authed(ticketId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const t = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, userId: true, status: true },
  });
  if (!t) return null;
  if (t.userId === session.user.id) {
    return { userId: session.user.id, isAdmin: false, ticket: t };
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role === "admin" || me?.role === "super_admin") {
    return { userId: session.user.id, isAdmin: true, ticket: t };
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await authed(id);
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const t = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, handle: true } } },
      },
      user: { select: { id: true, name: true, handle: true, email: true } },
      order: {
        select: {
          id: true,
          amountCents: true,
          status: true,
          lot: { select: { title: true } },
        },
      },
    },
  });
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    id: t.id,
    subject: t.subject,
    status: t.status,
    user: t.user,
    order: t.order,
    messages: t.messages.map((m) => ({
      id: m.id,
      body: m.body,
      fromAdmin: m.fromAdmin,
      author: m.user.name ?? (m.user.handle ? `@${m.user.handle}` : "user"),
      createdAt: m.createdAt,
    })),
    isAdmin: ctx.isAdmin,
  });
}

const Reply = z.object({
  body: z.string().min(1).max(5000),
  status: z
    .enum(["open", "awaiting_user", "resolved", "closed"])
    .optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await authed(id);
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Reply.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  await prisma.supportMessage.create({
    data: {
      ticketId: id,
      userId: ctx.userId,
      body: parsed.data.body,
      fromAdmin: ctx.isAdmin,
    },
  });
  // Status transitions: admin reply moves to awaiting_user, user reply
  // moves to open. Admin can also force a status via the body.
  const nextStatus =
    parsed.data.status ??
    (ctx.isAdmin ? "awaiting_user" : "open");
  await prisma.supportTicket.update({
    where: { id },
    data: {
      status: nextStatus,
      ...(nextStatus === "resolved" || nextStatus === "closed"
        ? { resolvedAt: new Date(), resolvedById: ctx.userId }
        : { resolvedAt: null, resolvedById: null }),
    },
  });
  return NextResponse.json({ ok: true });
}

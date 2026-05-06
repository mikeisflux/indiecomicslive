import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// PATCH /api/seller/shows/[id]
//
// Partial update of a show by its owner (or admin). Right now exposed
// fields: title, description, scheduledFor, chatOverlayEnabled. Add
// more here as the seller-hub Settings tab grows.
const Body = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable(),
  chatOverlayEnabled: z.boolean().optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  trailerUrl: z.string().url().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const show = await prisma.show.findUnique({ where: { id } });
  if (!show) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const isOwner = show.sellerId === session.user.id;
  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.scheduledFor !== undefined) {
    data.scheduledFor = parsed.data.scheduledFor
      ? new Date(parsed.data.scheduledFor)
      : null;
  }
  if (parsed.data.chatOverlayEnabled !== undefined) {
    data.chatOverlayEnabled = parsed.data.chatOverlayEnabled;
  }
  if (parsed.data.coverImageUrl !== undefined) {
    data.coverImageUrl = parsed.data.coverImageUrl;
  }
  if (parsed.data.trailerUrl !== undefined) {
    data.trailerUrl = parsed.data.trailerUrl;
  }

  const updated = await prisma.show.update({ where: { id }, data });

  // Push the chat-overlay flag flip to live viewers.
  if (parsed.data.chatOverlayEnabled !== undefined) {
    const wsPort = process.env.WS_PORT ?? "3001";
    const wsSecret = process.env.WS_INTERNAL_SECRET;
    if (wsSecret) {
      fetch(`http://127.0.0.1:${wsPort}/internal/broadcast`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-broadcast-token": wsSecret,
        },
        body: JSON.stringify({
          showId: id,
          msg: {
            type: "chat_overlay",
            enabled: parsed.data.chatOverlayEnabled,
          },
        }),
      }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true, show: updated });
}

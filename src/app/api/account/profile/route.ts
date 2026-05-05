import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().max(120).nullable().optional(),
  handle: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/, "lowercase letters, numbers, underscore")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  image: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  bio: z.string().max(500).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  websites: z.array(z.string().url()).max(8).optional(),
});

const reservedHandles = new Set([
  "admin",
  "support",
  "help",
  "api",
  "www",
  "indiecomicslive",
  "moderator",
  "staff",
]);

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.image !== undefined) data.image = parsed.data.image;
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
  if (parsed.data.location !== undefined) data.location = parsed.data.location;
  if (parsed.data.websites !== undefined) data.websites = parsed.data.websites;

  if (parsed.data.handle !== undefined) {
    const h = parsed.data.handle;
    if (h && reservedHandles.has(h)) {
      return NextResponse.json(
        { error: "handle_reserved", message: "That handle is reserved." },
        { status: 400 },
      );
    }
    if (h) {
      const existing = await prisma.user.findUnique({ where: { handle: h } });
      if (existing && existing.id !== session.user.id) {
        return NextResponse.json(
          { error: "handle_taken", message: "Another account is already using that handle." },
          { status: 409 },
        );
      }
    }
    data.handle = h;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  return NextResponse.json({ ok: true });
}

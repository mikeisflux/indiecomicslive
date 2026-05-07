import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

const Body = z.object({
  handle: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/, "lowercase letters, numbers, underscore"),
});

const reserved = new Set([
  "admin",
  "support",
  "help",
  "api",
  "www",
  "indiecomicslive",
  "moderator",
  "staff",
]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid_body" },
      { status: 400 },
    );
  }

  const handle = parsed.data.handle;
  if (reserved.has(handle)) {
    return NextResponse.json({ error: "handle_reserved" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { handle } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "handle_taken" }, { status: 409 });
  }

  // TOCTOU: between the findUnique above and the update, another user
  // can claim the same handle. Catch the unique-violation and return
  // 409 so the client can retry with a different one.
  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { handle },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ error: "handle_taken" }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, handle });
}

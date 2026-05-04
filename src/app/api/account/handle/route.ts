import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  await prisma.user.update({
    where: { id: session.user.id },
    data: { handle },
  });

  return NextResponse.json({ ok: true, handle });
}

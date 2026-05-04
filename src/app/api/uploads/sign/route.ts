import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createSignedUpload, r2Key } from "@/lib/r2";

const Body = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().regex(/^(image|video)\/[a-z0-9.+-]+$/),
  scope: z.enum(["lot", "show", "avatar"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const key = r2Key([
    parsed.data.scope,
    session.user.id,
    `${Date.now()}_${parsed.data.filename}`,
  ]);

  const signed = await createSignedUpload({
    key,
    contentType: parsed.data.contentType,
  });

  return NextResponse.json(signed);
}

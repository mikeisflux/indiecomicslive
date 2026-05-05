import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

interface AddressBody {
  name?: string;
  company?: string;
  phone?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

function clean(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as AddressBody | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const addr = {
    name: clean(body.name),
    company: clean(body.company),
    phone: clean(body.phone),
    street1: clean(body.street1),
    street2: clean(body.street2),
    city: clean(body.city),
    state: clean(body.state),
    postalCode: clean(body.postalCode),
    country: (clean(body.country) ?? "US").slice(0, 2).toUpperCase(),
  };

  const required: (keyof typeof addr)[] = [
    "name",
    "street1",
    "city",
    "state",
    "postalCode",
    "country",
  ];
  for (const k of required) {
    if (!addr[k]) {
      return NextResponse.json(
        { error: "missing_field", field: k, message: `${k} is required` },
        { status: 400 },
      );
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { shipFromAddress: addr },
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { shipFromAddress: true },
  });
  return NextResponse.json({ address: me?.shipFromAddress ?? null });
}

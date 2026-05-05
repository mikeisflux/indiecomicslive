import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

export type AdminRole = "admin" | "super_admin";

export type AdminUser = {
  id: string;
  email: string | null;
  handle: string | null;
  name: string | null;
  role: AdminRole;
};

// Use in any /admin server component or API route handler. Redirects
// unauthenticated users to /staff-sign-in (NOT the public magic-link
// /sign-in) and non-admin users to /. Throws nothing — relies on
// Next's redirect() to break execution.
export async function requireAdmin(returnTo = "/admin"): Promise<AdminUser> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/staff-sign-in?next=${encodeURIComponent(returnTo)}`);
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, handle: true, name: true, role: true },
  });
  if (!me) redirect("/staff-sign-in");
  if (me.role !== "admin" && me.role !== "super_admin") {
    redirect("/");
  }
  return me as AdminUser;
}

// API-route variant. Returns null if the caller isn't admin so the
// route can decide its own response shape.
export async function getAdminUserOrNull(): Promise<AdminUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, handle: true, name: true, role: true },
  });
  if (!me) return null;
  if (me.role !== "admin" && me.role !== "super_admin") return null;
  return me as AdminUser;
}

export async function logAudit(opts: {
  actorId: string;
  action: string;
  targetKind?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: opts.actorId,
      action: opts.action,
      targetKind: opts.targetKind,
      targetId: opts.targetId,
      metadata: opts.metadata
        ? (opts.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      ip: opts.ip ?? null,
    },
  });
}

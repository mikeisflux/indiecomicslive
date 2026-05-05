import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Users — Admin" };

const ROLES: (UserRole | "all")[] = [
  "all",
  "viewer",
  "seller",
  "admin",
  "super_admin",
];

export default async function UsersList({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    locked?: string;
    deleted?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const role = (sp.role ?? "all") as UserRole | "all";
  const locked = sp.locked === "1";
  const deleted = sp.deleted === "1";

  const users = await prisma.user.findMany({
    where: {
      ...(role !== "all" ? { role } : {}),
      ...(locked ? { lockedAt: { not: null } } : {}),
      ...(deleted ? {} : { accountDeletedAt: null, deletedAt: null }),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { handle: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      handle: true,
      name: true,
      role: true,
      createdAt: true,
      lockedAt: true,
      bannedAt: true,
      chatBannedAt: true,
      accountDeletedAt: true,
      deletedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email / handle / name"
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm"
          />
          <select
            name="role"
            defaultValue={role}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? "All roles" : r}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              name="locked"
              value="1"
              defaultChecked={locked}
            />
            Locked only
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              name="deleted"
              value="1"
              defaultChecked={deleted}
            />
            Include deleted
          </label>
          <button className="rounded-full border border-white/10 px-3 py-1.5 text-xs">
            Apply
          </button>
        </form>
      </header>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="block text-paper"
                  >
                    <p>{u.email}</p>
                    <p className="text-xs text-paper/50">
                      @{u.handle ?? "—"} · {u.name ?? "(no display name)"}
                    </p>
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs">{u.role}</td>
                <td className="px-3 py-3 text-xs">
                  <Tags
                    locked={!!u.lockedAt}
                    banned={!!u.bannedAt}
                    chatBanned={!!u.chatBannedAt}
                    deleted={!!u.deletedAt || !!u.accountDeletedAt}
                  />
                </td>
                <td className="px-3 py-3 text-xs text-paper/60">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tags({
  locked,
  banned,
  chatBanned,
  deleted,
}: {
  locked: boolean;
  banned: boolean;
  chatBanned: boolean;
  deleted: boolean;
}) {
  if (!locked && !banned && !chatBanned && !deleted) {
    return <span className="text-emerald-300/80">active</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {deleted && (
        <span className="rounded-full bg-white/10 px-2 py-0.5">deleted</span>
      )}
      {banned && (
        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-300">
          banned
        </span>
      )}
      {locked && (
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">
          locked
        </span>
      )}
      {chatBanned && (
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">
          chat-ban
        </span>
      )}
    </div>
  );
}

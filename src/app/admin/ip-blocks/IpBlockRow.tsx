"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  id: string;
  ipAddress: string;
  userId: string | null;
  reason: string | null;
  createdAt: string;
  expiresAt: string | null;
};

export default function IpBlockRow({
  id,
  ipAddress,
  userId,
  reason,
  createdAt,
  expiresAt,
}: Props) {
  const router = useRouter();
  async function remove() {
    if (!confirm(`Remove block on ${ipAddress}?`)) return;
    await fetch(`/api/admin/ip-blocks/${id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <tr className="hover:bg-white/[0.02]">
      <td className="px-3 py-2 font-mono text-xs">{ipAddress}</td>
      <td className="px-3 py-2 text-xs">
        {userId ? (
          <Link
            href={`/admin/users/${userId}`}
            className="text-accent hover:underline"
          >
            {userId.slice(0, 8)}…
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-xs">{reason ?? "—"}</td>
      <td className="px-3 py-2 text-xs text-paper/60">
        {new Date(createdAt).toLocaleString()}
      </td>
      <td className="px-3 py-2 text-xs text-paper/60">
        {expiresAt ? new Date(expiresAt).toLocaleString() : "never"}
      </td>
      <td className="px-3 py-2 text-xs">
        <button
          onClick={remove}
          className="rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1 text-red-300"
        >
          Unblock
        </button>
      </td>
    </tr>
  );
}

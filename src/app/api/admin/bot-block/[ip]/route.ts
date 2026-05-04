import { NextResponse } from "next/server";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { unblockIP } from "@/lib/bot-blocker";

// Manual unblock from /admin/bot-block. Removes the BlockedIP row +
// invalidates the in-memory cache. The kernel iptables rule is removed
// by the next botblock-sync run (within 5 minutes).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ ip: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { ip } = await params;
  const decoded = decodeURIComponent(ip);
  const ok = await unblockIP(decoded);

  await logAudit({
    actorId: me.id,
    action: "bot_block.unblock",
    targetKind: "ip",
    targetId: decoded,
    metadata: { ok },
  });

  return NextResponse.json({ ok });
}

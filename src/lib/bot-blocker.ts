// Bot Blocker — DB-backed IP blocking with violation tracking and
// kernel-firewall integration via /tmp/botblock-pending.
// Ported from indiecrowdfund_2.0/src/lib/bot-blocker.ts and adapted
// to the indiecomicslive Prisma client + console logger.
//
// Pairs with the helpfulapps/botblock-firewall/ scripts. The watcher
// service reads /tmp/botblock-pending and adds iptables DROP rules so
// repeat offenders never reach the Next.js process again.

import { appendFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";

// Violations within SUSPICIOUS_WINDOW_MS that escalate to a BlockedIP.
const BOT_BLOCK_THRESHOLD = 3;
const SUSPICIOUS_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const PENDING_FILE = "/tmp/botblock-pending";

// In-memory cache so we don't hit Postgres on every request.
const blockedIPCache = new Map<
  string,
  { expiresAt: Date; checkedAt: number }
>();

function isLoopback(ip: string) {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip === "localhost"
  );
}

export async function isIPBlocked(ip: string | null | undefined): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  if (isLoopback(ip)) return false;

  const now = Date.now();
  const cached = blockedIPCache.get(ip);
  if (cached) {
    if (cached.expiresAt.getTime() > now) return true;
    blockedIPCache.delete(ip);
  }

  try {
    const blocked = await prisma.blockedIP.findUnique({
      where: { ipAddress: ip },
      select: { expiresAt: true },
    });
    if (blocked && blocked.expiresAt.getTime() > now) {
      blockedIPCache.set(ip, { expiresAt: blocked.expiresAt, checkedAt: now });
      return true;
    }
    if (blocked) {
      // Async best-effort cleanup — deleteMany so concurrent calls
      // don't throw P2025.
      prisma.blockedIP.deleteMany({ where: { ipAddress: ip } }).catch(() => {});
    }
    return false;
  } catch (err) {
    console.error("[bot-blocker] DB error in isIPBlocked", err);
    return false;
  }
}

export type SuspiciousMeta = {
  actionId?: string;
  path?: string;
  userAgent?: string;
};

export async function recordSuspiciousActivity(
  ip: string | null | undefined,
  reason: string,
  metadata?: SuspiciousMeta,
): Promise<boolean> {
  if (!ip || ip === "unknown" || isLoopback(ip)) return false;

  try {
    await prisma.suspiciousActivity.create({
      data: {
        ipAddress: ip,
        reason,
        actionId: metadata?.actionId,
        path: metadata?.path,
        userAgent: metadata?.userAgent,
      },
    });

    const windowStart = new Date(Date.now() - SUSPICIOUS_WINDOW_MS);
    const recentCount = await prisma.suspiciousActivity.count({
      where: { ipAddress: ip, createdAt: { gte: windowStart } },
    });

    console.info(
      `[bot-blocker] suspicious from ${ip}: ${reason} (${recentCount} in last hour)`,
    );

    if (recentCount >= BOT_BLOCK_THRESHOLD) {
      return await blockIP(ip, reason, metadata);
    }
    return false;
  } catch (err) {
    console.error("[bot-blocker] DB error in recordSuspiciousActivity", err);
    return false;
  }
}

export async function blockIP(
  ip: string,
  reason: string,
  metadata?: SuspiciousMeta,
): Promise<boolean> {
  if (!ip || ip === "unknown" || isLoopback(ip)) return false;

  const expiresAt = new Date(Date.now() + BLOCK_DURATION_MS);

  try {
    await prisma.blockedIP.upsert({
      where: { ipAddress: ip },
      create: {
        ipAddress: ip,
        reason,
        expiresAt,
        lastUserAgent: metadata?.userAgent,
        lastPath: metadata?.path,
        lastActionId: metadata?.actionId,
      },
      update: {
        reason,
        expiresAt,
        violationCount: { increment: 1 },
        lastUserAgent: metadata?.userAgent,
        lastPath: metadata?.path,
        lastActionId: metadata?.actionId,
      },
    });

    blockedIPCache.set(ip, { expiresAt, checkedAt: Date.now() });

    // Tell the watcher to add the kernel-firewall rule. Non-fatal if
    // the file isn't writable (the cron sync is the safety net).
    try {
      await appendFile(PENDING_FILE, `${ip}\n`);
    } catch (err) {
      console.warn(`[bot-blocker] could not append ${ip} to ${PENDING_FILE}`);
    }

    console.info(
      `[bot-blocker] BLOCKED ${ip} — ${reason} — expires ${expiresAt.toISOString()}`,
    );
    return true;
  } catch (err) {
    console.error("[bot-blocker] DB error in blockIP", err);
    return false;
  }
}

export async function unblockIP(ip: string): Promise<boolean> {
  try {
    await prisma.blockedIP.deleteMany({ where: { ipAddress: ip } });
    blockedIPCache.delete(ip);
    console.info(`[bot-blocker] UNBLOCKED ${ip}`);
    return true;
  } catch (err) {
    console.error("[bot-blocker] DB error in unblockIP", err);
    return false;
  }
}

export async function getBlockedIPs(limit = 200) {
  return await prisma.blockedIP.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { blockedAt: "desc" },
    take: limit,
  });
}

export async function getRecentSuspiciousActivity(limit = 100) {
  return await prisma.suspiciousActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function cleanupExpiredData() {
  try {
    const now = new Date();
    const oldActivityCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [delBlocks, delActivity] = await Promise.all([
      prisma.blockedIP.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.suspiciousActivity.deleteMany({
        where: { createdAt: { lt: oldActivityCutoff } },
      }),
    ]);

    if (delBlocks.count > 0 || delActivity.count > 0) {
      console.info(
        `[bot-blocker] cleanup: removed ${delBlocks.count} expired blocks, ${delActivity.count} old activity logs`,
      );
    }

    for (const [ip, data] of blockedIPCache.entries()) {
      if (data.expiresAt.getTime() < now.getTime()) {
        blockedIPCache.delete(ip);
      }
    }
  } catch (err) {
    console.error("[bot-blocker] cleanup error", err);
  }
}

// Next.js server-action ids are 40-char hex strings. Anything else
// hitting an action endpoint is almost certainly an exploit probe.
export function isValidServerActionId(actionId: string): boolean {
  if (!actionId || actionId.length < 10) return false;
  return /^[a-f0-9]+$/i.test(actionId);
}

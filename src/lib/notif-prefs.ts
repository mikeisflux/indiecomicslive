import { prisma } from "@/lib/prisma";

// Per-user, per-kind, per-channel notification preference resolver.
// Defaults to opted-in for every kind/channel; missing entries are
// treated as true. The marketing email kill-switch
// (User.emailUnsubscribedAt) overrides email preferences globally.

export type NotifKind =
  | "outbid"
  | "show_live"
  | "show_reminder"
  | "saved_search"
  | "giveaway_won"
  | "seller_broadcast"
  | "order_update"
  | "dispute_update";

export type NotifChannel = "push" | "email" | "sms";

export const ALL_KINDS: NotifKind[] = [
  "outbid",
  "show_live",
  "show_reminder",
  "saved_search",
  "giveaway_won",
  "seller_broadcast",
  "order_update",
  "dispute_update",
];

export const KIND_LABELS: Record<NotifKind, string> = {
  outbid: "You've been outbid",
  show_live: "A seller you follow goes live",
  show_reminder: "Show going live soon",
  saved_search: "New matches for a saved search",
  giveaway_won: "You won a giveaway",
  seller_broadcast: "Seller announcements",
  order_update: "Order shipped / delivered",
  dispute_update: "Dispute updates",
};

type Prefs = Partial<
  Record<NotifKind, Partial<Record<NotifChannel, boolean>>>
>;

export async function loadPrefs(userId: string): Promise<{
  prefs: Prefs;
  emailUnsubscribedAt: Date | null;
  smsOptInAt: Date | null;
  phoneE164: string | null;
}> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notifPrefs: true,
      emailUnsubscribedAt: true,
      smsOptInAt: true,
      phoneE164: true,
    },
  });
  return {
    prefs: ((u?.notifPrefs ?? {}) as Prefs) || {},
    emailUnsubscribedAt: u?.emailUnsubscribedAt ?? null,
    smsOptInAt: u?.smsOptInAt ?? null,
    phoneE164: u?.phoneE164 ?? null,
  };
}

export async function shouldNotify(
  userId: string,
  kind: NotifKind,
  channel: NotifChannel,
): Promise<boolean> {
  const { prefs, emailUnsubscribedAt, smsOptInAt } = await loadPrefs(userId);
  if (channel === "email" && emailUnsubscribedAt) return false;
  if (channel === "sms" && !smsOptInAt) return false;
  const k = prefs[kind];
  if (!k) return true;
  const v = k[channel];
  return v === undefined ? true : !!v;
}

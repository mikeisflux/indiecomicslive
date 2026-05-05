import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";

const NAV: { href: string; label: string }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/seller-applications", label: "Seller applications" },
  { href: "/admin/sellers", label: "Sellers" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/shows", label: "Shows" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/chargebacks", label: "Chargebacks" },
  { href: "/admin/ip-blocks", label: "IP blocklist" },
  { href: "/admin/bot-block", label: "Bot blocker" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/settings", label: "Settings" },
];

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireAdmin();

  return (
    <div className="min-h-dvh bg-ink">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-ink/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="font-bold tracking-tight">
            Indie Comics <span className="text-accent">Live</span> · Admin
          </Link>
          <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
            {me.role.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="text-paper/60 hover:text-paper">
            View site
          </Link>
          <span className="text-paper/30">·</span>
          <span className="text-paper/60">{me.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut();
              redirect("/sign-in");
            }}
          >
            <button className="rounded-full border border-white/10 px-3 py-1 text-xs">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-[64px] md:self-start">
          <nav className="space-y-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="block rounded-lg px-3 py-2 text-paper/70 hover:bg-white/5 hover:text-paper"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

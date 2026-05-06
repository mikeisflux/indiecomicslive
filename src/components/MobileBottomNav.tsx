"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mobile-only bottom nav. Hidden inside /admin, the live show page,
// and the seller hub (which need full-bleed verticals). Always renders
// above safe-area-inset-bottom on iOS.
const HIDE_ON = [
  /^\/admin/,
  /^\/s\//,
  /^\/seller\//,
  /^\/sign-in$/,
  /^\/sign-up$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/staff-sign-in$/,
];

const TABS: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Live", icon: "◉" },
  { href: "/search", label: "Browse", icon: "⌕" },
  { href: "/feed", label: "Feed", icon: "✦" },
  { href: "/account/notifications", label: "Alerts", icon: "🔔" },
  { href: "/account", label: "Me", icon: "◌" },
];

export default function MobileBottomNav() {
  const path = usePathname() ?? "/";
  if (HIDE_ON.some((re) => re.test(path))) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map((t) => {
          const active =
            t.href === "/"
              ? path === "/"
              : path === t.href || path.startsWith(`${t.href}/`);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition ${
                  active
                    ? "text-accent"
                    : "text-paper/55 hover:text-paper"
                }`}
              >
                <span
                  className={`text-lg leading-none ${
                    active ? "icl-pulse-dot rounded-full p-0.5" : ""
                  }`}
                >
                  {t.icon}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

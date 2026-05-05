"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export interface RecentOrder {
  id: string;
  title: string;
  status: string;
  thumbnailUrl: string | null;
}

export interface RecentShow {
  id: string;
  title: string;
  status: string;
  coverImageUrl: string | null;
}

interface Props {
  user: {
    email: string | null;
    name: string | null;
    image: string | null;
    handle: string | null;
  };
  isApprovedSeller: boolean;
  recentOrders: RecentOrder[];
  recentShows: RecentShow[];
  onSignOut: () => void | Promise<void>;
}

function initials(s: string | null | undefined): string {
  if (!s) return "?";
  const parts = s.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || s[0]?.toUpperCase() || "?";
}

export default function AccountMenu({
  user,
  isApprovedSeller,
  recentOrders,
  recentShows,
  onSignOut,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const display = user.name || user.handle || user.email || "Account";
  const close = () => setOpen(false);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 text-sm font-bold transition hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={display}
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-paper/80">{initials(display)}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/95 shadow-2xl backdrop-blur ${
            isApprovedSeller ? "w-[760px]" : "w-[520px]"
          } max-w-[95vw]`}
        >
          <div
            className={`grid ${
              isApprovedSeller ? "grid-cols-3" : "grid-cols-2"
            } gap-0`}
          >
            {/* LEFT — YOUR ACCOUNT links */}
            <div className="border-r border-white/10 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-paper/50">
                Your account
              </p>
              <ul className="space-y-1 text-sm">
                <MenuLink href="/account" onClick={close}>
                  Profile
                </MenuLink>
                <MenuLink href="/account/payment-method" onClick={close}>
                  Payment method
                </MenuLink>
                {isApprovedSeller && (
                  <MenuLink href="/seller/ship-from" onClick={close}>
                    Return address
                  </MenuLink>
                )}
                <MenuLink href="/account/addresses" onClick={close}>
                  Shipping addresses
                </MenuLink>
                <MenuLink href="/account/notifications" onClick={close}>
                  Notification settings
                </MenuLink>
              </ul>
            </div>

            {/* MIDDLE — Buyer dashboard */}
            <div className="border-r border-white/10 p-4">
              <Link
                href="/orders"
                onClick={close}
                className="mb-2 flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-paper/70 hover:bg-white/5 hover:text-paper"
              >
                <span>Buyer dashboard</span>
                <span aria-hidden>›</span>
              </Link>
              {recentOrders.length === 0 ? (
                <p className="px-2 py-1 text-xs text-paper/40">
                  No orders yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/orders/${o.id}`}
                        onClick={close}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                      >
                        <Thumb src={o.thumbnailUrl} alt={o.title} />
                        <span className="line-clamp-1 flex-1">{o.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* RIGHT — Seller dashboard (only when approved) */}
            {isApprovedSeller && (
              <div className="p-4">
                <Link
                  href="/seller"
                  onClick={close}
                  className="mb-2 flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-paper/70 hover:bg-white/5 hover:text-paper"
                >
                  <span>Seller dashboard</span>
                  <span aria-hidden>›</span>
                </Link>
                {recentShows.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-paper/40">
                    No shows yet.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {recentShows.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/seller/${s.id}`}
                          onClick={close}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                        >
                          <Thumb src={s.coverImageUrl} alt={s.title} />
                          <span className="line-clamp-1 flex-1">
                            {s.title}
                          </span>
                          {s.status !== "live" && (
                            <span className="text-[10px] uppercase tracking-widest text-paper/40">
                              {s.status}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/seller#new"
                  onClick={close}
                  className="mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-paper/70 hover:bg-white/5"
                >
                  <span className="w-5 text-center">+</span>
                  New show
                </Link>
              </div>
            )}
          </div>

          <div className="border-t border-white/10">
            <form action={onSignOut as () => Promise<void>}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-paper/80 hover:bg-white/5"
                role="menuitem"
              >
                <span className="w-5 text-center">↩</span>
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="block rounded-md px-2 py-1.5 text-paper/80 hover:bg-white/5 hover:text-paper"
      >
        {children}
      </Link>
    </li>
  );
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <span className="block h-8 w-8 shrink-0 rounded-md border border-white/10 bg-white/5" />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={32}
      height={32}
      className="h-8 w-8 shrink-0 rounded-md object-cover"
    />
  );
}

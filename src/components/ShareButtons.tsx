"use client";

import { useEffect, useRef, useState } from "react";

// Standard social-share buttons. On mobile we hand off to
// navigator.share (the native iOS/Android sheet); on desktop we open
// a popover with platform-specific intent URLs. Each platform's URL
// just opens a new tab — the user's existing logged-in session in
// X / Facebook / Reddit / etc. handles the actual post-compose, so
// no OAuth on our side. We pre-fill the URL + a brief tagline.

const SITE_FALLBACK = "https://indiecomicslive.com";

type Target = {
  name: string;
  url: (link: string, text: string) => string;
  icon: React.ReactNode;
  tone: string;
};

function svg(d: string) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="h-4 w-4"
    >
      <path d={d} />
    </svg>
  );
}

const X_ICON = svg(
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z",
);
const FB_ICON = svg(
  "M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.14 8.44 9.94v-7.03H7.9v-2.91h2.54v-2.2c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.45 2.91h-2.33V22c4.78-.8 8.43-4.94 8.43-9.94Z",
);
const REDDIT_ICON = svg(
  "M22 12.14a2.14 2.14 0 0 0-3.62-1.55 10.5 10.5 0 0 0-5.7-1.81l1-4.5 3.13.7a1.5 1.5 0 1 0 .14-.93l-3.5-.78a.5.5 0 0 0-.59.38l-1.1 5.13a10.6 10.6 0 0 0-5.78 1.8 2.14 2.14 0 1 0-2.36 3.5A4.6 4.6 0 0 0 3.5 15c0 3.6 4.04 6.5 9 6.5s9-2.9 9-6.5a4.55 4.55 0 0 0-.07-.79A2.14 2.14 0 0 0 22 12.14Zm-15 1.36a1.5 1.5 0 1 1 1.5 1.5 1.5 1.5 0 0 1-1.5-1.5Zm8.69 4.36a5.5 5.5 0 0 1-3.69 1.14 5.5 5.5 0 0 1-3.69-1.14.5.5 0 1 1 .68-.74A4.5 4.5 0 0 0 12 18a4.5 4.5 0 0 0 3.01-.88.5.5 0 0 1 .68.74ZM15 15a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 15 15Z",
);
const LI_ICON = svg(
  "M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.86-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.91 1.65-1.86 3.4-1.86 3.63 0 4.3 2.39 4.3 5.49v6.26ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z",
);
const WA_ICON = svg(
  "M17.47 14.38c-.27-.13-1.6-.79-1.85-.88-.25-.09-.43-.13-.6.13-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.18-1.34-.81-.72-1.35-1.62-1.51-1.89-.16-.27-.02-.42.12-.55.12-.12.27-.32.4-.48.13-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.13-.6-1.45-.82-1.99-.21-.52-.43-.45-.6-.46-.16 0-.34-.01-.52-.01-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27 0 1.34.97 2.63 1.11 2.81.13.18 1.92 2.93 4.66 4.11.65.28 1.16.45 1.55.58.65.21 1.24.18 1.71.11.52-.08 1.6-.65 1.83-1.29.23-.63.23-1.18.16-1.29-.07-.11-.25-.18-.52-.32ZM12.06 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.34-.2-3.56.94.95-3.47-.22-.36A9.42 9.42 0 0 1 21.5 12.05a9.43 9.43 0 0 1-9.44 9.45ZM20.52 3.5A11.4 11.4 0 0 0 12.06 0a11.4 11.4 0 0 0-9.91 17.06L0 24l7.07-1.86a11.4 11.4 0 0 0 4.99 1.27h.01A11.4 11.4 0 0 0 23.5 12.06a11.4 11.4 0 0 0-3.36-8.06Z",
);
const TG_ICON = svg(
  "M9.78 15.27 9.4 20.6c.55 0 .79-.24 1.08-.52l2.6-2.49 5.39 3.95c.99.55 1.7.26 1.96-.92l3.55-16.65v-.01c.32-1.45-.52-2.02-1.48-1.66L1.04 9.81c-1.43.55-1.41 1.34-.24 1.7l5.34 1.66 12.4-7.81c.58-.39 1.12-.18.68.21",
);
const COPY_ICON = svg(
  "M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z",
);

const TARGETS: Target[] = [
  {
    name: "X",
    url: (link, text) =>
      `https://x.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
    icon: X_ICON,
    tone: "hover:text-paper",
  },
  {
    name: "Facebook",
    url: (link) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    icon: FB_ICON,
    tone: "hover:text-[#1877F2]",
  },
  {
    name: "Reddit",
    url: (link, text) =>
      `https://reddit.com/submit?url=${encodeURIComponent(link)}&title=${encodeURIComponent(text)}`,
    icon: REDDIT_ICON,
    tone: "hover:text-[#FF4500]",
  },
  {
    name: "LinkedIn",
    url: (link) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
    icon: LI_ICON,
    tone: "hover:text-[#0A66C2]",
  },
  {
    name: "WhatsApp",
    url: (link, text) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`,
    icon: WA_ICON,
    tone: "hover:text-[#25D366]",
  },
  {
    name: "Telegram",
    url: (link, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
    icon: TG_ICON,
    tone: "hover:text-[#26A5E4]",
  },
];

export default function ShareButtons() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const link =
    typeof window !== "undefined"
      ? window.location.origin
      : SITE_FALLBACK;
  const text =
    "Live auctions for indie comics, art books, and trading cards — sub-second WebRTC bidding, sellers keep more.";

  function openShare() {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      navigator
        .share({ url: link, title: "Indie Comics Live", text })
        .catch(() => {
          setOpen(true);
        });
      return;
    }
    setOpen((v) => !v);
  }

  function shareTo(t: Target) {
    window.open(
      t.url(link, text),
      "_blank",
      "noopener,noreferrer,width=600,height=560",
    );
    setOpen(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 900);
    } catch {
      /* swallow */
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={openShare}
        aria-label="Share Indie Comics Live"
        className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-paper/70 transition hover:border-accent/60 hover:text-accent"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
          className="h-4 w-4"
        >
          <path d="M18 8a3 3 0 1 0-2.83-2H15a3 3 0 0 0-.17 1L9 10.6a3 3 0 1 0 0 2.8l5.83 3.6a3 3 0 1 0 .83-1.7L9.83 11.7a3 3 0 0 0 0-3.4l5.83-3.6A3 3 0 0 0 18 8Z" />
        </svg>
      </button>

      {open && (
        <div className="icl-glass absolute right-0 z-30 mt-2 w-56 rounded-xl p-1 shadow-2xl">
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-paper/40">
            Share Indie Comics Live
          </p>
          <ul className="space-y-0.5">
            {TARGETS.map((t) => (
              <li key={t.name}>
                <button
                  type="button"
                  onClick={() => shareTo(t)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-paper/80 transition hover:bg-white/5 ${t.tone}`}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-white/5">
                    {t.icon}
                  </span>
                  {t.name}
                </button>
              </li>
            ))}
            <li className="border-t border-white/5 pt-1">
              <button
                type="button"
                onClick={copy}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-paper/80 transition hover:bg-white/5"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/5">
                  {COPY_ICON}
                </span>
                {copied ? "Copied!" : "Copy link"}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

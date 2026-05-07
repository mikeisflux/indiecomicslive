import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Seller shop on Indie Comics Live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-shop OG card. Shows the seller's display name + handle, their
// avatar (if uploaded) on the left, the brand stamp at the bottom.
export default async function Image({
  params,
}: {
  params: { handle: string };
}) {
  const seller = await prisma.user
    .findUnique({
      where: { handle: params.handle.toLowerCase() },
      select: { name: true, handle: true, image: true, bio: true },
    })
    .catch(() => null);

  const display = seller?.name ?? `@${seller?.handle ?? params.handle}`;
  const handle = seller?.handle ?? params.handle;
  const avatar = seller?.image ?? null;
  const bio = seller?.bio ?? "Indie comics, art books, and trading cards.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          color: "#f5f1e8",
          padding: "72px 80px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(700px 400px at 12% 100%, rgba(255,51,102,0.30), transparent 70%), radial-gradient(700px 400px at 88% 0%, rgba(255,110,160,0.18), transparent 70%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 18px",
              borderRadius: 9999,
              background: "rgba(255,255,255,0.08)",
              color: "rgba(245,241,232,0.85)",
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              fontWeight: 700,
              width: "fit-content",
            }}
          >
            Shop · Indie Comics Live
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 9999,
              background: "rgba(255,255,255,0.06)",
              border: "2px solid rgba(255,51,102,0.5)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                width={180}
                height={180}
                style={{ width: 180, height: 180, objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 96, color: "rgba(255,51,102,0.7)" }}>
                ◆
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: -1.5,
                display: "flex",
              }}
            >
              {display}
            </span>
            <span
              style={{
                fontSize: 28,
                color: "#ff6699",
                display: "flex",
              }}
            >
              @{handle}
            </span>
            <span
              style={{
                marginTop: 10,
                fontSize: 26,
                color: "rgba(245,241,232,0.7)",
                maxWidth: 760,
                display: "flex",
              }}
            >
              {bio}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "rgba(245,241,232,0.45)",
            fontSize: 22,
            zIndex: 1,
          }}
        >
          <span>indiecomicslive.com/shop/{handle}</span>
          <span>Live shows · 24/7 shop · mystery boxes</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

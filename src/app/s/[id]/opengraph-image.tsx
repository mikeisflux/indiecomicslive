import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Live show on Indie Comics Live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Show-specific OG card. If the seller uploaded a cover, use it as a
// blurred backdrop; otherwise fall back to the brand gradient. Title
// + handle + live state are always overlaid on top.
export default async function Image({
  params,
}: {
  params: { id: string };
}) {
  const show = await prisma.show
    .findUnique({
      where: { id: params.id },
      select: {
        title: true,
        status: true,
        coverImageUrl: true,
        seller: { select: { handle: true, name: true } },
      },
    })
    .catch(() => null);

  const title = show?.title ?? "Indie Comics Live";
  const handle = show?.seller?.handle ?? null;
  const sellerName = show?.seller?.name ?? null;
  const isLive = show?.status === "live";
  const cover = show?.coverImageUrl ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#f5f1e8",
          padding: "72px 80px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {cover && (
          /* Cover used as soft backdrop */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(28px) saturate(120%) brightness(0.45)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.85) 100%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", gap: 12 }}>
          {isLive && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 18px",
                background: "#ff3366",
                color: "white",
                borderRadius: 9999,
                fontSize: 22,
                letterSpacing: 4,
                textTransform: "uppercase",
                fontWeight: 800,
                width: "fit-content",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 9999,
                  background: "white",
                  display: "flex",
                }}
              />
              Live now
            </div>
          )}
          <div
            style={{
              display: "flex",
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
            Indie Comics Live
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              display: "flex",
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
          {(sellerName || handle) && (
            <div
              style={{
                marginTop: 24,
                fontSize: 30,
                color: "rgba(245,241,232,0.75)",
                display: "flex",
                gap: 14,
              }}
            >
              <span>{sellerName ?? `@${handle}`}</span>
              {sellerName && handle && (
                <span style={{ color: "rgba(245,241,232,0.4)" }}>
                  · @{handle}
                </span>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            color: "rgba(245,241,232,0.45)",
            fontSize: 22,
          }}
        >
          indiecomicslive.com
        </div>
      </div>
    ),
    { ...size },
  );
}

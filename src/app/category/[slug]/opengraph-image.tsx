import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Category on Indie Comics Live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-category card. Big emoji + name centered, brand stamp.
export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const cat = await prisma.category
    .findUnique({ where: { slug: params.slug } })
    .catch(() => null);

  const name = cat?.name ?? params.slug;
  const emoji = cat?.iconEmoji ?? "◆";

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
              "radial-gradient(900px 500px at 50% 50%, rgba(255,51,102,0.18), transparent 70%)",
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
            Indie Comics Live · category
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 1,
            gap: 16,
          }}
        >
          <div style={{ fontSize: 200, lineHeight: 1, display: "flex" }}>
            {emoji}
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1.0,
              letterSpacing: -2,
              display: "flex",
            }}
          >
            {name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "rgba(245,241,232,0.5)",
            fontSize: 22,
            zIndex: 1,
          }}
        >
          <span>indiecomicslive.com/category/{params.slug}</span>
          <span>Live · auctions · drops</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

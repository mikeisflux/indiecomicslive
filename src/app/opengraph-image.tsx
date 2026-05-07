import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Indie Comics Live — Whatnot alternative for adult comics & cards";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default OG card. Used by the homepage and as the fallback image
// for any page that doesn't ship its own opengraph-image.tsx.
export default async function Image() {
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(900px 500px at 18% 110%, rgba(255,51,102,0.30), transparent 70%), radial-gradient(700px 400px at 82% -10%, rgba(255,110,160,0.20), transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 18px",
            border: "1px solid rgba(255,51,102,0.5)",
            borderRadius: 9999,
            background: "rgba(255,51,102,0.12)",
            color: "#ff6699",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            fontWeight: 700,
            width: "fit-content",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 9999,
              background: "#ff3366",
              display: "flex",
            }}
          />
          Live · auctions · drops
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: -2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Indie Comics</span>
            <span style={{ color: "#ff3366" }}>Live</span>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 32,
              color: "rgba(245,241,232,0.75)",
              maxWidth: 900,
              display: "flex",
            }}
          >
            Sub-second WebRTC bidding for indie comics, art books, and
            trading cards. Adult-friendly. Sellers keep more.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "rgba(245,241,232,0.5)",
            fontSize: 24,
          }}
        >
          <span>indiecomicslive.com</span>
          <span>6% seller fee · no app-store gatekeepers</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

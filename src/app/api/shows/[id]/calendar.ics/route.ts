import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://indiecomicslive.com";

// GET /api/shows/[id]/calendar.ics — single-event iCalendar feed for
// the show. Apple Calendar / Google Calendar / Outlook all consume
// this. Filename is sluggified so the buyer sees a friendly name on
// download.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const show = await prisma.show.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      scheduledFor: true,
      seller: { select: { handle: true, name: true } },
    },
  });
  if (!show || !show.scheduledFor) {
    return new Response("not_found", { status: 404 });
  }

  const start = show.scheduledFor;
  // Default to a 90-minute event window — most live shows fall in
  // 30–120 min, so this is a sane default for the buyer's calendar.
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const sellerLabel = show.seller.name ?? `@${show.seller.handle ?? "indiecomicslive"}`;
  const description = (show.description ?? "")
    .replace(/[\r\n]+/g, "\\n")
    .slice(0, 500);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Indie Comics Live//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:show-${show.id}@indiecomicslive.com`,
    `DTSTAMP:${formatIcs(new Date())}`,
    `DTSTART:${formatIcs(start)}`,
    `DTEND:${formatIcs(end)}`,
    `SUMMARY:${escapeIcs(`${show.title} — ${sellerLabel}`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `URL:${SITE}/s/${show.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  const filename = `icl-${slug(show.title)}.ics`;
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}

function formatIcs(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "show";
}

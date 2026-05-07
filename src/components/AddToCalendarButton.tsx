"use client";

// Simple link to the .ics export for a show. Browsers download as a
// calendar file; mobile OS opens a "Add Event" sheet directly.
export default function AddToCalendarButton({ showId }: { showId: string }) {
  return (
    <a
      href={`/api/shows/${showId}/calendar.ics`}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-paper/80 hover:border-accent/50 hover:text-accent"
    >
      <span aria-hidden>📅</span>
      Add to calendar
    </a>
  );
}

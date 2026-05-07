// Fire-and-forget broadcast to the WebSocket server's
// /internal/broadcast endpoint. Used by API routes that mutate live
// show state (chat-overlay flag, pinned lot, tip arrived, etc) so
// connected viewers see the change without polling.

export async function broadcastToShow(
  showId: string,
  msg: Record<string, unknown>,
): Promise<void> {
  const wsPort = process.env.WS_PORT ?? "3001";
  const wsSecret = process.env.WS_INTERNAL_SECRET;
  if (!wsSecret) return;
  try {
    await fetch(`http://127.0.0.1:${wsPort}/internal/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-broadcast-token": wsSecret,
      },
      body: JSON.stringify({ showId, msg }),
    });
  } catch {
    // best-effort
  }
}

"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import StreamOverlay from "./StreamOverlay";
import ReactionLayer, { ReactionBar } from "./ReactionLayer";

const AntMediaPlayer = dynamic(() => import("@/components/AntMediaPlayer"), {
  ssr: false,
});

type Lot = {
  id: string;
  title: string;
  imageUrl: string | null;
  startingBidCents: number;
  minIncrementCents: number;
  currentBidCents: number | null;
  currentBidUserId: string | null;
  bidCount: number;
  endsAt: Date | string | null;
  status: string;
  kind?: "auction" | "buy_now" | "mystery";
  buyNowCents?: number | null;
  inventoryCount?: number;
};

type Props = {
  show: {
    id: string;
    title: string;
    status: string;
    coverImageUrl: string | null;
    trailerUrl: string | null;
    pinnedLotId: string | null;
    chatOverlayEnabled: boolean;
  };
  seller: {
    handle: string | null;
    name: string | null;
    image: string | null;
  } | null;
  liveLot: Lot | null;
  pinnedLot: Lot | null;
  queuedLots: Lot[];
};

type ChatMsg = {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
};

export default function ShowRoom({
  show,
  seller,
  liveLot: initialLot,
  pinnedLot: initialPinnedLot,
  queuedLots,
}: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lot, setLot] = useState<Lot | null>(initialLot);
  const [pinnedLot, setPinnedLot] = useState<Lot | null>(initialPinnedLot);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [bidErr, setBidErr] = useState<string | null>(null);
  const [chatOverlayEnabled, setChatOverlayEnabled] = useState(
    show.chatOverlayEnabled,
  );
  const [reactions, setReactions] = useState<
    { id: string; kind: string; at: number }[]
  >([]);

  function pushReaction(kind: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setReactions((r) => [...r.slice(-50), { id, kind, at: Date.now() }]);
    // Self-clean after the animation duration.
    setTimeout(() => {
      setReactions((r) => r.filter((x) => x.id !== id));
    }, 4000);
  }
  const userId = useFakeUserId();

  // Resolve a pinned lotId from the WS to one of our cached lot rows.
  function resolveLot(id: string | null): Lot | null {
    if (!id) return null;
    if (initialLot?.id === id) return initialLot;
    if (initialPinnedLot?.id === id) return initialPinnedLot;
    return queuedLots.find((q) => q.id === id) ?? null;
  }

  useEffect(() => {
    if (!userId) return;
    const url = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "hello", userId, showId: show.id }));
    };
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "chat") {
        setChat((c) => [...c.slice(-100), msg]);
      } else if (msg.type === "bid_accepted" && lot && msg.lotId === lot.id) {
        setLot({
          ...lot,
          currentBidCents: msg.currentBidCents,
          currentBidUserId: msg.currentBidUserId,
          endsAt: msg.endsAt,
          bidCount: msg.bidCount,
        });
      } else if (msg.type === "pin") {
        setPinnedLot(resolveLot(msg.lotId));
      } else if (msg.type === "chat_overlay") {
        setChatOverlayEnabled(!!msg.enabled);
      } else if (msg.type === "reaction") {
        pushReaction(String(msg.kind ?? "heart"));
      } else if (msg.type === "bid_rejected") {
        setBidErr(msg.reason);
        setTimeout(() => setBidErr(null), 2000);
      } else if (msg.type === "lot_closed" && lot && msg.lotId === lot.id) {
        setLot({ ...lot, status: msg.sold ? "sold" : "unsold" });
      }
    };

    return () => ws.close();
  }, [show.id, userId, lot]);

  function sendChat() {
    if (!chatDraft.trim() || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({ type: "chat", body: chatDraft.trim() }),
    );
    setChatDraft("");
  }

  function placeBid() {
    if (!lot || !wsRef.current) return;
    const next =
      (lot.currentBidCents ?? lot.startingBidCents - lot.minIncrementCents) +
      lot.minIncrementCents;
    wsRef.current.send(
      JSON.stringify({ type: "bid", lotId: lot.id, amountCents: next }),
    );
  }

  function sendReaction(kind: string) {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "reaction", kind }));
    // Optimistic local render so the user sees their own reaction
    // even if the WS broadcast is briefly delayed.
    pushReaction(kind);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <a href="/" className="text-paper/60 hover:text-paper">
          ←
        </a>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{show.title}</p>
          <p className="truncate text-xs text-paper/60">
            @{seller?.handle ?? "unknown"} ·{" "}
            {connected ? "connected" : "connecting…"}
          </p>
        </div>
      </header>

      <div className="relative aspect-[9/16] max-h-[70dvh] w-full bg-black sm:aspect-video">
        {show.status === "live" ? (
          <AntMediaPlayer showId={show.id} poster={show.coverImageUrl} />
        ) : show.trailerUrl ? (
          <video
            src={show.trailerUrl}
            poster={show.coverImageUrl ?? undefined}
            controls
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <AntMediaPlayer showId={show.id} poster={show.coverImageUrl} />
        )}
        <StreamOverlay liveLot={lot} pinnedLot={pinnedLot} />
        <ReactionLayer reactions={reactions} />
        <ReactionBar onTap={sendReaction} />
        {chatOverlayEnabled && chat.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 overflow-hidden bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
            <ul className="flex h-full flex-col-reverse gap-1 overflow-hidden text-sm">
              {[...chat].slice(-12).reverse().map((m) => (
                <li key={m.id} className="leading-tight">
                  <span className="text-paper/60">@{m.userId.slice(0, 6)}</span>{" "}
                  <span className="text-paper">{m.body}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <BidBar lot={lot} onBid={placeBid} bidErr={bidErr} />

      <div className="flex flex-1 flex-col">
        <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3 text-sm">
          {chat.length === 0 ? (
            <p className="text-paper/40">Be the first to say something.</p>
          ) : (
            chat.map((m) => (
              <p key={m.id}>
                <span className="text-paper/60">@{m.userId.slice(0, 6)}</span>{" "}
                <span>{m.body}</span>
              </p>
            ))
          )}
        </div>
        <div className="border-t border-white/10 p-3">
          <div className="flex gap-2">
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Say something"
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-white/30"
            />
            <button
              onClick={sendChat}
              className="rounded-full bg-paper px-4 text-sm font-semibold text-ink"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {queuedLots.length > 0 && (
        <div className="border-t border-white/10 px-4 py-3 text-xs text-paper/60">
          {queuedLots.length} lot{queuedLots.length === 1 ? "" : "s"} queued
        </div>
      )}
    </div>
  );
}

function BidBar({
  lot,
  onBid,
  bidErr,
}: {
  lot: Lot | null;
  onBid: () => void;
  bidErr: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  if (!lot) {
    return (
      <div className="border-y border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-paper/60">
        Waiting for next lot…
      </div>
    );
  }

  const endsAt = lot.endsAt ? new Date(lot.endsAt).getTime() : null;
  const remainingSec = endsAt
    ? Math.max(0, Math.ceil((endsAt - now) / 1000))
    : null;
  const next =
    (lot.currentBidCents ?? lot.startingBidCents - lot.minIncrementCents) +
    lot.minIncrementCents;

  return (
    <div className="border-y border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{lot.title}</p>
          <p className="text-xs text-paper/60">
            {lot.currentBidCents
              ? `Current: $${(lot.currentBidCents / 100).toFixed(2)} · ${lot.bidCount} bid${lot.bidCount === 1 ? "" : "s"}`
              : `Start: $${(lot.startingBidCents / 100).toFixed(2)}`}
            {remainingSec !== null && lot.status === "live"
              ? ` · ${remainingSec}s`
              : ""}
          </p>
        </div>
        <button
          onClick={onBid}
          disabled={lot.status !== "live"}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Bid ${(next / 100).toFixed(2)}
        </button>
      </div>
      {bidErr && (
        <p className="mt-2 text-xs text-accent">Bid rejected: {bidErr}</p>
      )}
    </div>
  );
}

function useFakeUserId() {
  const [id, setId] = useState<string>("");
  useEffect(() => {
    let v = localStorage.getItem("dev_user_id");
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem("dev_user_id", v);
    }
    setId(v);
  }, []);
  return id;
}

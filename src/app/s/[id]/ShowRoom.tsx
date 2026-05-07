"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import StreamOverlay from "./StreamOverlay";
import ReactionLayer, { ReactionBar } from "./ReactionLayer";
import WatchButton from "@/components/WatchButton";
import AutoBidButton from "@/components/AutoBidButton";
import ShowSideWidgets from "@/components/ShowSideWidgets";
import VictoryBurst from "@/components/VictoryBurst";
import WinnerReveal, { type WinnerTrigger } from "@/components/WinnerReveal";
import AddToCalendarButton from "@/components/AddToCalendarButton";
import SlideToBid from "@/components/SlideToBid";
import TipButton from "@/components/TipButton";
import ShowHeaderCard from "@/components/ShowHeaderCard";
import ShowSideRail from "@/components/ShowSideRail";
import GiveawayEntriesPill from "@/components/GiveawayEntriesPill";
import RecordingPlayer from "./RecordingPlayer";

interface TipBlast {
  id: string;
  amountCents: number;
  fromLabel: string;
  message: string | null;
  sticker: string | null;
  at: number;
}

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
  kind?: "auction" | "buy_now" | "mystery" | "pack_break" | "flash";
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
    extraCams: { id: string; label: string }[];
    isWatching: boolean;
    sellerStats: {
      reviewAvg: number | null;
      reviewCount: number;
      daysSinceLastShow: number | null;
      shopItemCount: number;
      isFollowing: boolean;
    };
  };
  seller: {
    id: string;
    handle: string | null;
    name: string | null;
    image: string | null;
  } | null;
  liveLot: Lot | null;
  pinnedLot: Lot | null;
  queuedLots: Lot[];
  signedIn: boolean;
  // Set when the show has ended and a ShowRecording row resolves to a
  // playable URL (R2-presigned or AMS-direct). Triggers the replay
  // player instead of the AntMediaPlayer.
  replayUrl: string | null;
  replayChapters: { lotId: string; title: string; offsetSec: number }[];
  // True for the show's seller or one of its moderators — surfaces the
  // moderator chat-delete buttons on each line.
  canModerate: boolean;
};

type ChatMsg = {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
  deletedAt?: string | null;
};

export default function ShowRoom({
  show,
  seller,
  liveLot: initialLot,
  pinnedLot: initialPinnedLot,
  queuedLots,
  signedIn,
  replayUrl,
  replayChapters,
  canModerate,
}: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lot, setLot] = useState<Lot | null>(initialLot);
  const [pinnedLot, setPinnedLot] = useState<Lot | null>(initialPinnedLot);
  const [currentBidderLabel, setCurrentBidderLabel] =
    useState<string | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [bidErr, setBidErr] = useState<string | null>(null);
  const [chatOverlayEnabled, setChatOverlayEnabled] = useState(
    show.chatOverlayEnabled,
  );
  const [reactions, setReactions] = useState<
    { id: string; kind: string; at: number }[]
  >([]);
  const [victoryAt, setVictoryAt] = useState(0);
  const [winnerTrigger, setWinnerTrigger] = useState<WinnerTrigger | null>(null);
  const [tipBlasts, setTipBlasts] = useState<TipBlast[]>([]);

  function pushTip(blast: Omit<TipBlast, "at">) {
    setTipBlasts((b) => [...b.slice(-4), { ...blast, at: Date.now() }]);
    setTimeout(() => {
      setTipBlasts((b) => b.filter((t) => t.id !== blast.id));
    }, 5000);
  }

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
        if (typeof msg.currentBidderLabel === "string") {
          setCurrentBidderLabel(msg.currentBidderLabel);
        }
        if (msg.currentBidUserId === userId) {
          setVictoryAt(Date.now());
        }
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
        if (msg.sold && msg.winnerLabel) {
          setWinnerTrigger({
            at: Date.now(),
            label: msg.winnerLabel,
            amountCents: msg.finalCents ?? 0,
            avatarUrl: msg.winnerAvatar ?? null,
          });
        }
      } else if (msg.type === "tip") {
        pushTip({
          id: msg.tipId ?? `${Date.now()}`,
          amountCents: msg.amountCents,
          fromLabel: msg.fromLabel,
          message: msg.message,
          sticker: msg.sticker,
        });
      } else if (msg.type === "chat_deleted") {
        setChat((c) =>
          c.map((m) =>
            m.id === msg.messageId
              ? { ...m, deletedAt: new Date().toISOString() }
              : m,
          ),
        );
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

  function deleteChat(messageId: string) {
    if (!wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({ type: "chat_delete", messageId }),
    );
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
        <div className="flex items-center gap-2">
          {show.status === "scheduled" && <AddToCalendarButton showId={show.id} />}
          {show.status === "live" && (
            <TipButton showId={show.id} signedIn={signedIn} />
          )}
          <WatchButton
            kind="show"
            id={show.id}
            initial={show.isWatching}
            size="sm"
          />
        </div>
      </header>

      <div className="relative aspect-[9/16] max-h-[70dvh] w-full bg-black sm:aspect-video">
        {show.status === "live" ? (
          <AntMediaPlayer
            showId={show.id}
            poster={show.coverImageUrl}
            extraCams={show.extraCams}
          />
        ) : replayUrl ? (
          <RecordingPlayer
            src={replayUrl}
            poster={show.coverImageUrl}
            chapters={replayChapters}
          />
        ) : show.trailerUrl ? (
          <video
            src={show.trailerUrl}
            poster={show.coverImageUrl ?? undefined}
            controls
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <AntMediaPlayer
            showId={show.id}
            poster={show.coverImageUrl}
            extraCams={show.extraCams}
          />
        )}
        <StreamOverlay liveLot={lot} pinnedLot={pinnedLot} />
        {seller && (
          <ShowHeaderCard
            seller={{
              id: seller.id,
              handle: seller.handle,
              name: seller.name,
              image: seller.image,
            }}
            reviewAvg={show.sellerStats.reviewAvg}
            reviewCount={show.sellerStats.reviewCount}
            daysSinceLastShow={show.sellerStats.daysSinceLastShow}
            initialFollowing={show.sellerStats.isFollowing}
            signedIn={signedIn}
          />
        )}
        <GiveawayEntriesPill showId={show.id} />
        <ShowSideRail
          showId={show.id}
          sellerHandle={seller?.handle ?? null}
          shopBadgeCount={show.sellerStats.shopItemCount}
        />
        <ReactionLayer reactions={reactions} />
        <ReactionBar onTap={sendReaction} />
        <VictoryBurst trigger={victoryAt} />
        <WinnerReveal trigger={winnerTrigger} />
        {tipBlasts.length > 0 && (
          <ul className="pointer-events-none absolute left-3 top-12 z-20 space-y-1">
            {tipBlasts.map((t) => (
              <li
                key={t.id}
                className="icl-fade-up flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-ink shadow-[0_0_18px_rgba(255,200,90,0.6)]"
              >
                <span className="text-base">{t.sticker ?? "💸"}</span>
                <span>
                  {t.fromLabel} tipped{" "}
                  <span className="font-mono">
                    ${(t.amountCents / 100).toFixed(2)}
                  </span>
                </span>
                {t.message && (
                  <span className="line-clamp-1 max-w-[180px] font-normal text-ink/80">
                    "{t.message}"
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
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

      <BidBar
        lot={lot}
        onBid={placeBid}
        bidErr={bidErr}
        amIHighBidder={!!lot && lot.currentBidUserId === userId}
        currentBidderLabel={currentBidderLabel}
      />

      {lot && (lot.kind === "auction" || (lot.kind as unknown as string) === "flash") && (
        <div className="flex justify-end px-4 pb-2">
          <AutoBidButton lotId={lot.id} initialMaxDollars={null} />
        </div>
      )}

      <ShowSideWidgets showId={show.id} signedIn={signedIn} />

      <div className="flex flex-1 flex-col">
        <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3 text-sm">
          {chat.length === 0 ? (
            <p className="text-paper/40">Be the first to say something.</p>
          ) : (
            chat
              .filter((m) => !m.deletedAt)
              .map((m) => (
                <p key={m.id} className="group flex items-start gap-2">
                  <span className="text-paper/60">
                    @{m.userId.slice(0, 6)}
                  </span>
                  <span className="flex-1 break-words">{m.body}</span>
                  {canModerate && (
                    <button
                      onClick={() => deleteChat(m.id)}
                      aria-label="Delete message"
                      className="opacity-0 transition group-hover:opacity-100 text-paper/40 hover:text-red-300"
                    >
                      ×
                    </button>
                  )}
                </p>
              ))
          )}
        </div>
        <div className="border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Say something"
              enterKeyHint="send"
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-base outline-none focus:border-accent/60 sm:text-sm"
            />
            <button
              onClick={sendChat}
              className="rounded-full bg-accent px-5 text-sm font-bold text-white shadow-[0_0_18px_rgba(255,51,102,0.4)]"
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
  amIHighBidder,
  currentBidderLabel,
}: {
  lot: Lot | null;
  onBid: () => void;
  bidErr: string | null;
  amIHighBidder: boolean;
  currentBidderLabel: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  if (!lot) {
    return (
      <div className="flex items-center justify-center gap-2 border-y border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-paper/60">
        <span className="icl-pulse-dot inline-block h-2 w-2 rounded-full bg-accent" />
        Awaiting next item
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
  const closingSoon = remainingSec !== null && remainingSec <= 5;
  const liveOrFlash = lot.status === "live";

  return (
    <div
      className={`relative border-y border-white/10 bg-white/[0.02] transition ${
        closingSoon ? "bg-accent/10" : ""
      }`}
    >
      {liveOrFlash && (amIHighBidder || currentBidderLabel) && (
        <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-ink shadow-[0_0_18px_rgba(251,191,36,0.55)]">
          {amIHighBidder ? (
            <>
              <span aria-hidden>👑</span> You&rsquo;re winning!
            </>
          ) : (
            <>
              <span className="lowercase normal-case">{currentBidderLabel}</span>{" "}
              <span className="text-amber-900">is winning!</span>
            </>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3">
        {lot.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lot.imageUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg border border-white/10 object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{lot.title}</p>
          <p className="flex items-center gap-2 text-xs text-paper/60">
            {lot.currentBidCents ? (
              <>
                <span className="font-mono font-bold text-paper">
                  ${(lot.currentBidCents / 100).toFixed(2)}
                </span>
                <span className="text-paper/30">·</span>
                <span>
                  {lot.bidCount} bid{lot.bidCount === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span>
                Start{" "}
                <span className="font-mono font-bold text-paper">
                  ${(lot.startingBidCents / 100).toFixed(2)}
                </span>
              </span>
            )}
          </p>
        </div>

        {liveOrFlash && lot.id && (
          <AutoBidButton lotId={lot.id} initialMaxDollars={null} />
        )}

        <div
          className={`grid h-12 w-14 shrink-0 place-items-center rounded-2xl border text-center font-mono text-xs font-bold transition ${
            closingSoon
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-white/15 text-paper/70"
          }`}
          aria-label="Time remaining"
        >
          {liveOrFlash && remainingSec !== null
            ? `0:${String(remainingSec).padStart(2, "0")}`
            : "—"}
        </div>

        <SlideToBid
          label={`Bid: $${(next / 100).toFixed(2)}`}
          disabled={!liveOrFlash}
          onBid={onBid}
        />
      </div>
      {bidErr && (
        <p className="px-4 pb-2 text-xs text-accent">Bid rejected: {bidErr}</p>
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

import { handlers } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

const { GET: authGet, POST: authPost } = handlers;

// Wrap the magic-link verification GET so email-scanner prefetches
// (Gmail's link-safety check, Outlook ATP, corporate URL scanners,
// etc.) can't silently consume one-shot verification tokens.
//
// Reliable signal: `Sec-Fetch-User: ?1` is only sent by real user
// navigations (a browser tab the human clicked into). Browsers
// strictly enforce this — programmatic, prefetched, fetch(), and
// background requests never carry it. Bots also don't.
//
// If Sec-Fetch-User is missing on an email-callback GET, we return
// 200 OK with no body and DO NOT call Auth.js. The token stays valid
// in the verification_tokens table. When the human clicks the link
// in their browser, the same URL arrives with Sec-Fetch-User: "?1"
// and we pass through to Auth.js for the real verification.
//
// Other auth routes (csrf, providers, signin, signout, callback for
// non-email providers) are unaffected.
function isVerificationCallback(req: NextRequest): boolean {
  const url = new URL(req.url);
  // Match /api/auth/callback/<provider> with a token query param.
  // Today the only email provider is "sendgrid" but check by token
  // presence so this works for any future email-style provider too.
  if (!/\/api\/auth\/callback\//.test(url.pathname)) return false;
  return url.searchParams.has("token");
}

function looksLikeUserClick(req: NextRequest): boolean {
  const fetchUser = req.headers.get("sec-fetch-user");
  if (fetchUser === "?1") return true;
  // Browsers omit Sec-Fetch-* on file://, very old browsers, and a few
  // niche cases. Fall back to user-agent sniffing only when the header
  // is absent entirely; if it's present and not "?1", treat as a bot.
  if (fetchUser !== null) return false;
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  if (!ua) return false;
  if (
    /\b(bot|crawler|spider|preview|prefetch|scanner|monitoring|gptbot|googlebot|bingbot|yandexbot|duckduckbot|baiduspider)\b/.test(
      ua,
    )
  ) {
    return false;
  }
  // Old browser without Sec-Fetch headers (rare): assume user click.
  return true;
}

export async function GET(req: NextRequest) {
  if (isVerificationCallback(req) && !looksLikeUserClick(req)) {
    // Don't consume the token — return a tiny "OK" so the scanner is
    // satisfied. The human's click will land on the real handler.
    return new NextResponse("OK", {
      status: 200,
      headers: { "x-icl-prefetch-bypass": "1" },
    });
  }
  return authGet(req);
}

export const POST = authPost;

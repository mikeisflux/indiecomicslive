// Extract the originating client IP from a request, preferring
// trusted CDN/proxy headers over the spoofable defaults.
//
// Order:
//   1. cf-connecting-ip   (Cloudflare; can't be set by clients)
//   2. true-client-ip     (Cloudflare Enterprise / Akamai)
//   3. x-real-ip          (set by nginx with `real_ip_header`)
//   4. x-forwarded-for    (first IP, comma-separated)

export function getClientIP(req: Request): string | null {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const trueIp = h.get("true-client-ip");
  if (trueIp) return trueIp.trim();

  const real = h.get("x-real-ip");
  if (real) return real.trim();

  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
}

export function getUserAgent(req: Request): string | undefined {
  return req.headers.get("user-agent") ?? undefined;
}

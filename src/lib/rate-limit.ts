// Tiny in-memory sliding-window rate limiter.
//
// Stored as a Map<bucketKey, timestamps[]>. Each call drops timestamps
// older than `windowMs`, then either appends a fresh hit + returns
// ok:true, or returns ok:false with the time until the oldest in-window
// hit ages out.
//
// Limitations:
//   - Per-process. pm2 cluster mode would split the bucket — fine
//     for our current 1-instance setup; upgrade to Redis when we
//     scale out.
//   - Memory bound: each key keeps `limit` integers; we'll periodically
//     clean idle keys.
//
// Use: pick a stable bucket key per actor (e.g. `dm:<userId>`) and
// per intent.

const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

function sweepIfStale() {
  const now = Date.now();
  if (now - lastSweep < 5 * 60 * 1000) return;
  lastSweep = now;
  // Drop empty / fully-expired buckets so the map can't grow forever.
  for (const [k, arr] of buckets) {
    if (arr.length === 0 || arr[arr.length - 1] < now - 60 * 60 * 1000) {
      buckets.delete(k);
    }
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Milliseconds until the next slot frees up. Only set when ok=false. */
  retryMs?: number;
  /** How many hits are still allowed in the current window. */
  remaining: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  sweepIfStale();
  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = buckets.get(key) ?? [];
  const live = existing.filter((t) => t > cutoff);
  if (live.length >= limit) {
    const oldest = live[0];
    return {
      ok: false,
      retryMs: Math.max(1, oldest + windowMs - now),
      remaining: 0,
    };
  }
  live.push(now);
  buckets.set(key, live);
  return { ok: true, remaining: Math.max(0, limit - live.length) };
}

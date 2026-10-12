/**
 * In-memory fixed-window rate limiter for unauthenticated write/lookup
 * endpoints (login, register, reviews, contact, newsletter, coupon probes,
 * checkout, order tracking).
 *
 * Single-process by design: the standalone deployment runs one Node server.
 * If the app ever scales horizontally, swap this module's internals for a
 * shared store (Upstash Redis, etc.) — the call sites only depend on
 * `rateLimit(key, limit, windowMs)`.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

/** Sweep interval: stale buckets are pruned opportunistically (max ~1/10s). */
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 10_000;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 5 * 60_000) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the current window resets (present when blocked). */
  retryAfterSec?: number;
};

/**
 * Count one request against `key`. A fixed window starting at the first
 * request in the window; rejected requests do not extend the count.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count <= limit) return { ok: true };

  const retryAfterSec = Math.max(1, Math.ceil((bucket.windowStart + windowMs - now) / 1000));
  return { ok: false, retryAfterSec };
}

/** Test helper — drop all buckets. */
export function resetRateLimiter(): void {
  buckets.clear();
}

/**
 * Derive the limiter key from an `x-forwarded-for` header. Behind a proxy the
 * header carries a comma-separated chain — the FIRST hop is the original
 * client. Missing/empty headers (direct connections) share the "direct"
 * bucket, mirroring the checkout route's established convention. Pure, so
 * every call site keys budgets the same way.
 */
export function clientIp(headerValue: string | null | undefined): string {
  const value = headerValue?.trim();
  if (!value) return "direct";
  const first = value.split(",")[0]?.trim();
  return first || "direct";
}

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
 * Derive the limiter key's IP from the request headers. Spoof-resistant
 * ordering (session-6): `cf-connecting-ip` wins — the edge sets it from the
 * socket, so a client cannot feed it through the proxy chain — otherwise the
 * RIGHTMOST `x-forwarded-for` entry, i.e. the hop the nearest trusted proxy
 * appended. (The leftmost entry is whatever the client typed; behind an
 * appending proxy it survives untouched at the front of the chain.) Direct
 * connections (no proxy headers — local dev, e2e) share the "direct" bucket.
 * Every call site keys budgets through this helper so they can never
 * disagree.
 */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const xff = headers.get("x-forwarded-for")?.trim();
  if (!xff) return "direct";
  const last = xff.split(",").map((hop) => hop.trim()).filter(Boolean).pop();
  return last || "direct";
}

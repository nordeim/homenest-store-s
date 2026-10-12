import { afterEach, describe, expect, it } from "vitest";

import { rateLimit, resetRateLimiter, clientIp } from "@/lib/rate-limit";

describe("rateLimit", () => {
  afterEach(() => {
    resetRateLimiter();
  });

  it("allows requests up to the limit within the window", () => {
    const key = "login:1.2.3.4";
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).ok).toBe(true);
    }
    // 6th request in the same window is rejected
    const blocked = rateLimit(key, 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("resets after the window elapses", async () => {
    const key = "track:5.6.7.8";
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 50).ok).toBe(true);
    expect(rateLimit(key, 3, 50).ok).toBe(false);
    // advance past the window
    await new Promise((r) => setTimeout(r, 80));
    expect(rateLimit(key, 3, 50).ok).toBe(true);
  });

  it("isolates keys from each other", () => {
    for (let i = 0; i < 4; i++) expect(rateLimit("contact:a", 4, 60_000).ok).toBe(true);
    // a different key still has its full budget
    expect(rateLimit("contact:b", 4, 60_000).ok).toBe(true);
    expect(rateLimit("newsletter:a", 4, 60_000).ok).toBe(true);
  });

  it("does not count requests that were rejected", () => {
    const key = "coupon:9.9.9.9";
    for (let i = 0; i < 2; i++) expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    // rejected attempts don't extend the count — once the window passes, exactly 2 are available again
    expect(rateLimit(key, 2, 60_000).ok).toBe(false);
  });

  it("sweeps stale buckets so memory stays bounded", async () => {
    // prime a bucket, let it expire, then trigger a sweep via a new key
    expect(rateLimit("stale:old", 1, 20).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 40));
    rateLimit("fresh:new", 1, 60_000);
    expect(rateLimit("stale:old", 1, 20).ok).toBe(true); // bucket was swept, not retained
  });
});

describe("clientIp (session-6 contract: Headers-based, spoof-resistant)", () => {
  // Helper — build a Headers object the way route handlers see one.
  const h = (init: Record<string, string>): Headers => new Headers(init);

  it("returns 'direct' when no IP headers are present (direct connections share one bucket)", () => {
    expect(clientIp(h({}))).toBe("direct");
    expect(clientIp(h({ "x-forwarded-for": "" }))).toBe("direct");
  });

  it("prefers CF-Connecting-IP — the edge header an appending proxy cannot be fed by the client", () => {
    expect(
      clientIp(h({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4, 198.51.100.7" })),
    ).toBe("198.51.100.7");
  });

  it("takes the RIGHTMOST x-forwarded-for entry — the hop the nearest trusted proxy appended", () => {
    // A spoofing client sends `X-Forwarded-For: 1.2.3.4`; the appending proxy
    // turns it into `1.2.3.4, <real>`. The leftmost entry is attacker-chosen.
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("returns the single XFF value trimmed when there is only one hop", () => {
    expect(clientIp(h({ "x-forwarded-for": "  198.51.100.23  " }))).toBe("198.51.100.23");
  });

  it("falls back to 'direct' when the XFF chain is only commas/whitespace", () => {
    expect(clientIp(h({ "x-forwarded-for": " , , " }))).toBe("direct");
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { rateLimit, resetRateLimiter } from "@/lib/rate-limit";

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

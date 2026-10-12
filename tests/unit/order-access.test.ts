import { beforeAll, describe, expect, it } from "vitest";

import { orderAccessToken, replayAuthorized, verifyOrderAccessToken } from "@/lib/order-access";

// Deterministic secret for the suite (module reads the env at call time).
beforeAll(() => {
  process.env.AUTH_SECRET = "test-only-access-token-secret-0123456789abcdef";
});

describe("orderAccessToken", () => {
  it("is deterministic for the same order number and secret", () => {
    expect(orderAccessToken("ORD-2026-001")).toBe(orderAccessToken("ORD-2026-001"));
  });

  it("differs across order numbers", () => {
    expect(orderAccessToken("ORD-2026-001")).not.toBe(orderAccessToken("ORD-2026-002"));
  });

  it("differs across secrets (key separation)", () => {
    const first = orderAccessToken("ORD-2026-001");
    process.env.AUTH_SECRET = "a-completely-different-secret-value-0123456789";
    expect(orderAccessToken("ORD-2026-001")).not.toBe(first);
    process.env.AUTH_SECRET = "test-only-access-token-secret-0123456789abcdef";
  });

  it("is a 128-bit hex capability token (32 hex chars)", () => {
    expect(orderAccessToken("ORD-2026-001")).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("verifyOrderAccessToken", () => {
  it("accepts the exact token minted for the order", () => {
    expect(verifyOrderAccessToken("ORD-2026-001", orderAccessToken("ORD-2026-001"))).toBe(true);
  });

  it("rejects a token minted for a different order", () => {
    expect(verifyOrderAccessToken("ORD-2026-001", orderAccessToken("ORD-2026-002"))).toBe(false);
  });

  it("rejects empty, truncated, padded and tampered tokens (timing-safe path)", () => {
    const valid = orderAccessToken("ORD-2026-001");
    expect(verifyOrderAccessToken("ORD-2026-001", "")).toBe(false);
    expect(verifyOrderAccessToken("ORD-2026-001", valid.slice(1))).toBe(false);
    expect(verifyOrderAccessToken("ORD-2026-001", `${valid}0`)).toBe(false);
    expect(verifyOrderAccessToken("ORD-2026-001", `0${valid.slice(1)}`)).toBe(false);
  });

  it("rejects a token minted under a different secret", () => {
    const valid = orderAccessToken("ORD-2026-001");
    process.env.AUTH_SECRET = "a-completely-different-secret-value-0123456789";
    expect(verifyOrderAccessToken("ORD-2026-001", valid)).toBe(false);
    process.env.AUTH_SECRET = "test-only-access-token-secret-0123456789abcdef";
  });
});

// --- session-6 S6-8: idempotent-checkout replays are ownership-bound --------
describe("replayAuthorized", () => {
  it("binds a guest order's replay to the placing cart-token cookie", () => {
    expect(replayAuthorized(null, "tok_123", null, "tok_123")).toBe(true);
    expect(replayAuthorized(null, "tok_123", null, "tok_456")).toBe(false);
    expect(replayAuthorized(null, "tok_123", null, null)).toBe(false);
  });

  it("binds a user order's replay to the same signed-in user", () => {
    expect(replayAuthorized("user_1", null, "user_1", null)).toBe(true);
    expect(replayAuthorized("user_1", null, "user_2", null)).toBe(false);
    // The user identity wins even if a cart token also matches.
    expect(replayAuthorized("user_1", "tok_1", "user_2", "tok_1")).toBe(false);
  });

  it("denies legacy rows with no recorded binding (fall through, no leak)", () => {
    expect(replayAuthorized(null, null, null, null)).toBe(false);
    expect(replayAuthorized(null, null, null, "tok_1")).toBe(false);
  });

  it("denies a guest replay that presents only a user session (and vice versa)", () => {
    expect(replayAuthorized(null, "tok_1", "user_1", null)).toBe(false);
    expect(replayAuthorized("user_1", null, null, "tok_1")).toBe(false);
  });
});

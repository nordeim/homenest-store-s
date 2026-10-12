import { beforeAll, describe, expect, it } from "vitest";

import { orderAccessToken, verifyOrderAccessToken } from "@/lib/order-access";

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

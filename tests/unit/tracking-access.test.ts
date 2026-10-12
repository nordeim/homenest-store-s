import { describe, expect, it } from "vitest";

import { emailsMatch, normalizeEmail } from "@/lib/order-tracking";

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
  });

  it("returns an empty string for null/undefined input", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("emailsMatch", () => {
  it("matches case-insensitively and trims", () => {
    expect(emailsMatch(" Buyer@Example.com ", "buyer@example.com")).toBe(true);
  });

  it("rejects different addresses", () => {
    expect(emailsMatch("a@example.com", "b@example.com")).toBe(false);
  });

  it("never matches when either side is empty (anti-enumeration default deny)", () => {
    expect(emailsMatch("", "a@example.com")).toBe(false);
    expect(emailsMatch("a@example.com", "")).toBe(false);
    expect(emailsMatch("", "")).toBe(false);
  });
});

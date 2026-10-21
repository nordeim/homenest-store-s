import { describe, expect, it } from "vitest";

import { buildCsp } from "@/lib/csp";

describe("buildCsp", () => {
  it("emits the production directive set with the nonce and strict-dynamic", () => {
    const csp = buildCsp({ nonce: "n0nc3", isDev: false });
    expect(csp).toContain("script-src 'self' 'nonce-n0nc3' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("adds the dev-only unsafe-eval carve-out (React dev builds eval)", () => {
    const dev = buildCsp({ nonce: "abc", isDev: true });
    expect(dev).toContain("'unsafe-eval'");
    // The nonce is present in both modes.
    expect(dev).toContain("'nonce-abc'");
  });

  it("is semicolon-delimited with no trailing separator", () => {
    const csp = buildCsp({ nonce: "x", isDev: false });
    expect(csp.startsWith(";")).toBe(false);
    expect(csp.endsWith(";")).toBe(false);
    expect(csp.split("; ").length).toBe(9);
  });

  // The Stripe retrofit (PAY-STRIPE-1): the Payment Element host family —
  // script-src gains js.stripe.com, connect-src gains api.stripe.com, and
  // frame-src is appended. UNCONFIGURED the string stays byte-identical to
  // the pre-retrofit pin (the 9-directive form above).
  it("unconfigured (the default) carries no Stripe hosts — byte-identical to the 2-arg call", () => {
    expect(buildCsp({ nonce: "x", isDev: false, stripeConfigured: false })).toBe(
      buildCsp({ nonce: "x", isDev: false }),
    );
    expect(buildCsp({ nonce: "x", isDev: false })).not.toContain("stripe.com");
  });

  it("stripeConfigured adds the element iframe family (script/connect/frame-src)", () => {
    const csp = buildCsp({ nonce: "x", isDev: false, stripeConfigured: true });
    expect(csp).toContain("script-src 'self' 'nonce-x' 'strict-dynamic' https://js.stripe.com");
    expect(csp).toContain("connect-src 'self' https://api.stripe.com");
    expect(csp.endsWith("frame-src https://js.stripe.com https://hooks.stripe.com")).toBe(true);
    expect(csp.split("; ").length).toBe(10);
  });

  it("stripeConfigured composes with the dev carve-out (unsafe-eval AND the hosts)", () => {
    const dev = buildCsp({ nonce: "d", isDev: true, stripeConfigured: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("https://js.stripe.com");
  });
});

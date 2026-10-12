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
});

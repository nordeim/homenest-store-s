import { describe, expect, it } from "vitest";

import {
  isPublishableKeyConfigured,
  isRealSecret,
  resolveStripeConfig,
} from "@/lib/stripe-config";

/**
 * The sentinel mirror (PAY-STRIPE-1): the SERVER (STRIPE_SECRET_KEY) and
 * CLIENT (publishable key) "configured" checks share ONE truth table — they
 * can never disagree, and placeholder values are NOT configuration.
 */
describe("resolveStripeConfig — the sentinel mirror", () => {
  it("unconfigured by default: no secret → serverConfigured false, publishableKey null", () => {
    expect(resolveStripeConfig({})).toEqual({ serverConfigured: false, publishableKey: null });
  });

  it("a real secret alone → serverConfigured true but NO publishable key (the mirror stays off)", () => {
    const config = resolveStripeConfig({ STRIPE_SECRET_KEY: "sk_test_abc" });
    expect(config.serverConfigured).toBe(true);
    expect(config.publishableKey).toBe(null);
  });

  it("secret + publishable key → both sides on (the fully-configured state)", () => {
    const config = resolveStripeConfig({
      STRIPE_SECRET_KEY: "sk_test_abc",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_xyz",
    });
    expect(config.serverConfigured).toBe(true);
    expect(config.publishableKey).toBe("pk_test_xyz");
  });

  it("a publishable key WITHOUT a secret → the server is OFF (never a client-only on state)", () => {
    const config = resolveStripeConfig({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_xyz" });
    expect(config.serverConfigured).toBe(false);
    expect(config.publishableKey).toBe(null);
  });

  it("placeholder values are documentation, not configuration", () => {
    expect(resolveStripeConfig({ STRIPE_SECRET_KEY: "set-me" }).serverConfigured).toBe(false);
    expect(isRealSecret("set-me")).toBe(false);
    expect(isRealSecret("  ")).toBe(false);
    expect(isRealSecret(undefined)).toBe(false);
    expect(isRealSecret(null)).toBe(false);
    expect(isRealSecret("sk_test_real")).toBe(true);
  });

  it("the client mirror agrees with the server resolution (one truth table)", () => {
    // The page passes the server's resolution as props; the island asks the
    // mirror before loadStripe — both sides derive from isRealSecret.
    expect(isPublishableKeyConfigured(null)).toBe(false);
    expect(isPublishableKeyConfigured("pk_test_xyz")).toBe(true);
    expect(isPublishableKeyConfigured("set-me")).toBe(false);
  });
});

import Stripe from "stripe";

/**
 * The lazy server Stripe client (PAY-STRIPE-1 — ported from the reference
 * implementation).
 *
 * Config resolution lives in `src/lib/stripe-payment.ts` (the pure seam —
 * unit-pinned; the sentinel mirror keeps server and client in agreement).
 * This module owns the ONLY import of the SDK in server code, initializes
 * it lazily (the unconfigured default never constructs a client — the app
 * boots with zero Stripe dependencies in flight), and pins the integration
 * constants:
 * - API version: the SDK's pinned default (the account's version governs;
 *   pinning the literal here would drift with upgrades — the SDK types are
 *   the contract).
 * - App-name telemetry: identifies the integration in the Stripe dashboard.
 * - Webhook tolerance: 300s (the reference's pin — balances clock skew vs
 *   replay).
 */
import { resolveStripeConfig } from "./stripe-payment";

let cached: Stripe | null = null;

export function isStripeServerConfigured(): boolean {
  return resolveStripeConfig(process.env).serverConfigured;
}

/**
 * The publishable key for the client island (null when unconfigured — the
 * page passes it as a prop; the island's mirror check gates loadStripe).
 */
export function stripePublishableKey(): string | null {
  return resolveStripeConfig(process.env).publishableKey;
}

export function getStripe(): Stripe | null {
  if (!isStripeServerConfigured()) return null;
  if (cached) return cached;
  cached = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    appInfo: { name: "HomeNest Kitchen", version: "1.0.0" },
  });
  return cached;
}

/** The webhook signature tolerance (seconds) — see the module doc. */
export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

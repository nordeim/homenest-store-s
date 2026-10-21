/**
 * The client/server-safe Stripe config module (PAY-STRIPE-1 — ported from the
 * reference implementation, sessions 22+).
 *
 * ZERO runtime imports (no node:crypto, no server-only modules) — this file
 * is safe to bundle into CLIENT components and the proxy. The hashing/payment
 * seams that DO need node:crypto live in `src/lib/stripe-payment.ts`
 * (server-only), which re-exports these for convenience.
 *
 * The sentinel rule: the SERVER (STRIPE_SECRET_KEY) and CLIENT (publishable
 * key) "configured" checks share one truth table so they can never disagree —
 * a client that thinks Stripe is on while the server doesn't (or vice-versa)
 * renders a broken checkout. The "set-me" placeholder convention is honored:
 * placeholder values are NOT configuration.
 */

/** A "set-me"-style placeholder is documentation, not configuration. */
export function isRealSecret(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("set-me");
}

export type StripeConfig = {
  serverConfigured: boolean;
  publishableKey: string | null;
};

/**
 * Server-side resolution. Reads the raw env (a plain record — unit-testable);
 * the caller passes `process.env` in production code.
 */
export function resolveStripeConfig(env: Record<string, string | undefined>): StripeConfig {
  const secret = env.STRIPE_SECRET_KEY;
  const serverConfigured = isRealSecret(secret);
  const pk = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return {
    serverConfigured,
    publishableKey: serverConfigured && isRealSecret(pk) ? pk.trim() : null,
  };
}

/**
 * The CLIENT mirror: the island receives the publishable key as a prop (from
 * the server's resolution) and asks this before loadStripe — the same
 * sentinel table, so the two sides can never disagree.
 */
export function isPublishableKeyConfigured(pk: string | null | undefined): pk is string {
  return isRealSecret(pk);
}

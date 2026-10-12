/**
 * Order-access capability tokens.
 *
 * `/checkout/success` renders the full buyer receipt (email, shipping address,
 * spend). Order numbers are sequential (`ORD-YYYY-NNN`), so the page must NOT
 * trust a bare `?order=` param — a guessable number would leak every buyer's
 * PII (the same bug class the `/track-order` WI-1 fix closed).
 *
 * Instead, `/api/checkout` mints a per-order HMAC token and the success page
 * renders the receipt only for a valid `order`+`token` pair. Any other
 * combination renders the same "not found" shell, so order existence itself is
 * not observable (anti-enumeration).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { assertAuthSecret } from "./auth-secret";

// Same production gate as the session signer: never mint capability tokens
// from the public dev fallback.
assertAuthSecret({ NODE_ENV: process.env.NODE_ENV, AUTH_SECRET: process.env.AUTH_SECRET });

function authSecret(): string {
  return process.env.AUTH_SECRET || "insecure-dev-only-secret-change-me";
}

/** Mint the 128-bit hex capability token for an order number (domain-separated). */
export function orderAccessToken(orderNumber: string): string {
  return createHmac("sha256", authSecret())
    .update(`order-access:${orderNumber}`)
    .digest("hex")
    .slice(0, 32);
}

/** Timing-safe verification of an order-access token. */
export function verifyOrderAccessToken(orderNumber: string, token: string): boolean {
  const expected = Buffer.from(orderAccessToken(orderNumber));
  const provided = Buffer.from(typeof token === "string" ? token : "");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

/**
 * Ownership gate for idempotent-checkout replays (session-6 S6-8). A user
 * order replays only for the same signed-in user; a guest order only with
 * the same cart-token cookie. Legacy rows (no binding recorded) deny — the
 * checkout route falls through to the normal flow, which 409s on an empty
 * cart without leaking the order's existence. Pure, unit-pinned in
 * tests/unit/order-access.test.ts.
 */
export function replayAuthorized(
  orderUserId: string | null,
  orderCartToken: string | null,
  requestUserId: string | null,
  requestCartToken: string | null,
): boolean {
  if (orderUserId) return orderUserId === requestUserId;
  return orderCartToken !== null && orderCartToken === requestCartToken;
}

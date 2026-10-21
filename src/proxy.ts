import { NextRequest, NextResponse } from "next/server";
import { resolveStripeConfig } from "@/lib/stripe-config";
import { buildCsp } from "@/lib/csp";

/**
 * Content-Security-Policy with a per-request nonce — superset hardening.
 *
 * File convention: Next 16 deprecated the `middleware` filename in favor of
 * `proxy` (same request/matcher API).
 *
 * Mechanism (the documented Next.js pattern): generate a nonce per request,
 * set the full CSP as a REQUEST header — Next parses it and applies the
 * nonce to every bootstrap/flight <script> it renders — and as a RESPONSE
 * header for browser enforcement. The matcher excludes hashed static assets.
 *
 * The Stripe retrofit (PAY-STRIPE-1): when (and only when) Stripe is
 * configured, the directive set gains the Payment Element hosts —
 * js.stripe.com (the element iframe + stripe.js), hooks.stripe.com (the
 * iframe's inner frames), api.stripe.com (connect-src — the SDK's API
 * calls). With Stripe unconfigured (the default) the CSP string is
 * byte-identical to the pre-retrofit pin.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== "production",
    stripeConfigured: resolveStripeConfig(process.env).serverConfigured,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|images/|fonts/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
    },
  ],
};

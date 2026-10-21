/**
 * CSP builder — the pure seam behind src/proxy.ts. Production form:
 *
 *   script-src 'self' 'nonce-…' 'strict-dynamic';
 *   style-src 'self' 'unsafe-inline';
 *   img-src 'self' data:;
 *   font-src 'self';
 *   connect-src 'self';
 *   frame-ancestors 'none';
 *   object-src 'none';
 *   base-uri 'self';
 *   form-action 'self'
 *
 * DEV MODE ONLY: script-src additionally carries 'unsafe-eval' — React's dev
 * builds require eval(); production never carries the token.
 *
 * Stripe-configured mode (the Stripe retrofit, PAY-STRIPE-1): script-src
 * gains the js.stripe.com host (ignored by strict-dynamic-capable browsers;
 * the fallback for the rest), connect-src gains api.stripe.com, and
 * frame-src (js.stripe.com + hooks.stripe.com) is appended — the Payment
 * Element iframe family. UNCONFIGURED (the default) the string is
 * byte-identical to the pre-retrofit pin — the standing CSP tests stay
 * green and the demo path is unchanged.
 */

export type CspInput = {
  nonce: string;
  isDev: boolean;
  /** True when Stripe keys are configured (the env gate). Optional for the
   *  unconfigured callers — the byte-identical default. */
  stripeConfigured?: boolean;
};

export function buildCsp({ nonce, isDev, stripeConfigured = false }: CspInput): string {
  const scriptSrc = [
    isDev
      ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
      : `'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // The Stripe host allowlist: ignored by strict-dynamic-capable browsers —
    // it remains the fallback for the rest.
    ...(stripeConfigured ? ["https://js.stripe.com"] : []),
  ].join(" ");
  const parts = [
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  if (stripeConfigured) {
    // The Payment Element family: the SDK's API calls + the element iframe's
    // inner frames.
    parts[4] = "connect-src 'self' https://api.stripe.com";
    parts.push("frame-src https://js.stripe.com https://hooks.stripe.com");
  }
  return parts.join("; ");
}

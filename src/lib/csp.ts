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
 */

export type CspInput = {
  nonce: string;
  isDev: boolean;
};

export function buildCsp({ nonce, isDev }: CspInput): string {
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

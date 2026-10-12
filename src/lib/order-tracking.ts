/**
 * Order-tracking access control — the pure seam for `/track-order`.
 *
 * Order numbers are sequential and printed on every confirmation page, so the
 * number alone must never unlock a customer's PII. Tracking requires the
 * order number PLUS the email used at checkout (case-insensitive). A mismatch
 * is indistinguishable from "order not found" to keep enumeration pointless.
 */

/** Trim + lowercase an optional email into a comparable form. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Whether `candidate` unlocks an order placed with `orderEmail`.
 * Empty on either side never matches (default-deny).
 */
export function emailsMatch(orderEmail: string, candidate: string | null | undefined): boolean {
  const a = normalizeEmail(orderEmail);
  const b = normalizeEmail(candidate);
  return a.length > 0 && b.length > 0 && a === b;
}

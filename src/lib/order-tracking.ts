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

// ---------------------------------------------------------------------------
// Session-11 S11-4 — guarded carrier-tracking write
// ---------------------------------------------------------------------------

/** Thrown when the guarded tracking update lands on zero rows (order gone). */
export class OrderGoneError extends Error {
  constructor() {
    super("Order not found. Refresh the list.");
    this.name = "OrderGoneError";
  }
}

/** Minimal Prisma surface `applyCarrierTracking` touches — fake-testable. */
export type TrackingClient = {
  order: {
    updateMany(args: {
      where: { id: string };
      data: { carrier: string; trackingNumber: string };
    }): Promise<{ count: number }>;
  };
  orderEvent: {
    create(args: {
      data: { orderId: string; type: string; note: string };
    }): Promise<unknown>;
  };
};

/**
 * Stamp carrier tracking onto an order and record the event — the write is
 * its own guard (the S9-2/S9-3 pattern): a scoped conditional `updateMany`
 * runs FIRST and `count === 0` throws OrderGoneError with NO event written,
 * so a concurrent order delete can never produce a tracking event for a row
 * that no longer exists (nor surface a raw P2025 to the admin UI).
 */
export async function applyCarrierTracking(
  client: TrackingClient,
  orderId: string,
  carrier: string,
  trackingNumber: string,
): Promise<void> {
  const result = await client.order.updateMany({
    where: { id: orderId },
    data: { carrier, trackingNumber },
  });
  if (result.count === 0) throw new OrderGoneError();
  await client.orderEvent.create({
    data: {
      orderId,
      type: "tracking_added",
      note: `Tracking added: ${carrier} · ${trackingNumber}`,
    },
  });
}

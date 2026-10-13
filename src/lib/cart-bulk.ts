/**
 * Bulk cart planning (session-9 S9-8).
 *
 * POST /api/cart/bulk applies the SAME per-line clamp as the single-add POST
 * (stock ceiling + 99 cap) inside one transaction. The two pure helpers below
 * pin the branches the route used to carry inline: dedupe-summing a
 * duplicated payload (so a repeated wishlist entry cannot double-count) and
 * planning each line's final quantity against live stock.
 */

import { clampPurchaseQuantity } from "./cart-quantity";

/**
 * Collapse `[productId, quantity]` items into one wanted quantity per
 * product. Repeated ids SUM (a duplicated wishlist entry means "want it
 * more", not "want it twice"), with the same 99 ceiling the cart enforces —
 * the per-line stock clamp runs later, at plan time.
 */
export function dedupeBulkWanted(
  items: ReadonlyArray<{ productId: string; quantity: number }>,
): Map<string, number> {
  const wanted = new Map<string, number>();
  for (const item of items) {
    wanted.set(item.productId, Math.min((wanted.get(item.productId) ?? 0) + item.quantity, 99));
  }
  return wanted;
}

/**
 * Final upsert quantity for one line: existing cart quantity + wanted,
 * clamped to the live stock (which also enforces the 99 ceiling and drops
 * sold-out lines to 0 — the caller skips those).
 */
export function planBulkUpsertQuantity(existingQuantity: number, wanted: number, stock: number): number {
  return clampPurchaseQuantity(existingQuantity + wanted, stock);
}

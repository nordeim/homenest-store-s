// ---------------------------------------------------------------------------
// Guest-cart → user-cart merge planner (session-5 audit S5-7). The merge in
// `src/lib/cart.ts` used to be a non-atomic upsert loop with an increment
// update — un-unit-testable and half-mergeable on failure. The planner below
// is pure (unit-pinned in tests/unit/cart-merge.test.ts); the caller applies
// the plan as idempotent final-quantity upserts inside ONE transaction.
// ---------------------------------------------------------------------------

export type MergeLine = { productId: string; quantity: number };

/** The 99-per-line cart ceiling — must stay in sync with clampPurchaseQuantity. */
const MAX_LINE_QUANTITY = 99;

/**
 * Merge the guest cart's lines into the user cart's lines.
 *
 * Returns the FINAL per-product quantity map (user lines keep their insertion
 * order, guest-only lines are appended in guest order). A product present in
 * both carts sums; a sum that lands at 0 or below is dropped entirely (the
 * zero-quantity-lines invariant); any sum above the 99-per-line ceiling clamps.
 */
export function computeMergedQuantities(
  ownLines: MergeLine[],
  guestLines: MergeLine[],
): Map<string, number> {
  const merged = new Map<string, number>();

  for (const line of ownLines) {
    if (line.quantity > 0) merged.set(line.productId, line.quantity);
  }

  for (const line of guestLines) {
    const current = merged.get(line.productId);
    if (current === undefined) {
      if (line.quantity > 0) merged.set(line.productId, line.quantity);
      continue;
    }
    const next = current + line.quantity;
    if (next <= 0) {
      merged.delete(line.productId);
      continue;
    }
    merged.set(line.productId, Math.min(next, MAX_LINE_QUANTITY));
  }

  return merged;
}

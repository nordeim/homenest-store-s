import { MAX_CART_QUANTITY } from "./cart-quantity";

// ---------------------------------------------------------------------------
// Guest-cart → user-cart merge planner (session-5 audit S5-7). The merge in
// `src/lib/cart.ts` used to be a non-atomic upsert loop with an increment
// update — un-unit-testable and half-mergeable on failure. The planner below
// is pure (unit-pinned in tests/unit/cart-merge.test.ts); the caller applies
// the plan as idempotent final-quantity upserts inside ONE transaction.
// ---------------------------------------------------------------------------

export type MergeLine = { productId: string; quantity: number };

/** The 99-per-line cart ceiling — single-sourced from cart-quantity (S17-2). */
const MAX_LINE_QUANTITY = MAX_CART_QUANTITY;

/**
 * Merge the guest cart's lines into the user cart's lines.
 *
 * Returns the FINAL per-product quantity map (user lines keep their insertion
 * order, guest-only lines are appended in guest order). A product present in
 * both carts sums; a sum that lands at 0 or below is dropped entirely (the
 * zero-quantity-lines invariant); any sum above the 99-per-line ceiling clamps.
 *
 * `stockById` (session-6 S6-6) adds the third clamp dimension: when the caller
 * provides current product stock, every plan line clamps to the tightest of
 * (sum, 99 ceiling, stock) — a merged cart can never contain a line that is
 * guaranteed to 409 at checkout, and a line whose stock has dropped to 0 is
 * dropped rather than merged in. Products missing from the map keep the
 * ceiling-only behavior (unknown stock = no opinion).
 */
export function computeMergedQuantities(
  ownLines: MergeLine[],
  guestLines: MergeLine[],
  stockById?: Map<string, number>,
): Map<string, number> {
  const merged = new Map<string, number>();
  const ownRaw = new Map(ownLines.map((l) => [l.productId, l.quantity]));

  const clamp = (productId: string, quantity: number): number => {
    const capped = Math.min(quantity, MAX_LINE_QUANTITY);
    const stock = stockById?.get(productId);
    return stock === undefined ? capped : Math.min(capped, Math.max(0, stock));
  };

  for (const line of ownLines) {
    if (line.quantity <= 0) continue;
    const clamped = clamp(line.productId, line.quantity);
    // A zero-stock product drops the line entirely (zero-quantity lines cannot exist).
    if (clamped <= 0) merged.delete(line.productId);
    else merged.set(line.productId, clamped);
  }

  for (const line of guestLines) {
    const current = merged.get(line.productId);
    if (current === undefined) {
      if (line.quantity > 0) {
        const clamped = clamp(line.productId, line.quantity);
        if (clamped > 0) merged.set(line.productId, clamped);
      }
      continue;
    }
    // Sum against the UNCLAMPED own quantity so re-clamping sees the real sum.
    const next = (ownRaw.get(line.productId) ?? current) + line.quantity;
    if (next <= 0) {
      merged.delete(line.productId);
      continue;
    }
    const clamped = clamp(line.productId, next);
    if (clamped <= 0) merged.delete(line.productId);
    else merged.set(line.productId, clamped);
  }

  return merged;
}

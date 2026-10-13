/**
 * Cart quantity clamping — the pure seam shared by the cart PATCH route and
 * the checkout guards. A clamped quantity of 0 means "no purchasable line":
 * callers must DELETE the line rather than persist quantity 0, and checkout
 * must never build an order item from it (a $0 item would still accrue
 * shipping/tax).
 */

/**
 * The per-line cart ceiling (session-17 S17-2): the authoritative constant
 * the clamp, the cart Zod schemas (.max), the purchase-panel stepper max and
 * the header "99+" badge flip all consume — retyping the literal elsewhere
 * lets the display surfaces drift from the server clamp.
 */
export const MAX_CART_QUANTITY = 99;

/**
 * Clamp a requested quantity to the purchasable range for the given stock.
 * `stock === null` means the product no longer exists → 0.
 * Always returns an integer in [0, MAX_CART_QUANTITY]; 0 = "no purchase".
 */
export function clampPurchaseQuantity(requested: number, stock: number | null): number {
  const qty = Math.floor(requested);
  if (!Number.isFinite(qty) || qty < 1) return 0;
  if (stock === null || stock <= 0) return 0;
  return Math.min(qty, stock, MAX_CART_QUANTITY);
}

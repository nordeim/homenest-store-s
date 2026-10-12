/**
 * Cart quantity clamping — the pure seam shared by the cart PATCH route and
 * the checkout guards. A clamped quantity of 0 means "no purchasable line":
 * callers must DELETE the line rather than persist quantity 0, and checkout
 * must never build an order item from it (a $0 item would still accrue
 * shipping/tax).
 */

/**
 * Clamp a requested quantity to the purchasable range for the given stock.
 * `stock === null` means the product no longer exists → 0.
 * Always returns an integer in [0, 99]; 0 = "no purchase".
 */
export function clampPurchaseQuantity(requested: number, stock: number | null): number {
  const qty = Math.floor(requested);
  if (!Number.isFinite(qty) || qty < 1) return 0;
  if (stock === null || stock <= 0) return 0;
  return Math.min(qty, stock, 99);
}

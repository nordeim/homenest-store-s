import { ORDER_STATUSES } from "./validation";

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Order status workflow rules (shared by the admin action and its tests).
 *
 * - `cancelled` is TERMINAL — a cancelled order can never be reopened
 *   (restocking has already run; reopening would double-sell the inventory).
 * - `delivered` is TERMINAL — fulfillment is complete; no going back.
 * - Same-status transitions are no-ops and rejected (no duplicate events).
 */
export function canTransitionOrderStatus(from: string, to: string): boolean {
  const statuses: readonly string[] = ORDER_STATUSES;
  if (!statuses.includes(from) || !statuses.includes(to)) return false;
  if (from === "cancelled" || from === "delivered") return false;
  if (from === to) return false;
  return true;
}

/**
 * Restock exactly once, exactly when a live order transitions into
 * `cancelled`. Already-cancelled orders (terminal) never restock again.
 */
export function shouldRestockOnStatusChange(from: string, to: string): boolean {
  return from !== "cancelled" && to === "cancelled";
}

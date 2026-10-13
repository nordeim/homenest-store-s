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

/**
 * Minimal shape of a Prisma transaction client that
 * `applyOrderStatusTransition` touches — keeps the helper unit-testable with
 * an in-memory fake and forces the caller to own the transaction boundary.
 */
export interface OrderTransitionClient {
  order: {
    updateMany: (args: {
      where: { id: string; status: string };
      data: { status: string };
    }) => Promise<{ count: number }>;
  };
  orderEvent: {
    create: (args: {
      data: { orderId: string; type: string; status: string; note: string };
    }) => Promise<unknown>;
  };
  product: {
    updateMany: (args: {
      where: { id: string };
      data: { stock: { increment: number } };
    }) => Promise<unknown>;
  };
}

/** The order shape the caller must pass — read INSIDE the same transaction. */
export interface TransitionOrder {
  id: string;
  status: string;
  items: { productId: string | null; quantity: number }[];
}

/**
 * Apply one order-status transition race-safe (session-9 S9-2).
 *
 * The STATUS WRITE IS THE GUARD: `updateMany({ where: { id, status: from } })`
 * only wins when the order is still in the state the caller read. Two admins
 * who both read `pending` and submit `cancelled` can no longer BOTH restock —
 * the first write flips the status, the second finds `count === 0` and gets
 * `{ applied: false }` with NO event and NO restock. The event + restock are
 * derived from the guarded winner, never from the pre-transaction read.
 *
 * `order.status` MUST come from a `findUnique` inside the same `$transaction`
 * (the pre-transaction read is a fast-fail UX check only). The caller checks
 * `canTransitionOrderStatus` for the user-facing message; this helper treats
 * the guarded write as the single source of truth.
 */
export async function applyOrderStatusTransition(
  client: OrderTransitionClient,
  order: TransitionOrder,
  target: string,
  note?: string,
): Promise<{ applied: boolean }> {
  const guarded = await client.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: target },
  });
  if (guarded.count === 0) {
    return { applied: false }; // a concurrent transition won — write nothing
  }
  const restock = shouldRestockOnStatusChange(order.status, target);
  await client.orderEvent.create({
    data: {
      orderId: order.id,
      type: "status_changed",
      status: target,
      note: note || `Status updated to ${target}.${restock ? " Stock restored." : ""}`,
    },
  });
  if (restock) {
    for (const item of order.items) {
      if (!item.productId) continue; // deleted product — nothing to restore
      await client.product.updateMany({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
  return { applied: true };
}

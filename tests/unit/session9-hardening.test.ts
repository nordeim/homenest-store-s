import { describe, expect, it } from "vitest";

import { AddressGoneError, promoteAddressInTx } from "@/lib/addresses";
import { dedupeBulkWanted, planBulkUpsertQuantity } from "@/lib/cart-bulk";
import { buildRevenueChart } from "@/lib/analytics";
import { applyOrderStatusTransition } from "@/lib/order-status";

// ---------------------------------------------------------------------------
// S9-2 — guarded, transactional order-status transition
// ---------------------------------------------------------------------------

type TransitionCalls = {
  guards: Array<{ where: { id: string; status: string }; data: { status: string } }>;
  events: Array<{ orderId: string; type: string; status: string; note: string }>;
  restocks: Array<{ id: string; increment: number }>;
};

/** In-memory fake of the minimal Prisma surface applyOrderStatusTransition touches. */
function makeFakeTransitionClient(count: number) {
  const calls: TransitionCalls = { guards: [], events: [], restocks: [] };
  const client = {
    order: {
      updateMany: async (args: { where: { id: string; status: string }; data: { status: string } }) => {
        calls.guards.push(args);
        return { count };
      },
    },
    orderEvent: {
      create: async (args: { data: { orderId: string; type: string; status: string; note: string } }) => {
        calls.events.push(args.data);
        return args.data;
      },
    },
    product: {
      updateMany: async (args: { where: { id: string }; data: { stock: { increment: number } } }) => {
        calls.restocks.push({ id: args.where.id, increment: args.data.stock.increment });
        return args;
      },
    },
  };
  return { client, calls };
}

const PENDING_ORDER = {
  id: "order-1",
  status: "pending",
  items: [
    { productId: "prod-a", quantity: 2 },
    { productId: "prod-b", quantity: 1 },
  ],
};

describe("applyOrderStatusTransition (S9-2)", () => {
  it("wins the guarded write, then creates the event and restocks exactly once", async () => {
    const { client, calls } = makeFakeTransitionClient(1);
    const result = await applyOrderStatusTransition(client, PENDING_ORDER, "cancelled");
    expect(result).toEqual({ applied: true });
    // The write is conditional on the status the caller read INSIDE the tx.
    expect(calls.guards).toEqual([{ where: { id: "order-1", status: "pending" }, data: { status: "cancelled" } }]);
    expect(calls.events).toHaveLength(1);
    expect(calls.events[0]?.type).toBe("status_changed");
    expect(calls.events[0]?.status).toBe("cancelled");
    expect(calls.events[0]?.note).toContain("Stock restored.");
    expect(calls.restocks).toEqual([
      { id: "prod-a", increment: 2 },
      { id: "prod-b", increment: 1 },
    ]);
  });

  it("loses the guarded write (concurrent transition) — no event, no restock", async () => {
    const { client, calls } = makeFakeTransitionClient(0);
    const result = await applyOrderStatusTransition(client, PENDING_ORDER, "cancelled");
    expect(result).toEqual({ applied: false });
    expect(calls.events).toHaveLength(0);
    expect(calls.restocks).toHaveLength(0);
  });

  it("does not restock on non-cancellation transitions and keeps the plain note", async () => {
    const { client, calls } = makeFakeTransitionClient(1);
    await applyOrderStatusTransition(client, PENDING_ORDER, "shipped", "Carrier picked up.");
    expect(calls.restocks).toHaveLength(0);
    expect(calls.events[0]?.note).toBe("Carrier picked up.");
  });

  it("skips items whose product was deleted (null productId)", async () => {
    const { client, calls } = makeFakeTransitionClient(1);
    await applyOrderStatusTransition(
      client,
      { id: "order-2", status: "processing", items: [{ productId: null, quantity: 3 }, { productId: "prod-c", quantity: 4 }] },
      "cancelled",
    );
    expect(calls.restocks).toEqual([{ id: "prod-c", increment: 4 }]);
  });
});

// ---------------------------------------------------------------------------
// S9-3 — race-safe address default promotion
// ---------------------------------------------------------------------------

type AddressCalls = {
  updates: Array<{ where: unknown; data: { isDefault: boolean } }>;
};

/** In-memory fake of the minimal Prisma surface promoteAddressInTx touches. */
function makeFakeAddressClient(promoteCount: number) {
  const calls: AddressCalls = { updates: [] };
  const client = {
    address: {
      updateMany: async (args: { where: unknown; data: { isDefault: boolean } }) => {
        calls.updates.push(args);
        // The promote call (isDefault: true) reports the injected count;
        // the unset-others call (isDefault: false) always succeeds.
        return { count: args.data.isDefault ? promoteCount : 1 };
      },
    },
  };
  return { client, calls };
}

describe("promoteAddressInTx (S9-3)", () => {
  it("promotes the row first (scoped to the owner), then unsets the others", async () => {
    const { client, calls } = makeFakeAddressClient(1);
    await promoteAddressInTx(client, "user-1", "addr-1");
    expect(calls.updates).toHaveLength(2);
    expect(calls.updates[0]).toEqual({ where: { id: "addr-1", userId: "user-1" }, data: { isDefault: true } });
    expect(calls.updates[1]).toEqual({ where: { userId: "user-1", id: { not: "addr-1" } }, data: { isDefault: false } });
  });

  it("aborts without touching other defaults when the row is gone (concurrent delete)", async () => {
    const { client, calls } = makeFakeAddressClient(0);
    await expect(promoteAddressInTx(client, "user-1", "addr-gone")).rejects.toBeInstanceOf(AddressGoneError);
    expect(calls.updates).toHaveLength(1); // promote attempted, unset-others never ran
  });
});

// ---------------------------------------------------------------------------
// S9-4 — bounded dashboard revenue chart
// ---------------------------------------------------------------------------

describe("buildRevenueChart (S9-4)", () => {
  const now = new Date("2026-10-13T15:30:00.000Z");

  it("folds SQL day buckets into exactly 14 points ending today (UTC)", () => {
    const points = buildRevenueChart(
      [
        { day: "2026-10-13", revenue: 5000 },
        { day: "2026-10-11", revenue: 1200 },
      ],
      now,
    );
    expect(points).toHaveLength(14);
    expect(points[13]).toEqual({ date: "Oct 13", revenue: 5000 });
    expect(points[11]).toEqual({ date: "Oct 11", revenue: 1200 });
  });

  it("zero-fills days with no orders", () => {
    const points = buildRevenueChart([{ day: "2026-10-13", revenue: 5000 }], now);
    expect(points[12]).toEqual({ date: "Oct 12", revenue: 0 });
    expect(points[0]).toEqual({ date: "Sep 30", revenue: 0 });
  });

  it("normalizes SQL numbers/bigints and sums duplicate-day rows defensively", () => {
    const points = buildRevenueChart(
      [
        { day: "2026-10-13", revenue: 1000 },
        { day: "2026-10-13", revenue: 250 },
      ],
      now,
    );
    expect(points[13]?.revenue).toBe(1250);
  });

  it("accepts null SQL sums as zero", () => {
    const points = buildRevenueChart([{ day: "2026-10-13", revenue: null }], now);
    expect(points[13]?.revenue).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// S9-8 — bulk cart plan (dedupe + clamp), extracted pure
// ---------------------------------------------------------------------------

describe("dedupeBulkWanted (S9-8)", () => {
  it("sums repeated product ids into one wanted quantity", () => {
    const wanted = dedupeBulkWanted([
      { productId: "a", quantity: 2 },
      { productId: "a", quantity: 1 },
      { productId: "b", quantity: 1 },
    ]);
    expect(wanted.get("a")).toBe(3);
    expect(wanted.get("b")).toBe(1);
  });

  it("caps a duplicated product's summed quantity at 99", () => {
    const wanted = dedupeBulkWanted([
      { productId: "a", quantity: 60 },
      { productId: "a", quantity: 60 },
    ]);
    expect(wanted.get("a")).toBe(99);
  });

  it("preserves first-seen insertion order", () => {
    const wanted = dedupeBulkWanted([
      { productId: "b", quantity: 1 },
      { productId: "a", quantity: 1 },
    ]);
    expect(Array.from(wanted.keys())).toEqual(["b", "a"]);
  });
});

describe("planBulkUpsertQuantity (S9-8)", () => {
  it("adds the wanted quantity onto the existing line", () => {
    expect(planBulkUpsertQuantity(2, 1, 10)).toBe(3);
  });

  it("clamps to live stock", () => {
    expect(planBulkUpsertQuantity(0, 5, 3)).toBe(3);
  });

  it("plans 0 for a sold-out product (skip branch)", () => {
    expect(planBulkUpsertQuantity(0, 5, 0)).toBe(0);
  });

  it("keeps the 99 ceiling even when stock allows more", () => {
    expect(planBulkUpsertQuantity(95, 10, 1000)).toBe(99);
  });
});

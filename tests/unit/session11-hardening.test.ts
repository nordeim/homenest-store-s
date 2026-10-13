import { describe, expect, it } from "vitest";

import { reviewRateLimitKeys } from "@/lib/rate-limit";
import { OrderGoneError, applyCarrierTracking } from "@/lib/order-tracking";

// ---------------------------------------------------------------------------
// S11-1 — two-tier review budget: a per-IP ceiling bounds author rotation
// ---------------------------------------------------------------------------

describe("reviewRateLimitKeys", () => {
  it("derives a per-IP key that carries NO author component", () => {
    const a = reviewRateLimitKeys("1.2.3.4", "p1", "Alice");
    const b = reviewRateLimitKeys("1.2.3.4", "p1", "Bob");
    // Rotating the author string must NOT mint a fresh per-IP budget.
    expect(a.ipKey).toBe(b.ipKey);
    expect(a.ipKey).toBe("review-ip:1.2.3.4");
    expect(a.ipKey).not.toContain("Alice");
    expect(a.ipKey).not.toContain("p1");
  });

  it("keeps the per-author key product-scoped and case-normalized", () => {
    const key = reviewRateLimitKeys("1.2.3.4", "prod-1", "Alice");
    expect(key.authorKey).toBe("review:1.2.3.4:prod-1:alice");

    const otherProduct = reviewRateLimitKeys("1.2.3.4", "prod-2", "Alice");
    const otherIp = reviewRateLimitKeys("5.6.7.8", "prod-1", "Alice");
    expect(otherProduct.authorKey).not.toBe(key.authorKey);
    expect(otherIp.authorKey).not.toBe(key.authorKey);
  });

  it("treats author case variants as one budget", () => {
    const a = reviewRateLimitKeys("1.2.3.4", "p1", "Alice");
    const b = reviewRateLimitKeys("1.2.3.4", "p1", "ALICE");
    expect(a.authorKey).toBe(b.authorKey);
  });
});

// ---------------------------------------------------------------------------
// S11-4 — guarded carrier-tracking write (no raw P2025 on a lost order)
// ---------------------------------------------------------------------------

type TrackingCalls = {
  updateMany: Array<{
    where: { id: string };
    data: { carrier: string; trackingNumber: string };
  }>;
  events: Array<{ data: { orderId: string; type: string; note: string } }>;
};

/** In-memory fake of the minimal Prisma surface applyCarrierTracking touches. */
function makeFakeTrackingClient(count: number) {
  const calls: TrackingCalls = { updateMany: [], events: [] };
  const client = {
    order: {
      updateMany: async (args: {
        where: { id: string };
        data: { carrier: string; trackingNumber: string };
      }) => {
        calls.updateMany.push(args);
        return { count };
      },
    },
    orderEvent: {
      create: async (args: { data: { orderId: string; type: string; note: string } }) => {
        calls.events.push(args);
        return {};
      },
    },
  };
  return { client, calls };
}

describe("applyCarrierTracking", () => {
  it("writes the guarded update first, then the event from the guarded winner", async () => {
    const { client, calls } = makeFakeTrackingClient(1);
    await applyCarrierTracking(client, "ord-1", "UPS", "1Z999AA10123456784");

    expect(calls.updateMany).toEqual([
      { where: { id: "ord-1" }, data: { carrier: "UPS", trackingNumber: "1Z999AA10123456784" } },
    ]);
    expect(calls.events).toEqual([
      {
        data: {
          orderId: "ord-1",
          type: "tracking_added",
          note: "Tracking added: UPS · 1Z999AA10123456784",
        },
      },
    ]);
  });

  it("throws OrderGoneError and creates NO event when the order vanished", async () => {
    const { client, calls } = makeFakeTrackingClient(0);
    await expect(applyCarrierTracking(client, "ord-gone", "UPS", "1Z")).rejects.toBeInstanceOf(
      OrderGoneError,
    );
    expect(calls.updateMany).toHaveLength(1);
    expect(calls.events).toHaveLength(0);
  });

  it("carries the friendly, actionable message the admin action surfaces", async () => {
    const { client } = makeFakeTrackingClient(0);
    await expect(applyCarrierTracking(client, "ord-gone", "UPS", "1Z")).rejects.toThrow(
      "Order not found. Refresh the list.",
    );
  });
});

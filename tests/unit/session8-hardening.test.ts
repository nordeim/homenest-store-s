import { describe, expect, it } from "vitest";

import { isUniqueViolation, uniqueTargetField } from "@/lib/prisma-errors";
import { growReviewAggregate } from "@/lib/review-aggregate";
import { assertWishlistCap, MAX_WISHLIST_ITEMS, WishlistCapError } from "@/lib/wishlist";
import { cartBulkSchema } from "@/lib/validation";

// ---------------------------------------------------------------------------
// S8-2 — transactional review aggregate growth
// ---------------------------------------------------------------------------

/** In-memory fake of the minimal Prisma client surface growReviewAggregate touches. */
function makeFakeProductClient(baseline: { rating: number; reviewCount: number } | null) {
  const calls: { read: number; writes: Array<{ rating: number; reviewCount: number }> } = { read: 0, writes: [] };
  const client = {
    product: {
      findUnique: async () => {
        calls.read += 1;
        return baseline ? { rating: baseline.rating, reviewCount: baseline.reviewCount } : null;
      },
      update: async ({ data }: { data: { rating: number; reviewCount: number } }) => {
        calls.writes.push(data);
        return data;
      },
    },
  };
  return { client, calls };
}

describe("growReviewAggregate (S8-2)", () => {
  it("reads the live baseline, merges, and writes the grown aggregate", async () => {
    const { client, calls } = makeFakeProductClient({ rating: 4.6, reviewCount: 100 });
    await growReviewAggregate(client, "prod-1", 5);
    expect(calls.read).toBe(1);
    expect(calls.writes).toHaveLength(1);
    expect(calls.writes[0]?.reviewCount).toBe(101);
    expect(calls.writes[0]?.rating).toBeCloseTo((4.6 * 100 + 5) / 101, 1);
  });

  it("writes nothing when the product row vanished mid-flight", async () => {
    const { client, calls } = makeFakeProductClient(null);
    await growReviewAggregate(client, "prod-gone", 4);
    expect(calls.writes).toHaveLength(0);
  });

  it("propagates the merge guard for an out-of-range rating", async () => {
    const { client } = makeFakeProductClient({ rating: 4, reviewCount: 2 });
    await expect(growReviewAggregate(client, "prod-1", 9)).rejects.toThrow(/Invalid review rating/);
  });
});

// ---------------------------------------------------------------------------
// S8-3 — tolerant P2002 target matching
// ---------------------------------------------------------------------------

function p2002(target: unknown): { code: string; meta: { target: unknown } } {
  return { code: "P2002", meta: { target } };
}

describe("prisma-errors helpers (S8-3)", () => {
  it("isUniqueViolation is true only for code P2002", () => {
    expect(isUniqueViolation(p2002(["number"]))).toBe(true);
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it("uniqueTargetField matches field-array targets (the current SQLite shape)", () => {
    expect(uniqueTargetField(p2002(["idempotencyKey"]), "idempotencyKey")).toBe(true);
    expect(uniqueTargetField(p2002(["Order.idempotencyKey"]), "idempotencyKey")).toBe(true);
    expect(uniqueTargetField(p2002(["number"]), "idempotencyKey")).toBe(false);
  });

  it("uniqueTargetField matches bare-string field targets", () => {
    expect(uniqueTargetField(p2002("idempotencyKey"), "idempotencyKey")).toBe(true);
  });

  it("uniqueTargetField matches constraint-NAME string targets (the latent engine shape)", () => {
    expect(uniqueTargetField(p2002("Order_idempotencyKey_key"), "idempotencyKey")).toBe(true);
  });

  it("uniqueTargetField does not cross-match other constraints", () => {
    expect(uniqueTargetField(p2002("Order_number_key"), "idempotencyKey")).toBe(false);
    expect(uniqueTargetField(p2002("Order_idempotencyKey_key"), "number")).toBe(false);
  });

  it("uniqueTargetField returns false for non-P2002 errors and odd shapes", () => {
    expect(uniqueTargetField({ code: "P2002" }, "idempotencyKey")).toBe(false);
    expect(uniqueTargetField(p2002(42), "idempotencyKey")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// S8-6 — wishlist cap
// ---------------------------------------------------------------------------

function makeFakeWishlistClient(count: number) {
  return {
    wishlistItem: {
      count: async () => count,
    },
  };
}

describe("wishlist cap (S8-6)", () => {
  it("exposes MAX_WISHLIST_ITEMS = 100", () => {
    expect(MAX_WISHLIST_ITEMS).toBe(100);
  });

  it("passes under the cap", async () => {
    await expect(assertWishlistCap(makeFakeWishlistClient(99), "w1")).resolves.toBeUndefined();
  });

  it("throws WishlistCapError at the cap", async () => {
    const error = await assertWishlistCap(makeFakeWishlistClient(100), "w1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WishlistCapError);
    expect((error as WishlistCapError).message).toMatch(/100/);
  });
});

// ---------------------------------------------------------------------------
// S8-6 — bulk cart schema
// ---------------------------------------------------------------------------

describe("cartBulkSchema (S8-6)", () => {
  it("accepts a bounded list of lines", () => {
    const parsed = cartBulkSchema.safeParse({ items: [{ productId: "p1", quantity: 2 }, { productId: "p2", quantity: 1 }] });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty lists and oversized lists", () => {
    expect(cartBulkSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      cartBulkSchema.safeParse({ items: Array.from({ length: 101 }, (_, i) => ({ productId: `p${i}`, quantity: 1 })) })
        .success,
    ).toBe(false);
  });

  it("rejects bad quantities and missing product ids", () => {
    expect(cartBulkSchema.safeParse({ items: [{ productId: "p1", quantity: 0 }] }).success).toBe(false);
    expect(cartBulkSchema.safeParse({ items: [{ productId: "p1", quantity: 100 }] }).success).toBe(false);
    expect(cartBulkSchema.safeParse({ items: [{ quantity: 1 }] }).success).toBe(false);
  });
});

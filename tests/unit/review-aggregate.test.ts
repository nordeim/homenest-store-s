import { describe, expect, it } from "vitest";

import { mergeReviewAggregate } from "@/lib/review-aggregate";

describe("mergeReviewAggregate", () => {
  it("grows the count and keeps the rating when the baseline is flat", () => {
    const next = mergeReviewAggregate({ rating: 4.6, reviewCount: 100 }, 5);
    expect(next.reviewCount).toBe(101);
    expect(next.rating).toBeCloseTo((4.6 * 100 + 5) / 101, 1);
  });

  it("rounds the weighted average to one decimal", () => {
    // 4.5 * 10 + 1 = 46; 46 / 11 = 4.1818... → 4.2
    const next = mergeReviewAggregate({ rating: 4.5, reviewCount: 10 }, 1);
    expect(next.rating).toBe(4.2);
    expect(next.reviewCount).toBe(11);
  });

  it("returns just the new rating when the baseline is empty", () => {
    const next = mergeReviewAggregate({ rating: 0, reviewCount: 0 }, 4);
    expect(next).toEqual({ rating: 4, reviewCount: 1 });
  });

  it("never decreases the displayed count (the seeded-parity collapse bug)", () => {
    // A product seeded with reference-parity counts (41+ reviews) must grow,
    // never collapse to the number of stored Review rows.
    const next = mergeReviewAggregate({ rating: 4.8, reviewCount: 412 }, 3);
    expect(next.reviewCount).toBe(413);
    expect(next.rating).toBeGreaterThan(4);
  });

  it("clamps out-of-range ratings defensively", () => {
    expect(() => mergeReviewAggregate({ rating: 4, reviewCount: 10 }, 9)).toThrow();
    expect(() => mergeReviewAggregate({ rating: 4, reviewCount: 10 }, 0)).toThrow();
  });
});

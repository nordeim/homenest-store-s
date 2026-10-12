import { describe, expect, it } from "vitest";

import { computeMergedQuantities } from "@/lib/cart-merge";

describe("computeMergedQuantities", () => {
  it("sums per-product quantities across the user cart and the guest cart", () => {
    const merged = computeMergedQuantities(
      [
        { productId: "a", quantity: 2 },
        { productId: "b", quantity: 1 },
      ],
      [
        { productId: "a", quantity: 3 },
        { productId: "c", quantity: 5 },
      ],
    );
    expect(merged.get("a")).toBe(5);
    expect(merged.get("b")).toBe(1);
    expect(merged.get("c")).toBe(5);
  });

  it("returns the user cart untouched when the guest cart is empty", () => {
    const merged = computeMergedQuantities([{ productId: "a", quantity: 2 }], []);
    expect(merged.size).toBe(1);
    expect(merged.get("a")).toBe(2);
  });

  it("imports guest-only lines when the user cart is empty", () => {
    const merged = computeMergedQuantities([], [{ productId: "x", quantity: 4 }]);
    expect(merged.get("x")).toBe(4);
  });

  it("never produces a zero/negative line (clamp floor)", () => {
    const merged = computeMergedQuantities([{ productId: "a", quantity: 2 }], [
      { productId: "a", quantity: -9 },
    ]);
    expect(merged.has("a")).toBe(false);
  });

  it("caps each merged line at the 99-per-line cart ceiling", () => {
    const merged = computeMergedQuantities([{ productId: "a", quantity: 90 }], [
      { productId: "a", quantity: 90 },
    ]);
    expect(merged.get("a")).toBe(99);
  });

  it("produces a deterministic insertion order (user lines first, then new guest lines)", () => {
    const merged = computeMergedQuantities(
      [
        { productId: "b", quantity: 1 },
        { productId: "a", quantity: 1 },
      ],
      [
        { productId: "z", quantity: 1 },
        { productId: "a", quantity: 1 },
      ],
    );
    expect([...merged.keys()]).toEqual(["b", "a", "z"]);
  });

  // --- session-6 S6-6: the third clamp dimension (stock) -------------------
  it("clamps merged lines to available stock when a stock map is provided", () => {
    const merged = computeMergedQuantities(
      [{ productId: "a", quantity: 3 }],
      [{ productId: "a", quantity: 4 }],
      new Map([["a", 5]]),
    );
    expect(merged.get("a")).toBe(5);
  });

  it("stock clamping never overrides the 99 ceiling (tightest bound wins)", () => {
    const merged = computeMergedQuantities(
      [{ productId: "a", quantity: 60 }],
      [{ productId: "a", quantity: 60 }],
      new Map([["a", 500]]),
    );
    expect(merged.get("a")).toBe(99);
  });

  it("imports a guest-only line clamped to its stock", () => {
    const merged = computeMergedQuantities([], [{ productId: "x", quantity: 8 }], new Map([["x", 2]]));
    expect(merged.get("x")).toBe(2);
  });

  it("drops a line whose stock is zero (cannot merge into a guaranteed-409 line)", () => {
    const merged = computeMergedQuantities([], [{ productId: "y", quantity: 3 }], new Map([["y", 0]]));
    expect(merged.has("y")).toBe(false);
  });

  it("products missing from the stock map keep the ceiling-only behavior (unknown stock)", () => {
    const merged = computeMergedQuantities([{ productId: "a", quantity: 3 }], [{ productId: "a", quantity: 4 }], new Map());
    expect(merged.get("a")).toBe(7);
  });

  it("clamps user-only lines to stock too (merge re-baselines the whole cart)", () => {
    const merged = computeMergedQuantities([{ productId: "a", quantity: 9 }], [], new Map([["a", 4]]));
    expect(merged.get("a")).toBe(4);
  });
});

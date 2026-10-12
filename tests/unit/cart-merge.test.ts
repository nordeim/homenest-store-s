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
});

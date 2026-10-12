import { describe, expect, it } from "vitest";

import { clampPurchaseQuantity } from "@/lib/cart-quantity";

describe("clampPurchaseQuantity", () => {
  it("returns the requested quantity when stock allows it", () => {
    expect(clampPurchaseQuantity(3, 10)).toBe(3);
    expect(clampPurchaseQuantity(10, 10)).toBe(10);
  });

  it("clamps to the available stock", () => {
    expect(clampPurchaseQuantity(7, 4)).toBe(4);
  });

  it("returns 0 when the product is out of stock (never a zero-qty line)", () => {
    expect(clampPurchaseQuantity(2, 0)).toBe(0);
  });

  it("floors non-integer input to a valid purchase quantity", () => {
    expect(clampPurchaseQuantity(2.9, 10)).toBe(2);
  });

  it("returns 0 for any input that floors below 1", () => {
    expect(clampPurchaseQuantity(0, 10)).toBe(0);
    expect(clampPurchaseQuantity(-3, 10)).toBe(0);
  });

  it("treats a missing product (null stock) as no purchase", () => {
    expect(clampPurchaseQuantity(3, null)).toBe(0);
  });
});

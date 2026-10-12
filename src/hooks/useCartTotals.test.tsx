import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCartTotals } from "./useCartTotals";
import { useCartStore } from "@/store/cartStore";
import { useCatalogStore } from "@/store/catalogStore";

describe("useCartTotals", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], couponCode: null });
  });

  it("returns zeroed totals for an empty cart", () => {
    const { result } = renderHook(() => useCartTotals());
    expect(result.current.subtotal).toBe(0);
    expect(result.current.total).toBe(0);
    expect(result.current.itemCount).toBe(0);
  });

  it("computes subtotal, tax and shipping for items under the free-shipping threshold", () => {
    const product = useCatalogStore.getState().products[1]; // cast iron skillet, $54, no compareAt
    useCartStore.getState().addItem(product.id, 1);

    const { result } = renderHook(() => useCartTotals());
    const { subtotal, shippingCost, tax, total, itemCount } = result.current;
    const settings = useCatalogStore.getState().settings;

    expect(itemCount).toBe(1);
    expect(subtotal).toBeCloseTo(product.price);
    expect(shippingCost).toBeCloseTo(settings.flatShippingRate);
    expect(tax).toBeCloseTo(product.price * (settings.taxRatePercent / 100));
    expect(total).toBeCloseTo(subtotal + shippingCost + tax);
  });

  it("waives shipping once the subtotal reaches the free-shipping threshold", () => {
    const stockpot = useCatalogStore.getState().products.find((p) => p.id === "prod-001")!; // $129
    useCartStore.getState().addItem(stockpot.id, 1);

    const { result } = renderHook(() => useCartTotals());
    expect(result.current.subtotal).toBeGreaterThanOrEqual(
      useCatalogStore.getState().settings.freeShippingThreshold,
    );
    expect(result.current.shippingCost).toBe(0);
  });

  it("applies a percent-off coupon to the subtotal before tax", () => {
    const product = useCatalogStore.getState().products.find((p) => p.id === "prod-001")!; // $129
    useCartStore.getState().addItem(product.id, 1);
    useCartStore.getState().applyCoupon("SAVE20");

    const { result } = renderHook(() => useCartTotals());
    expect(result.current.discount).toBeCloseTo(product.price * 0.2);
  });

  it("ignores an invalid coupon code and applies no discount", () => {
    const product = useCatalogStore.getState().products[0];
    useCartStore.getState().addItem(product.id, 1);
    useCartStore.getState().applyCoupon("NOT-REAL");

    const { result } = renderHook(() => useCartTotals());
    expect(result.current.discount).toBe(0);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore } from "./cartStore";

function resetStore() {
  useCartStore.setState({ items: [], couponCode: null });
}

describe("cartStore", () => {
  beforeEach(resetStore);

  it("adds a new line item", () => {
    useCartStore.getState().addItem("prod-001", 2);
    expect(useCartStore.getState().items).toEqual([{ productId: "prod-001", variantId: undefined, quantity: 2 }]);
  });

  it("merges quantity when the same product/variant is added again", () => {
    const { addItem } = useCartStore.getState();
    addItem("prod-001", 1);
    addItem("prod-001", 3);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(4);
  });

  it("keeps distinct variants of the same product as separate lines", () => {
    const { addItem } = useCartStore.getState();
    addItem("prod-002", 1, "red");
    addItem("prod-002", 1, "blue");
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it("removes a line item entirely when quantity is set to zero", () => {
    const { addItem, updateQuantity } = useCartStore.getState();
    addItem("prod-001", 2);
    updateQuantity("prod-001", 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("removeItem removes only the matching product/variant pair", () => {
    const { addItem, removeItem } = useCartStore.getState();
    addItem("prod-001", 1);
    addItem("prod-002", 1, "red");
    removeItem("prod-001");
    expect(useCartStore.getState().items).toEqual([{ productId: "prod-002", variantId: "red", quantity: 1 }]);
  });

  it("clear empties the cart and resets the coupon", () => {
    const { addItem, applyCoupon, clear } = useCartStore.getState();
    addItem("prod-001", 1);
    applyCoupon("SAVE20");
    clear();
    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().couponCode).toBeNull();
  });
});

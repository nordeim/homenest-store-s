import { describe, expect, it } from "vitest";

import { cartClearFilter, type CartLine } from "@/lib/cart";
import { productSeedCreatedAt } from "@/lib/seed-policy";
import { settingNumber } from "@/lib/settings";

// ---------------------------------------------------------------------------
// S12-1 — checkout clears exactly the ordered lines, never the whole cart
// ---------------------------------------------------------------------------

describe("cartClearFilter", () => {
  const line = (id: string, productId: string): CartLine => ({
    id,
    productId,
    name: "Product",
    slug: "product",
    image: "/images/placeholder.svg",
    unitPrice: 100,
    quantity: 1,
    stock: 5,
    lineTotal: 100,
  });

  it("targets exactly the ordered line ids, scoped to the cart", () => {
    const filter = cartClearFilter("cart-1", [line("li-1", "p-1"), line("li-2", "p-2")]);
    expect(filter).toEqual({ cartId: "cart-1", id: { in: ["li-1", "li-2"] } });
  });

  it("keeps the cartId in the compound filter (a foreign line id can never match)", () => {
    const filter = cartClearFilter("cart-1", [line("li-1", "p-1")]);
    expect(filter.cartId).toBe("cart-1");
    expect(filter.id.in).toEqual(["li-1"]);
  });

  it("deletes nothing for an empty order (in: [] matches no row)", () => {
    const filter = cartClearFilter("cart-1", []);
    expect(filter.cartId).toBe("cart-1");
    expect(filter.id).toEqual({ in: [] });
  });
});

// ---------------------------------------------------------------------------
// S12-5 — seed timestamps render the reference's authored order as newest-first
// ---------------------------------------------------------------------------

describe("productSeedCreatedAt", () => {
  const base = new Date("2026-10-13T00:00:00.000Z");

  it("assigns the FIRST-listed product (the reference's first card) the newest timestamp", () => {
    expect(productSeedCreatedAt(0, base).getTime()).toBe(base.getTime());
  });

  it("is strictly descending along the seed list (later listings are older)", () => {
    for (let i = 1; i < 8; i++) {
      expect(productSeedCreatedAt(i, base).getTime()).toBeLessThan(
        productSeedCreatedAt(i - 1, base).getTime(),
      );
    }
  });

  it("spaces timestamps a full minute apart so no two rows can tie", () => {
    const indexes = [0, 1, 2, 3, 7, 15];
    const stamps = indexes.map((i) => productSeedCreatedAt(i, base).getTime());
    expect(new Set(stamps).size).toBe(stamps.length);
    expect(productSeedCreatedAt(0, base).getTime() - productSeedCreatedAt(15, base).getTime()).toBe(15 * 60_000);
  });

  it("rejects a negative index (seed lists are static and ordered)", () => {
    expect(() => productSeedCreatedAt(-1, base)).toThrow(/index/);
  });
});

// ---------------------------------------------------------------------------
// C3 — the getSettings() numeric fallback seam, extracted pure
// ---------------------------------------------------------------------------

describe("settingNumber", () => {
  it("passes finite values through, including zero, negatives and decimals", () => {
    expect(settingNumber("7.5", 1)).toBe(7.5);
    expect(settingNumber("0", 1)).toBe(0);
    expect(settingNumber("-3", 1)).toBe(-3);
  });

  it("falls back when the row is missing (undefined)", () => {
    expect(settingNumber(undefined, 42)).toBe(42);
  });

  it("falls back on garbage, empty and whitespace values (an empty setting is missing, not zero)", () => {
    expect(settingNumber("abc", 42)).toBe(42);
    expect(settingNumber("", 42)).toBe(42);
    expect(settingNumber("   ", 42)).toBe(42);
  });

  it("falls back on non-finite numbers (Infinity/NaN text)", () => {
    expect(settingNumber("Infinity", 42)).toBe(42);
    expect(settingNumber("NaN", 42)).toBe(42);
  });
});

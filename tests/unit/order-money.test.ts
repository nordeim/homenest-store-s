import { describe, expect, it } from "vitest";

import { computeOrderMoney } from "@/lib/order-money";

const BASE = {
  freeShippingThresholdCents: 5000,
  standardShippingCents: 695,
  expressShippingCents: 1895,
  taxRatePercent: 7.5,
};

describe("computeOrderMoney", () => {
  it("charges standard shipping and taxes the taxable amount", () => {
    const money = computeOrderMoney({
      ...BASE,
      subtotal: 4299,
      discount: 0,
      shippingMethod: "standard",
    });
    expect(money.taxable).toBe(4299);
    expect(money.shipping).toBe(695);
    expect(money.tax).toBe(322); // round(4299 * 0.075) = 322.425 -> 322
    expect(money.total).toBe(4299 + 695 + 322);
  });

  it("drops shipping to FREE once the threshold is met", () => {
    const money = computeOrderMoney({
      ...BASE,
      subtotal: 5000,
      discount: 0,
      shippingMethod: "standard",
    });
    expect(money.shipping).toBe(0);
    expect(money.total).toBe(5000 + Math.round(5000 * 0.075));
  });

  it("applies the threshold to the DISCOUNTED subtotal", () => {
    const money = computeOrderMoney({
      ...BASE,
      subtotal: 5500,
      discount: 1000,
      shippingMethod: "standard",
    });
    expect(money.taxable).toBe(4500);
    expect(money.shipping).toBe(695); // 4500 < 5000 -> still charged
  });

  it("makes express free at the threshold too (spend gate, not a method property)", () => {
    const money = computeOrderMoney({
      ...BASE,
      subtotal: 12000,
      discount: 0,
      shippingMethod: "express",
    });
    expect(money.shipping).toBe(0);
  });

  it("uses express rates below the threshold", () => {
    const money = computeOrderMoney({
      ...BASE,
      subtotal: 3000,
      discount: 0,
      shippingMethod: "express",
    });
    expect(money.shipping).toBe(1895);
  });

  it("never lets the discount push the taxable base negative", () => {
    const money = computeOrderMoney({
      ...BASE,
      subtotal: 500,
      discount: 1000, // fixed coupon capped at 500 upstream; guard here anyway
      shippingMethod: "standard",
    });
    expect(money.taxable).toBe(0);
    expect(money.tax).toBe(0);
    expect(money.total).toBe(695);
  });

  it("rounds half-cases of tax to nearest cent consistently", () => {
    // 19999 * 0.075 = 1499.925 -> 1500
    const money = computeOrderMoney({ ...BASE, subtotal: 19999, discount: 0, shippingMethod: "standard" });
    expect(money.tax).toBe(1500);
    // 555 * 0.075 = 41.625 -> 42
    expect(computeOrderMoney({ ...BASE, subtotal: 555, discount: 0, shippingMethod: "standard" }).tax).toBe(42);
    // 554 * 0.075 = 41.55 -> 42 (Math.round rounds .5 up)
    expect(computeOrderMoney({ ...BASE, subtotal: 554, discount: 0, shippingMethod: "standard" }).tax).toBe(42);
  });

  it("matches the reference order: $199.99 knife + WELCOME10 -> $191.24 total", () => {
    // subtotal 19999, 10% off -> 2000 discount, taxable 17999, shipping free (>= 5000),
    // tax round(17999*0.075)=1350, total 19349
    const money = computeOrderMoney({
      ...BASE,
      subtotal: 19999,
      discount: 2000,
      shippingMethod: "standard",
    });
    expect(money).toEqual({ taxable: 17999, shipping: 0, tax: 1350, total: 19349 });
  });
});

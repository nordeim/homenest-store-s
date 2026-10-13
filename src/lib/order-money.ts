/**
 * Order money math — the SINGLE source of truth for checkout totals.
 * Pure integer-cent arithmetic so the critical path is unit-testable
 * (tests/unit/order-money.test.ts) and identical to what /api/checkout
 * re-derives server-side. Client totals are display mirrors only.
 */

export type OrderMoneyInput = {
  subtotal: number; // cents, from the live cart
  discount: number; // cents, from the applied coupon
  shippingMethod: "standard" | "express";
  freeShippingThresholdCents: number;
  standardShippingCents: number;
  expressShippingCents: number;
  taxRatePercent: number; // e.g. 7.5
  couponFreeShipping?: boolean; // session-20 S20-6: a free_shipping coupon zeroes shipping outright
};

export type OrderMoney = {
  taxable: number; // subtotal - discount (floored at 0)
  shipping: number; // 0 when the threshold is met
  tax: number; // round(taxable * rate / 100)
  total: number; // taxable + shipping + tax
};

/**
 * Derive checkout totals. Shipping becomes FREE the moment the discounted
 * subtotal reaches the free-shipping threshold (both methods — the threshold
 * is a spend gate, not a method property), or outright when the applied
 * coupon is a `free_shipping` coupon (session-20 S20-6 — the coupon IS the
 * shipping benefit, independent of the spend gate).
 */
export function computeOrderMoney(input: OrderMoneyInput): OrderMoney {
  const taxable = Math.max(0, Math.round(input.subtotal - input.discount));
  const meetsThreshold = taxable >= input.freeShippingThresholdCents;
  const shipping =
    input.couponFreeShipping || meetsThreshold
      ? 0
      : input.shippingMethod === "express"
        ? input.expressShippingCents
        : input.standardShippingCents;
  const tax = Math.round((taxable * input.taxRatePercent) / 100);
  return { taxable, shipping, tax, total: taxable + shipping + tax };
}

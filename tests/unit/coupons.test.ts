import { describe, expect, it } from "vitest";

import { couponDiscount, type CouponInfo } from "@/lib/coupons";

const percent10: CouponInfo = {
  code: "WELCOME10",
  type: "percent",
  value: 10,
  minSubtotal: 0,
  description: "10% off",
};

const fixed10: CouponInfo = {
  code: "TENOFF",
  type: "fixed",
  value: 1000,
  minSubtotal: 5000,
  description: "$10 off $50+",
};

describe("couponDiscount — percent coupons", () => {
  it("computes rounded integer-cent discounts", () => {
    expect(couponDiscount(percent10, 19999)).toEqual({
      ok: true,
      code: "WELCOME10",
      discount: 2000, // 10% of $199.99 = $19.999 -> rounds to $20.00
      label: "10% off",
    });
    expect(couponDiscount(percent10, 555).ok).toBe(true);
  });

  it("rejects out-of-range percent values", () => {
    expect(couponDiscount({ ...percent10, value: 0 }, 1000).ok).toBe(false);
    expect(couponDiscount({ ...percent10, value: 101 }, 1000).ok).toBe(false);
  });
});

describe("couponDiscount — fixed coupons", () => {
  it("subtracts the cent value", () => {
    expect(couponDiscount(fixed10, 8000)).toEqual({
      ok: true,
      code: "TENOFF",
      discount: 1000,
      label: "$10.00 off",
    });
  });

  it("caps the discount at the subtotal (never negative)", () => {
    const noMin: CouponInfo = { code: "TENOFF", type: "fixed", value: 1000, minSubtotal: 0, description: "" };
    const result = couponDiscount(noMin, 500);
    expect(result).toEqual({
      ok: true,
      code: "TENOFF",
      discount: 500,
      label: "$10.00 off",
    });
  });

  it("enforces the minimum subtotal", () => {
    const result = couponDiscount(fixed10, 4999);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("$50.00");
  });
});

describe("couponDiscount — unknown types", () => {
  it("rejects unknown coupon types", () => {
    expect(couponDiscount({ ...percent10, type: "bogus" }, 1000).ok).toBe(false);
  });
});

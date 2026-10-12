import { db } from "./db";

/**
 * Coupon math — pure functions + a DB lookup seam. Discount is computed in
 * integer cents; `fixed` coupons are cent amounts, `percent` coupons are
 * whole-number percents (1..100).
 */
export type CouponInfo = {
  code: string;
  type: string;
  value: number;
  minSubtotal: number;
  description: string;
};

export type CouponApplication =
  | { ok: true; code: string; discount: number; label: string }
  | { ok: false; error: string };

/** Pure discount computation for a validated coupon against a subtotal. */
export function couponDiscount(coupon: CouponInfo, subtotal: number): CouponApplication {
  if (subtotal < coupon.minSubtotal) {
    const min = (coupon.minSubtotal / 100).toFixed(2);
    return { ok: false, error: `This code requires a minimum subtotal of $${min}.` };
  }
  if (coupon.type === "percent") {
    if (coupon.value < 1 || coupon.value > 100) {
      return { ok: false, error: "Invalid coupon configuration." };
    }
    return {
      ok: true,
      code: coupon.code,
      discount: Math.round((subtotal * coupon.value) / 100),
      label: `${coupon.value}% off`,
    };
  }
  if (coupon.type === "fixed") {
    if (coupon.value <= 0) {
      return { ok: false, error: "Invalid coupon configuration." };
    }
    return {
      ok: true,
      code: coupon.code,
      discount: Math.min(coupon.value, subtotal),
      label: `$${(coupon.value / 100).toFixed(2)} off`,
    };
  }
  return { ok: false, error: "Invalid coupon configuration." };
}

/** DB lookup seam: case-insensitive code -> active coupon or null. */
export async function findActiveCoupon(code: string): Promise<CouponInfo | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.isActive) return null;
  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minSubtotal: coupon.minSubtotal,
    description: coupon.description,
  };
}

/** Convenience: validate + apply a coupon code in one call. */
export async function applyCouponCode(code: string, subtotal: number): Promise<CouponApplication> {
  const coupon = await findActiveCoupon(code);
  if (!coupon) return { ok: false, error: "This coupon code is not valid." };
  return couponDiscount(coupon, subtotal);
}

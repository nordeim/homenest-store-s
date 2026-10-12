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

/**
 * Lifecycle gate for a coupon ROW (the Prisma model shape): inactive, expired
 * (the expiry instant itself counts as past — the sale ends when it begins)
 * or cap-exhausted coupons are not redeemable. Pure so the checkout
 * transaction can reuse it against the in-tx coupon read.
 */
export function isCouponRedeemable(
  coupon: {
    isActive: boolean;
    expiresAt: Date | null;
    maxRedemptions: number | null;
    timesUsed: number;
  },
  now: Date = new Date(),
): boolean {
  if (!coupon.isActive) return false;
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return false;
  if (coupon.maxRedemptions !== null && coupon.timesUsed >= coupon.maxRedemptions) return false;
  return true;
}

/** DB lookup seam: case-insensitive code -> active, unexpired, unexhausted coupon or null. */
export async function findActiveCoupon(code: string): Promise<CouponInfo | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  if (!coupon) return null;
  if (!isCouponRedeemable(coupon)) return null;
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

/**
 * Prisma `where` fragment for the ATOMIC redemption-cap guard. The checkout
 * transaction increments `timesUsed` through `updateMany({ where: { code,
 * ...couponRedemptionWhere(coupon.maxRedemptions) } })` — when the cap was
 * just reached by a concurrent checkout, `count === 0` and the tx rolls back,
 * closing the read-then-write TOCTOU window that `isCouponRedeemable` alone
 * leaves open. Pure and unit-tested; `null` maxRedemptions adds no guard.
 */
export function couponRedemptionWhere(maxRedemptions: number | null): { timesUsed?: { lt: number } } {
  return maxRedemptions === null ? {} : { timesUsed: { lt: maxRedemptions } };
}

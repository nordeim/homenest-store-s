import type { Coupon } from "@/types";

export const coupons: Coupon[] = [
  { code: "WELCOME10", type: "percent", value: 10, active: true },
  { code: "FREESHIP", type: "fixed", value: 6.95, active: true },
  { code: "SAVE20", type: "percent", value: 20, active: true },
];

export function findCoupon(code: string): Coupon | undefined {
  return coupons.find(
    (c) => c.code.toLowerCase() === code.trim().toLowerCase() && c.active,
  );
}

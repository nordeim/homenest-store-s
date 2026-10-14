"use client";

import * as React from "react";
import { Truck } from "lucide-react";

import { formatMoney } from "@/lib/money";

import { CouponBox, type AppliedCoupon } from "./coupon-box";

/**
 * CartSummaryWidgets — the summary card's shipping-hint + coupon pair
 * (session-23 S23-2, resolving the S21-7 deferral). The coupon state is
 * LIFTED from the CouponBox through its `onAppliedChange` callback so the
 * free-shipping hint can react to it: with an applied `free_shipping` coupon
 * the old threshold nag ("Add $X more for free shipping") contradicted the
 * applied block right below it. Three states:
 *
 *  (a) applied free_shipping coupon → the coupon-attributed emerald block —
 *      shipping is already free, so no progressbar and no nag;
 *  (b) subtotal ≥ threshold → "You've unlocked free shipping!";
 *  (c) otherwise → the progress bar + "Add $X more" nag (a percent/fixed
 *      coupon leaves (b)/(c) unchanged — the threshold is pre-discount).
 *
 * The props are the SERVER facts (the page's cart summary + settings), so the
 * first client render matches the server HTML — no hydration mismatch by
 * construction; the state only shifts after a coupon apply/remove.
 */
export function CartSummaryWidgets({
  subtotalCents,
  thresholdCents,
}: {
  subtotalCents: number;
  thresholdCents: number;
}) {
  const [coupon, setCoupon] = React.useState<AppliedCoupon | null>(null);

  const remaining = thresholdCents - subtotalCents;
  const progress = Math.min(100, Math.round((subtotalCents / thresholdCents) * 100));

  return (
    <>
      {coupon?.freeShipping ? (
        <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
          <Truck className="h-4 w-4" aria-hidden /> Free shipping active — {coupon.code} applied at
          checkout
        </p>
      ) : subtotalCents >= thresholdCents ? (
        <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
          <Truck className="h-4 w-4" aria-hidden /> You&apos;ve unlocked free shipping!
        </p>
      ) : (
        <div className="mt-4 rounded-xl bg-secondary/60 p-3">
          <p className="text-xs text-muted-foreground">
            Add <span className="font-semibold text-primary">{formatMoney(remaining)}</span> more for free
            shipping
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Progress toward free shipping"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <CouponBox onAppliedChange={setCoupon} className="mt-4" />
    </>
  );
}

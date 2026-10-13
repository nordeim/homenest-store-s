import type { Metadata } from "next";

import { db } from "@/lib/db";
import { couponLabel } from "@/lib/coupons";
import { formatMoney } from "@/lib/money";

import {
  CouponDeleteButton,
  CouponDialogButton,
  CouponToggleButton,
  type CouponFormValues,
} from "./coupon-dialog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Coupons" };

/** UTC date (YYYY-MM-DD) of a stored expiry instant — the dialog's round-trip shape. */
function expiryDateValue(expiresAt: Date | null): string {
  return expiresAt ? expiresAt.toISOString().slice(0, 10) : "";
}

export default async function AdminCouponsPage() {
  const now = new Date();
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <header>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Coupons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {coupons.length} coupon{coupons.length === 1 ? "" : "s"} redeemable at the cart and checkout
          </p>
        </header>
        <CouponDialogButton coupon={null} label="Add Coupon" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {coupons.map((coupon) => {
          const formValues: CouponFormValues = {
            id: coupon.id,
            code: coupon.code,
            type: coupon.type === "fixed" ? "fixed" : "percent",
            // Display shapes: fixed values are stored in cents and shown as
            // dollars — the same convention the dialog parses back.
            value: coupon.type === "fixed" ? (coupon.value / 100).toFixed(2) : String(coupon.value),
            description: coupon.description,
            minSubtotalDollars: (coupon.minSubtotal / 100).toFixed(2),
            expiresAtDate: expiryDateValue(coupon.expiresAt),
            maxRedemptions: coupon.maxRedemptions === null ? "" : String(coupon.maxRedemptions),
            isActive: coupon.isActive,
          };
          const expired = coupon.expiresAt !== null && coupon.expiresAt.getTime() <= now.getTime();
          const capped =
            coupon.maxRedemptions !== null && coupon.timesUsed >= coupon.maxRedemptions;
          return (
            <article
              key={coupon.id}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-base font-bold tracking-wide">{coupon.code}</h2>
                    {!coupon.isActive && (
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                        Inactive
                      </span>
                    )}
                    {expired && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        Expired
                      </span>
                    )}
                    {capped && (
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                        Cap reached
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-primary">{couponLabel(coupon.type, coupon.value)}</p>
                </div>
              </div>

              {coupon.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{coupon.description}</p>
              )}

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <div>
                  <dt className="sr-only">Minimum subtotal</dt>
                  <dd>
                    {coupon.minSubtotal > 0
                      ? `${formatMoney(coupon.minSubtotal)} minimum`
                      : "No minimum"}
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Expiry</dt>
                  <dd>{coupon.expiresAt ? `Expires ${expiryDateValue(coupon.expiresAt)}` : "No expiry"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="sr-only">Redemptions</dt>
                  <dd>
                    {coupon.timesUsed} redemption{coupon.timesUsed === 1 ? "" : "s"}
                    {coupon.maxRedemptions !== null
                      ? ` of ${coupon.maxRedemptions}`
                      : " (unlimited)"}
                  </dd>
                </div>
              </dl>

              <div className="mt-auto flex items-center justify-end gap-1">
                <CouponToggleButton coupon={formValues} />
                <CouponDialogButton coupon={formValues} />
                <CouponDeleteButton id={coupon.id} code={coupon.code} />
              </div>
            </article>
          );
        })}
        {coupons.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">No coupons yet — add your first coupon.</p>
          </div>
        )}
      </div>
    </div>
  );
}

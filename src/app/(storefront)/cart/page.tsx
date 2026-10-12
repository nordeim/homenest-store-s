import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";

import { CartLines } from "./cart-lines";
import { CouponBox } from "./coupon-box";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review the items in your HomeNest cart before checkout.",
};

export default async function CartPage() {
  const user = await getCurrentUser();
  const [summary, settings] = await Promise.all([
    getCartSummary(await findCartId(user?.id ?? null)),
    getSettings(),
  ]);

  if (summary.lines.length === 0) {
    return (
      <div className="container-page flex justify-center py-16 sm:py-24">
        <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary">
            <ShoppingBag className="h-8 w-8" aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Looks like you haven&apos;t added anything yet.
          </p>
          <Button asChild className="mt-6 h-11 px-7">
            <Link href="/products">Start Shopping</Link>
          </Button>
        </div>
      </div>
    );
  }

  const remaining = settings.freeShippingThresholdCents - summary.subtotal;
  const progress = Math.min(100, Math.round((summary.subtotal / settings.freeShippingThresholdCents) * 100));

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Shopping Cart</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {summary.itemCount} {summary.itemCount === 1 ? "item" : "items"} in your cart
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Lines */}
        <section aria-label="Cart items" className="lg:col-span-2">
          <CartLines initialLines={summary.lines} />
        </section>

        {/* Order summary */}
        <aside aria-label="Order summary">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold">Order Summary</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-semibold">{formatMoney(summary.subtotal)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="text-muted-foreground">Calculated at checkout</dd>
              </div>
            </dl>

            {summary.subtotal < settings.freeShippingThresholdCents ? (
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
            ) : (
              <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
                <Truck className="h-4 w-4" aria-hidden /> You&apos;ve unlocked free shipping!
              </p>
            )}

            <div className="mt-4">
              <CouponBox />
            </div>

            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Estimated Total</span>
              <span className="font-display text-xl font-bold">{formatMoney(summary.subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Shipping, taxes and discounts are calculated at checkout.
            </p>

            <Button asChild className="mt-5 h-11 w-full">
              <Link href="/checkout">Checkout</Link>
            </Button>
            <Button variant="outline" asChild className="mt-2 h-11 w-full">
              <Link href="/products">Continue Shopping</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";

import { CartLines } from "./cart-lines";
import { CartSummaryWidgets } from "./cart-widgets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review the items in your HomeNest cart before checkout.",
  // Per-visitor private content — nothing here for a search engine
  // (session-8 S8-9: matches the wishlist/checkout-success/admin noindex set).
  robots: { index: false, follow: true },
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

            <CartSummaryWidgets subtotalCents={summary.subtotal} thresholdCents={settings.freeShippingThresholdCents} />

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

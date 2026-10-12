import { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Tag, Trash2 } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useCartTotals } from "@/hooks/useCartTotals";
import { useToastStore } from "@/store/toastStore";
import { findCoupon } from "@/data/coupons";
import { Button, LinkButton } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";

export function Cart() {
  const { lines, subtotal, discount, tax, shippingCost, total, coupon } = useCartTotals();
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const removeCoupon = useCartStore((s) => s.removeCoupon);
  const push = useToastStore((s) => s.push);
  const [code, setCode] = useState("");

  function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    const found = findCoupon(code);
    if (!found) {
      push("That coupon code isn't valid", "error");
      return;
    }
    applyCoupon(found.code);
    push(`Coupon "${found.code}" applied`, "success");
    setCode("");
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Looks like you haven't added anything yet. Explore our collections to find your next kitchen essential."
          action={<LinkButton to="/products">Start Shopping</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-ink-900">Your Cart</h1>
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
        <div className="divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-cream-50">
          {lines.map((line) => (
            <div key={`${line.productId}-${line.variantId ?? ""}`} className="flex gap-4 p-4 sm:p-5">
              <Link to={`/products/${line.productId}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-50">
                <img src={line.image} alt={line.name} className="h-full w-full object-cover" />
              </Link>
              <div className="flex flex-1 flex-col justify-between">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{line.name}</p>
                    <p className="mt-0.5 text-sm text-ink-500">{formatCurrency(line.price)} each</p>
                  </div>
                  <button
                    onClick={() => removeItem(line.productId, line.variantId)}
                    aria-label={`Remove ${line.name}`}
                    className="text-ink-400 hover:text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <QuantityStepper
                    size="sm"
                    value={line.quantity}
                    max={line.stock}
                    onChange={(q) => updateQuantity(line.productId, q, line.variantId)}
                  />
                  <p className="text-sm font-semibold text-ink-900">{formatCurrency(line.lineTotal)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit space-y-5 rounded-2xl border border-ink-100 bg-cream-50 p-6">
          <h2 className="text-base font-semibold text-ink-900">Order Summary</h2>
          <form onSubmit={handleApplyCoupon} className="flex gap-2">
            <div className="relative flex-1">
              <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Coupon code"
                className="w-full rounded-lg border border-ink-200 py-2.5 pl-9 pr-3 text-sm focus:border-forest-600 focus:outline-none"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Apply
            </Button>
          </form>
          {coupon && (
            <div className="flex items-center justify-between rounded-lg bg-forest-50 px-3 py-2 text-sm text-forest-800">
              <span>Code "{coupon.code}" applied</span>
              <button onClick={removeCoupon} className="font-semibold underline">
                Remove
              </button>
            </div>
          )}
          <p className="text-xs text-ink-400">Try WELCOME10, SAVE20 or FREESHIP</p>

          <dl className="space-y-2.5 border-t border-ink-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Subtotal</dt>
              <dd className="font-medium text-ink-900">{formatCurrency(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-forest-700">
                <dt>Discount</dt>
                <dd>-{formatCurrency(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-500">Shipping</dt>
              <dd className="font-medium text-ink-900">
                {shippingCost === 0 ? "Free" : formatCurrency(shippingCost)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Estimated Tax</dt>
              <dd className="font-medium text-ink-900">{formatCurrency(tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-100 pt-3 text-base font-bold text-ink-900">
              <dt>Total</dt>
              <dd>{formatCurrency(total)}</dd>
            </div>
          </dl>

          <LinkButton to="/checkout" size="lg" className="w-full justify-center">
            Proceed to Checkout
          </LinkButton>
          <Link to="/products" className="block text-center text-sm font-medium text-forest-800 hover:underline">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

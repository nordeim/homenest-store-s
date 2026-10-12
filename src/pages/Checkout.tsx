import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CheckCircle2, CreditCard, Truck } from "lucide-react";
import { useCartTotals } from "@/hooks/useCartTotals";
import { useCartStore } from "@/store/cartStore";
import { useCatalogStore } from "@/store/catalogStore";
import { useOrderStore } from "@/store/orderStore";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/utils/cn";
import type { Address } from "@/types";

const steps = ["Shipping", "Payment", "Review"] as const;

export function Checkout() {
  const { lines, subtotal, discount, tax, coupon } = useCartTotals();
  const settings = useCatalogStore((s) => s.settings);
  const clearCart = useCartStore((s) => s.clear);
  const decrementStock = useCatalogStore((s) => s.decrementStock);
  const placeOrder = useOrderStore((s) => s.placeOrder);
  const user = useAuthStore((s) => s.currentUser());
  const push = useToastStore((s) => s.push);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express">("standard");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal" | "cod">("card");
  const [submitting, setSubmitting] = useState(false);
  const [address, setAddress] = useState<Address & { email: string }>({
    fullName: user?.name ?? "",
    email: user?.email ?? "",
    line1: user?.addresses[0]?.line1 ?? "",
    line2: user?.addresses[0]?.line2 ?? "",
    city: user?.addresses[0]?.city ?? "",
    state: user?.addresses[0]?.state ?? "",
    postalCode: user?.addresses[0]?.postalCode ?? "",
    country: user?.addresses[0]?.country ?? "United States",
    phone: user?.addresses[0]?.phone ?? "",
  });
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", name: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (lines.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const shippingCost =
    subtotal >= settings.freeShippingThreshold && shippingMethod === "standard"
      ? 0
      : shippingMethod === "express"
        ? settings.expressShippingRate
        : settings.flatShippingRate;
  const grandTotal = Math.max(0, subtotal - discount + tax + shippingCost);

  function validateShipping() {
    const errs: Record<string, string> = {};
    if (!address.fullName.trim()) errs.fullName = "Full name is required";
    if (!/^\S+@\S+\.\S+$/.test(address.email)) errs.email = "A valid email is required";
    if (!address.line1.trim()) errs.line1 = "Street address is required";
    if (!address.city.trim()) errs.city = "City is required";
    if (!address.state.trim()) errs.state = "State is required";
    if (!/^\d{5}(-\d{4})?$/.test(address.postalCode.trim())) errs.postalCode = "Valid ZIP code required";
    if (!address.phone.trim()) errs.phone = "Phone number is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validatePayment() {
    if (paymentMethod !== "card") return true;
    const errs: Record<string, string> = {};
    if (!/^\d{13,19}$/.test(card.number.replace(/\s/g, ""))) errs.number = "Enter a valid card number";
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) errs.expiry = "Use MM/YY format";
    if (!/^\d{3,4}$/.test(card.cvc)) errs.cvc = "Enter a valid CVC";
    if (!card.name.trim()) errs.name = "Name on card is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (step === 0 && !validateShipping()) return;
    if (step === 1 && !validatePayment()) return;
    setErrors({});
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  function handlePlaceOrder() {
    setSubmitting(true);
    setTimeout(() => {
      const order = placeOrder({
        email: address.email,
        customerName: address.fullName,
        items: lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          image: l.image,
          price: l.price,
          quantity: l.quantity,
        })),
        shippingAddress: {
          fullName: address.fullName,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone,
        },
        shippingMethod,
        paymentMethod,
        subtotal,
        shippingCost,
        tax,
        discount,
        total: grandTotal,
        couponCode: coupon?.code,
      });
      lines.forEach((l) => decrementStock(l.productId, l.quantity));
      clearCart();
      setSubmitting(false);
      push("Order placed successfully!", "success");
      navigate(`/order-success/${order.orderNumber}`);
    }, 700);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-ink-900">Checkout</h1>

      <div className="mt-6 flex items-center gap-4">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                i <= step ? "bg-forest-800 text-cream-50" : "bg-ink-100 text-ink-400",
              )}
            >
              {i < step ? <CheckCircle2 size={16} /> : i + 1}
            </span>
            <span className={cn("text-sm font-medium", i <= step ? "text-ink-900" : "text-ink-400")}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="mx-2 h-px w-8 bg-ink-200 sm:w-16" />}
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-ink-100 bg-cream-50 p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <Truck size={18} /> Shipping Information
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Full Name"
                  required
                  value={address.fullName}
                  onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                  error={errors.fullName}
                />
                <Input
                  label="Email"
                  type="email"
                  required
                  value={address.email}
                  onChange={(e) => setAddress({ ...address, email: e.target.value })}
                  error={errors.email}
                />
              </div>
              <Input
                label="Street Address"
                required
                value={address.line1}
                onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                error={errors.line1}
              />
              <Input
                label="Apartment, suite, etc. (optional)"
                value={address.line2}
                onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  label="City"
                  required
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  error={errors.city}
                />
                <Input
                  label="State"
                  required
                  value={address.state}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  error={errors.state}
                />
                <Input
                  label="ZIP Code"
                  required
                  value={address.postalCode}
                  onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                  error={errors.postalCode}
                />
              </div>
              <Input
                label="Phone"
                required
                value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                error={errors.phone}
              />

              <h3 className="pt-2 text-sm font-semibold text-ink-900">Shipping Method</h3>
              <div className="space-y-2">
                {(["standard", "express"] as const).map((method) => (
                  <label
                    key={method}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-lg border p-3.5",
                      shippingMethod === method ? "border-forest-700 bg-forest-50" : "border-ink-200",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-ink-800">
                      <input
                        type="radio"
                        checked={shippingMethod === method}
                        onChange={() => setShippingMethod(method)}
                        className="h-4 w-4 accent-forest-700"
                      />
                      {method === "standard" ? "Standard (3-5 business days)" : "Express (1-2 business days)"}
                    </span>
                    <span className="text-sm font-semibold text-ink-900">
                      {method === "standard" && subtotal >= settings.freeShippingThreshold
                        ? "Free"
                        : formatCurrency(
                            method === "standard" ? settings.flatShippingRate : settings.expressShippingRate,
                          )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <CreditCard size={18} /> Payment Method
              </h2>
              <div className="space-y-2">
                {(
                  [
                    { id: "card", label: "Credit / Debit Card" },
                    { id: "paypal", label: "PayPal" },
                    { id: "cod", label: "Cash on Delivery" },
                  ] as const
                ).map((method) => (
                  <label
                    key={method.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-3.5 text-sm font-medium text-ink-800",
                      paymentMethod === method.id ? "border-forest-700 bg-forest-50" : "border-ink-200",
                    )}
                  >
                    <input
                      type="radio"
                      checked={paymentMethod === method.id}
                      onChange={() => setPaymentMethod(method.id)}
                      className="h-4 w-4 accent-forest-700"
                    />
                    {method.label}
                  </label>
                ))}
              </div>

              {paymentMethod === "card" && (
                <div className="space-y-4 pt-2">
                  <Input
                    label="Card Number"
                    placeholder="4242 4242 4242 4242"
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: e.target.value })}
                    error={errors.number}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Expiry (MM/YY)"
                      placeholder="08/28"
                      value={card.expiry}
                      onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                      error={errors.expiry}
                    />
                    <Input
                      label="CVC"
                      placeholder="123"
                      value={card.cvc}
                      onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                      error={errors.cvc}
                    />
                  </div>
                  <Input
                    label="Name on Card"
                    value={card.name}
                    onChange={(e) => setCard({ ...card, name: e.target.value })}
                    error={errors.name}
                  />
                  <p className="text-xs text-ink-400">
                    This is a demo store. No real payment is processed and no card data is transmitted.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-ink-900">Review Your Order</h2>
              <div className="rounded-lg border border-ink-100 p-4 text-sm">
                <p className="font-semibold text-ink-900">Shipping To</p>
                <p className="mt-1 text-ink-600">
                  {address.fullName}, {address.line1} {address.line2}, {address.city}, {address.state}{" "}
                  {address.postalCode}, {address.country}
                </p>
                <p className="mt-1 text-ink-600">{address.phone} · {address.email}</p>
              </div>
              <div className="rounded-lg border border-ink-100 p-4 text-sm">
                <p className="font-semibold text-ink-900">Payment</p>
                <p className="mt-1 text-ink-600 capitalize">
                  {paymentMethod === "card" ? `Card ending in ${card.number.slice(-4) || "0000"}` : paymentMethod}
                </p>
              </div>
              <div className="divide-y divide-ink-100 rounded-lg border border-ink-100">
                {lines.map((l) => (
                  <div key={l.productId} className="flex justify-between p-3 text-sm">
                    <span className="text-ink-700">
                      {l.name} × {l.quantity}
                    </span>
                    <span className="font-medium text-ink-900">{formatCurrency(l.lineTotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={handleNext}>Continue</Button>
            ) : (
              <Button onClick={handlePlaceOrder} loading={submitting}>
                Place Order — {formatCurrency(grandTotal)}
              </Button>
            )}
          </div>
        </div>

        <div className="h-fit space-y-3 rounded-2xl border border-ink-100 bg-cream-50 p-6">
          <h2 className="text-base font-semibold text-ink-900">Order Summary</h2>
          <dl className="space-y-2 text-sm">
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
              <dt className="text-ink-500">Tax</dt>
              <dd className="font-medium text-ink-900">{formatCurrency(tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-100 pt-3 text-base font-bold text-ink-900">
              <dt>Total</dt>
              <dd>{formatCurrency(grandTotal)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

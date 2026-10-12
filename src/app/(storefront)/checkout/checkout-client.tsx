"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Check,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Tag,
  Truck,
  Wallet,
} from "lucide-react";

import type { CartLine } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
// sessionStorage handoff key written by the cart page's CouponBox — single-
// sourced there so the two ends of the handoff can never drift (S6-12).
import { COUPON_STORAGE_KEY } from "../cart/coupon-box";

const STEPS = ["Shipping", "Payment", "Review"] as const;

type ShippingMethod = "standard" | "express";
type PaymentMethod = "card" | "paypal" | "cod";

export type CheckoutUser = { name: string; email: string; phone: string | null };

export type CheckoutAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type ShippingConfig = {
  standardCents: number;
  expressCents: number;
  freeThresholdCents: number;
  taxRatePercent: number;
};

type AppliedCoupon = { code: string; discount: number; label: string; description: string };

type CouponApplyResponse =
  | { ok: true; code: string; discount: number; label: string; description: string }
  | { ok: false; error: string };

const PAYMENT_OPTIONS: Array<{ id: PaymentMethod; label: string; description: string; icon: typeof CreditCard }> = [
  { id: "card", label: "Credit / Debit Card", description: "Visa, Mastercard, Amex — demo", icon: CreditCard },
  { id: "paypal", label: "PayPal", description: "You will be redirected — demo", icon: Wallet },
  { id: "cod", label: "Cash on Delivery", description: "Pay when delivered", icon: Banknote },
];

/** Auto-format a card number as groups of 4 digits. */
function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Auto-format expiry as MM/YY while typing. */
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function Field({
  id,
  label,
  error,
  className,
  ...inputProps
}: { id: string; label: string; error?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...inputProps}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * CheckoutClient — the 3-step checkout wizard (Shipping -> Payment -> Review).
 * All display totals derive from the same rules the server enforces in
 * POST /api/checkout; the server re-derives everything before committing.
 */
export function CheckoutClient({
  lines,
  subtotal,
  user,
  defaultAddress,
  shipping,
}: {
  lines: CartLine[];
  subtotal: number;
  user: CheckoutUser | null;
  defaultAddress: CheckoutAddress | null;
  shipping: ShippingConfig;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState(0);
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [fullName, setFullName] = React.useState(user?.name ?? "");
  const [addr, setAddr] = React.useState<CheckoutAddress>({
    fullName: user?.name ?? defaultAddress?.fullName ?? "",
    phone: defaultAddress?.phone ?? user?.phone ?? "",
    line1: defaultAddress?.line1 ?? "",
    line2: defaultAddress?.line2 ?? "",
    city: defaultAddress?.city ?? "",
    state: defaultAddress?.state ?? "",
    postalCode: defaultAddress?.postalCode ?? "",
    country: defaultAddress?.country ?? "United States",
  });
  const [saveAddress, setSaveAddress] = React.useState(false);
  const [shippingMethod, setShippingMethod] = React.useState<ShippingMethod>("standard");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("card");
  const [card, setCard] = React.useState({ number: "", expiry: "", cvc: "" });

  const [coupon, setCoupon] = React.useState<AppliedCoupon | null>(null);
  const [couponInput, setCouponInput] = React.useState("");
  const [couponPending, setCouponPending] = React.useState(false);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const couponAutoTried = React.useRef(false);

  // One idempotency key per checkout visit: a retry after a lost response
  // (or a double click) reuses it, so the server returns the already-placed
  // order instead of charging twice. A fresh visit generates a new key.
  const idempotencyKeyRef = React.useRef<string>(crypto.randomUUID());

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // ---- Derived money (mirrors the server-side math in /api/checkout) ----
  const discount = coupon?.discount ?? 0;
  const taxable = Math.max(0, subtotal - discount);
  const shippingCost =
    taxable >= shipping.freeThresholdCents
      ? 0
      : shippingMethod === "express"
        ? shipping.expressCents
        : shipping.standardCents;
  const tax = Math.round((taxable * shipping.taxRatePercent) / 100);
  const total = taxable + shippingCost + tax;

  // ---- Coupon ----
  const applyCoupon = React.useCallback(
    async (rawCode: string, silent = false) => {
      const code = rawCode.trim();
      if (!code) {
        setCouponError("Enter a coupon code.");
        return;
      }
      setCouponPending(true);
      setCouponError(null);
      try {
        const res = await fetch("/api/coupon/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as CouponApplyResponse;
        if (data.ok) {
          setCoupon({ code: data.code, discount: data.discount, label: data.label, description: data.description });
          window.sessionStorage.setItem(COUPON_STORAGE_KEY, data.code);
          setCouponInput("");
          if (!silent) {
            toast({ title: `Coupon ${data.code} applied`, description: data.label, variant: "success" });
          }
        } else {
          setCoupon(null);
          window.sessionStorage.removeItem(COUPON_STORAGE_KEY);
          setCouponError(data.error);
          if (!silent) toast({ title: "Coupon not applied", description: data.error, variant: "destructive" });
        }
      } catch {
        setCouponError("Network error — please try again.");
        if (!silent) toast({ title: "Network error", variant: "destructive" });
      } finally {
        setCouponPending(false);
      }
    },
    [toast],
  );

  // Pick up a coupon stored by the cart page (once per mount). Deferred to
  // a timeout so the fetch runs outside the render-effect cycle
  // (react-hooks/set-state-in-effect).
  React.useEffect(() => {
    if (couponAutoTried.current) return;
    couponAutoTried.current = true;
    const stored = window.sessionStorage.getItem(COUPON_STORAGE_KEY);
    if (!stored) return;
    const timer = window.setTimeout(() => void applyCoupon(stored, true), 0);
    return () => window.clearTimeout(timer);
  }, [applyCoupon]);

  function removeCoupon() {
    setCoupon(null);
    setCouponError(null);
    window.sessionStorage.removeItem(COUPON_STORAGE_KEY);
    toast({ title: "Coupon removed" });
  }

  // ---- Step validation (inline, mirrors the server schema) ----
  function validateShipping(): boolean {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Enter a valid email address";
    if (fullName.trim().length < 2) errs.fullName = "Full name is required";
    if (addr.line1.trim().length < 4) errs.line1 = "Street address is required";
    if (addr.city.trim().length < 2) errs.city = "City is required";
    if (addr.state.trim().length < 2) errs.state = "State is required";
    if (addr.postalCode.trim().length < 3) errs.postalCode = "Postal code is required";
    if (addr.country.trim().length < 2) errs.country = "Country is required";
    if (addr.phone.trim().length < 7) errs.phone = "Phone number is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validatePayment(): boolean {
    if (paymentMethod !== "card") {
      setErrors({});
      return true;
    }
    const errs: Record<string, string> = {};
    const digits = card.number.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) errs.number = "Enter a valid card number";
    const expiry = /^(\d{2})\/(\d{2})$/.exec(card.expiry);
    const month = Number(expiry?.[1]);
    if (!expiry || !(month >= 1 && month <= 12)) errs.expiry = "Use MM/YY format";
    if (!/^\d{3,4}$/.test(card.cvc)) errs.cvc = "Enter a valid CVC";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    setFormError(null);
    if (step === 0 && !validateShipping()) return;
    if (step === 1 && !validatePayment()) return;
    setErrors({});
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  // ---- Place order ----
  async function handlePlaceOrder() {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          customerName: fullName.trim(),
          shippingMethod,
          paymentMethod,
          cardLast4: paymentMethod === "card" ? card.number.replace(/\D/g, "").slice(-4) : "",
          couponCode: coupon?.code ?? "",
          saveAddress: Boolean(user) && saveAddress,
          idempotencyKey: idempotencyKeyRef.current,
          address: {
            label: "Home",
            fullName: fullName.trim(),
            phone: addr.phone.trim(),
            line1: addr.line1.trim(),
            line2: addr.line2.trim(),
            city: addr.city.trim(),
            state: addr.state.trim(),
            postalCode: addr.postalCode.trim(),
            country: addr.country.trim(),
          },
        }),
      });
      const data = (await res.json()) as { orderNumber?: string; token?: string; error?: string };
      if (!res.ok || !data.orderNumber) {
        const message = data.error ?? "Could not place your order. Please try again.";
        setFormError(message);
        toast({ title: "Order failed", description: message, variant: "destructive" });
        return;
      }
      window.sessionStorage.removeItem(COUPON_STORAGE_KEY);
      // The success page renders the receipt only for a valid order+token pair
      // (minted server-side) — guessable sequential numbers alone show nothing.
      const params = new URLSearchParams({ order: data.orderNumber, token: data.token ?? "" });
      router.push(`/checkout/success?${params.toString()}`);
    } catch {
      const message = "Network error — please try again.";
      setFormError(message);
      toast({ title: "Order failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const paymentSummary =
    paymentMethod === "card"
      ? `Card ending in ${card.number.replace(/\D/g, "").slice(-4) || "••••"}`
      : paymentMethod === "paypal"
        ? "PayPal"
        : "Cash on Delivery";

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Checkout</h1>

      {/* Step indicator */}
      <ol className="mt-6 flex items-center" aria-label="Checkout progress">
        {STEPS.map((label, i) => {
          const completed = i < step;
          const current = i === step;
          return (
            <li key={label} className={cn("flex items-center gap-2", i < STEPS.length - 1 && "flex-1")}>
              {completed ? (
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={`Go back to ${label}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Check className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <span
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    current ? "border-2 border-primary bg-card text-primary" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
              )}
              <span className={cn("text-sm font-medium", i <= step ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="mx-2 h-px flex-1 bg-border sm:mx-3" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Wizard panel */}
        <section className="lg:col-span-2" aria-label={`Checkout step ${step + 1}: ${STEPS[step]}`}>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            {/* ---------------- Step 1: Shipping ---------------- */}
            {step === 0 && (
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Truck className="h-4 w-4 text-primary" aria-hidden /> Contact &amp; Shipping
                </h2>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    id="checkout-email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={errors.email}
                    required
                  />
                  <Field
                    id="checkout-fullname"
                    label="Full Name"
                    autoComplete="name"
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    error={errors.fullName}
                    required
                  />
                </div>

                <div className="mt-4 space-y-4">
                  <Field
                    id="checkout-line1"
                    label="Street Address"
                    autoComplete="address-line1"
                    placeholder="123 Kitchen Lane"
                    value={addr.line1}
                    onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
                    error={errors.line1}
                    required
                  />
                  <Field
                    id="checkout-line2"
                    label="Apartment, suite, etc. (optional)"
                    autoComplete="address-line2"
                    value={addr.line2}
                    onChange={(e) => setAddr({ ...addr, line2: e.target.value })}
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field
                      id="checkout-city"
                      label="City"
                      autoComplete="address-level2"
                      value={addr.city}
                      onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                      error={errors.city}
                      required
                    />
                    <Field
                      id="checkout-state"
                      label="State"
                      autoComplete="address-level1"
                      value={addr.state}
                      onChange={(e) => setAddr({ ...addr, state: e.target.value })}
                      error={errors.state}
                      required
                    />
                    <Field
                      id="checkout-postal"
                      label="Postal Code"
                      autoComplete="postal-code"
                      value={addr.postalCode}
                      onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })}
                      error={errors.postalCode}
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="checkout-country"
                      label="Country"
                      autoComplete="country-name"
                      value={addr.country}
                      onChange={(e) => setAddr({ ...addr, country: e.target.value })}
                      error={errors.country}
                      required
                    />
                    <Field
                      id="checkout-phone"
                      label="Phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+1 (555) 123-4567"
                      value={addr.phone}
                      onChange={(e) => setAddr({ ...addr, phone: e.target.value })}
                      error={errors.phone}
                      required
                    />
                  </div>
                </div>

                {user && (
                  <label htmlFor="checkout-save-address" className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      id="checkout-save-address"
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Save this address to my account
                  </label>
                )}

                <fieldset className="mt-6">
                  <legend className="text-sm font-semibold">Shipping Method</legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        { id: "standard", title: "Standard", eta: "5-7 business days", cents: shipping.standardCents },
                        { id: "express", title: "Express", eta: "2-3 business days", cents: shipping.expressCents },
                      ] as const
                    ).map((option) => (
                      <label key={option.id} className="block cursor-pointer">
                        <input
                          type="radio"
                          name="shipping-method"
                          value={option.id}
                          checked={shippingMethod === option.id}
                          onChange={() => setShippingMethod(option.id)}
                          className="peer sr-only"
                        />
                        <span
                          className={cn(
                            "flex flex-col gap-1 rounded-xl border p-4 transition-colors",
                            "peer-checked:border-primary peer-checked:bg-accent/50 peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{option.title}</span>
                            <span className="text-sm font-bold">{formatMoney(option.cents)}</span>
                          </span>
                          <span className="text-xs text-muted-foreground">{option.eta}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Free shipping on orders over {formatMoney(shipping.freeThresholdCents)}.
                  </p>
                </fieldset>
              </div>
            )}

            {/* ---------------- Step 2: Payment ---------------- */}
            {step === 1 && (
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <CreditCard className="h-4 w-4 text-primary" aria-hidden /> Payment Method
                </h2>

                <fieldset className="mt-4">
                  <legend className="sr-only">Payment method</legend>
                  <div className="grid gap-3">
                    {PAYMENT_OPTIONS.map((option) => (
                      <label key={option.id} className="block cursor-pointer">
                        <input
                          type="radio"
                          name="payment-method"
                          value={option.id}
                          checked={paymentMethod === option.id}
                          onChange={() => setPaymentMethod(option.id)}
                          className="peer sr-only"
                        />
                        <span
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-4 transition-colors",
                            "peer-checked:border-primary peer-checked:bg-accent/50 peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                          )}
                        >
                          <option.icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                          <span className="flex-1">
                            <span className="block text-sm font-semibold">{option.label}</span>
                            <span className="block text-xs text-muted-foreground">{option.description}</span>
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {paymentMethod === "card" && (
                  <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-accent-foreground">
                      <Lock className="h-3.5 w-3.5" aria-hidden />
                      Demo checkout — no real charge. Try 4242 4242 4242 4242.
                    </p>
                    <div className="space-y-4">
                      <Field
                        id="card-number"
                        label="Card Number"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        placeholder="4242 4242 4242 4242"
                        value={card.number}
                        onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                        error={errors.number}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          id="card-expiry"
                          label="Expiry (MM/YY)"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          placeholder="08/28"
                          value={card.expiry}
                          onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                          error={errors.expiry}
                        />
                        <Field
                          id="card-cvc"
                          label="CVC"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          placeholder="123"
                          value={card.cvc}
                          onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                          error={errors.cvc}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Coupon */}
                <div className="mt-6 rounded-xl border border-border p-4">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Tag className="h-4 w-4 text-primary" aria-hidden /> Use Coupon
                  </h3>

                  {coupon ? (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5" aria-live="polite">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-emerald-800">
                          <span className="font-semibold">{coupon.code}</span> — {coupon.label}
                        </p>
                        <button
                          type="button"
                          onClick={removeCoupon}
                          className="text-xs font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
                        >
                          Remove
                        </button>
                      </div>
                      {coupon.description && <p className="mt-0.5 text-xs text-emerald-700">{coupon.description}</p>}
                    </div>
                  ) : (
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void applyCoupon(couponInput);
                      }}
                    >
                      <label htmlFor="checkout-coupon" className="sr-only">
                        Coupon code
                      </label>
                      <Input
                        id="checkout-coupon"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="Coupon code"
                        autoComplete="off"
                        autoCapitalize="characters"
                        className="flex-1"
                        aria-invalid={couponError ? true : undefined}
                        aria-describedby={couponError ? "checkout-coupon-error" : undefined}
                      />
                      <Button type="submit" variant="outline" disabled={couponPending}>
                        {couponPending ? "Checking…" : "Apply"}
                      </Button>
                    </form>
                  )}

                  {couponError && (
                    <p id="checkout-coupon-error" role="alert" className="mt-2 text-xs text-destructive">
                      {couponError}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Try WELCOME10, SAVE20 or FREESHIP</p>
                </div>
              </div>
            )}

            {/* ---------------- Step 3: Review ---------------- */}
            {step === 2 && (
              <div>
                <h2 className="text-base font-semibold">Review Your Order</h2>

                <ul className="mt-4 divide-y divide-border rounded-xl border border-border" aria-label="Order items">
                  {lines.map((line) => (
                    <li key={line.id} className="flex items-center gap-3 p-3">
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                        <Image src={line.image} alt="" fill sizes="56px" className="object-cover" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-medium">{line.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatMoney(line.unitPrice)} × {line.quantity}
                        </span>
                      </span>
                      <span className="text-sm font-bold">{formatMoney(line.lineTotal)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border p-4 text-sm">
                    <p className="font-semibold">Ship To</p>
                    <p className="mt-1.5 text-muted-foreground">
                      {fullName}
                      <br />
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ""}
                      <br />
                      {addr.city}, {addr.state} {addr.postalCode}
                      <br />
                      {addr.country}
                      <br />
                      {addr.phone}
                    </p>
                    <p className="mt-2 text-muted-foreground">{email}</p>
                  </div>
                  <div className="rounded-xl border border-border p-4 text-sm">
                    <p className="font-semibold">Payment &amp; Shipping</p>
                    <p className="mt-1.5 text-muted-foreground">{paymentSummary}</p>
                    <p className="mt-1 text-muted-foreground">
                      {shippingMethod === "express" ? "Express (2-3 business days)" : "Standard (5-7 business days)"}
                    </p>
                    {coupon && (
                      <p className="mt-1 text-emerald-700">
                        Coupon {coupon.code} — {coupon.label}
                      </p>
                    )}
                  </div>
                </div>

                <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-semibold">{formatMoney(subtotal)}</dd>
                  </div>
                  {coupon && discount > 0 && (
                    <div className="flex items-baseline justify-between text-emerald-700">
                      <dt>Discount ({coupon.code})</dt>
                      <dd className="font-semibold">-{formatMoney(discount)}</dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">Shipping</dt>
                    <dd className="font-semibold">{shippingCost === 0 ? "FREE" : formatMoney(shippingCost)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">Tax</dt>
                    <dd className="font-semibold">{formatMoney(tax)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-border pt-3">
                    <dt className="font-bold">Total</dt>
                    <dd className="text-xl font-bold">{formatMoney(total)}</dd>
                  </div>
                </dl>
              </div>
            )}

            {formError && (
              <p role="alert" className="mt-5 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {formError}
              </p>
            )}

            {/* Step navigation */}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || submitting}
              >
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={handleNext}>
                  Continue
                </Button>
              ) : (
                <Button type="button" onClick={() => void handlePlaceOrder()} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {submitting ? "Placing Order…" : `Place Order — ${formatMoney(total)}`}
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Summary rail */}
        <aside aria-label="Order summary" className="h-fit lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold">Order Summary</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {lines.reduce((sum, l) => sum + l.quantity, 0)} items
            </p>
            <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-semibold">{formatMoney(subtotal)}</dd>
              </div>
              {coupon && discount > 0 && (
                <div className="flex items-baseline justify-between text-emerald-700">
                  <dt>Discount ({coupon.code})</dt>
                  <dd className="font-semibold">-{formatMoney(discount)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-semibold">{shippingCost === 0 ? "FREE" : formatMoney(shippingCost)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="font-semibold">{formatMoney(tax)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <dt className="font-bold">Total</dt>
                <dd className="text-lg font-bold">{formatMoney(total)}</dd>
              </div>
            </dl>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Secure 256-bit SSL encrypted checkout
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

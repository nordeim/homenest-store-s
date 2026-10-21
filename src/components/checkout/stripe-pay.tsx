"use client";

import * as React from "react";
// /pure — the LAZY loader entry: @stripe/stripe-js's DEFAULT module eagerly
// injects js.stripe.com/<train>/stripe.js at module-evaluation time. The
// /pure entry fetches ONLY when loadStripe(pk) is actually called — zero
// Stripe traffic unless the payment path is live. (The type-only import
// below stays on the default entry — types are erased at compile.)
import { loadStripe } from "@stripe/stripe-js/pure";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

import { isPublishableKeyConfigured } from "@/lib/stripe-config";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * StripeCheckout — the combined "Payment & Review" island (the Stripe
 * retrofit, PAY-STRIPE-1), mounted ONLY when Stripe is configured AND the
 * card method is selected (the checkout page resolves the env server-side
 * and passes the flag + publishable key; the isPublishableKeyConfigured
 * mirror keeps the two sides in agreement).
 *
 * The PaymentElement must stay mounted on the same page as the confirm
 * button, so the payment + review steps collapse into this panel when the
 * real payment path is live. The demo card form (the DEFAULT unconfigured
 * state) is untouched — this surface is the superset activation, visually
 * harmonized with the checkout wizard's anatomy.
 *
 * Card data NEVER touches this app (PCI SAQ-A): the element is a Stripe
 * iframe; the only values that cross are the clientSecret (mount) and the
 * confirmed PaymentIntent id (placement via the parent's /api/checkout
 * submit — the island never places the order itself).
 */

/** The mint body — the checkout input's placement subset (the same schema
 *  POST /api/stripe/payment-intent parses). */
export type StripeMintSnapshot = {
  email: string;
  customerName: string;
  shippingMethod: "standard" | "express";
  couponCode: string;
  idempotencyKey: string;
  address: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
};

type PaymentIntentSession = {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
};

// The site tokens, as hex, for the Element's iframe styling (the iframe
// cannot read the page's CSS — Stripe's appearance variables are the only
// channel). Mapped from src/app/globals.css @theme inline:
//   --color-primary: hsl(24 70% 50%) → #d96e26
//   --color-foreground: hsl(20 14% 12%) → #231d1a
//   --color-card: hsl(0 0% 100%) → #ffffff
//   --color-muted-foreground: hsl(25 9% 45%) → #7d7168
//   --color-destructive: hsl(0 72% 51%) → #dc2828
//   radius: the --radius-xl pin (12px); font: Inter (the layout's font-sans)
const ELEMENT_APPEARANCE: StripeElementsOptions["appearance"] = {
  theme: "flat",
  variables: {
    colorPrimary: "#d96e26",
    colorBackground: "#ffffff",
    colorText: "#231d1a",
    colorTextSecondary: "#7d7168",
    colorDanger: "#dc2828",
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
    borderRadius: "12px",
    spacingUnit: "4px",
  },
};

export function StripeCheckout({
  snapshot,
  publishableKey,
  placementError,
  submitting,
  onConfirmed,
  onBack,
  children,
}: {
  snapshot: StripeMintSnapshot;
  publishableKey: string | null;
  /** The parent's placement error (the re-mint signal — a "cart changed"
   *  rejection clears the session so a fresh intent is minted). */
  placementError: string | null;
  submitting: boolean;
  /** Carries the CONFIRMED intent id into the parent's /api/checkout submit. */
  onConfirmed: (stripePaymentIntentId: string) => void;
  onBack: () => void;
  /** The review block (totals + ship-to) — the parent's step-3 anatomy. */
  children: React.ReactNode;
}) {
  const [session, setSession] = React.useState<PaymentIntentSession | null>(null);
  const [sessionError, setSessionError] = React.useState<string | null>(null);

  // The mint key: ANY snapshot change (address, email, coupon, shipping
  // method) mints a fresh intent — the deterministic server key reuses the
  // same intent for the same inputs, so this is cheap and idempotent.
  const mintKey = JSON.stringify(snapshot);

  // Adjust-state-during-render (the React-endorsed pattern — no setState in
  // effects): a changed snapshot or a placement "cart changed" rejection
  // clears the session during render so the "Preparing…" state shows; the
  // mint effect below re-runs (session === null) and re-mints.
  const [lastKey, setLastKey] = React.useState(mintKey);
  if (mintKey !== lastKey) {
    setLastKey(mintKey);
    setSession(null);
    setSessionError(null);
  }
  const [lastError, setLastError] = React.useState(placementError);
  if (placementError !== lastError) {
    setLastError(placementError);
    if (placementError && /changed/i.test(placementError) && session !== null) {
      setSession(null);
    }
  }

  // The mint (mount + re-mint): the PaymentIntent is server-minted with the
  // deterministic idempotency key — re-mounts reuse the SAME intent; a
  // changed snapshot lands here with a fresh key → a fresh amount. All
  // setState calls live in the async callback.
  React.useEffect(() => {
    if (session !== null || sessionError !== null) return;
    let cancelled = false;
    fetch("/api/stripe/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: mintKey,
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = (await res.json()) as {
          clientSecret?: string;
          paymentIntentId?: string;
          amount?: number;
          error?: string;
        };
        if (!res.ok || !data.clientSecret || !data.paymentIntentId || typeof data.amount !== "number") {
          setSessionError(data.error ?? "We could not start your payment. Please try again.");
          return;
        }
        setSession({
          clientSecret: data.clientSecret,
          paymentIntentId: data.paymentIntentId,
          amount: data.amount,
        });
      })
      .catch(() => {
        if (!cancelled) setSessionError("Network error — please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [session, sessionError, mintKey]);

  const stripePromise = React.useMemo(
    () => (isPublishableKeyConfigured(publishableKey) ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  if (!stripePromise) {
    // The mirror disagreed with the server flag — render the demo-shaped
    // notice (never a crash; the operator sees an unconfigured island).
    return (
      <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground" role="status">
        Card payments are unavailable right now. Please try again later.
      </div>
    );
  }

  return (
    <div className="mt-4">
      {session ? (
        <Elements
          key={session.clientSecret}
          stripe={stripePromise}
          options={{ clientSecret: session.clientSecret, appearance: ELEMENT_APPEARANCE }}
        >
          <CardPaymentPanel
            intentId={session.paymentIntentId}
            amount={session.amount}
            placementError={placementError}
            submitting={submitting}
            onConfirmed={onConfirmed}
            onBack={onBack}
          >
            {children}
          </CardPaymentPanel>
        </Elements>
      ) : (
        <div
          className="mt-4 rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground"
          role="status"
        >
          {sessionError ?? "Preparing secure card payment…"}
          {sessionError && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-3 h-7 rounded-lg text-xs"
              onClick={() => setSessionError(null)}
            >
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The card branch — everything inside <Elements>: the PaymentElement
 * (Stripe's iframe — card data never leaves it), the review block, and the
 * single Pay button that confirms then hands the placement to the parent.
 */
function CardPaymentPanel({
  intentId,
  amount,
  placementError,
  submitting,
  onConfirmed,
  onBack,
  children,
}: {
  intentId: string;
  amount: number;
  placementError: string | null;
  submitting: boolean;
  onConfirmed: (stripePaymentIntentId: string) => void;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [elementComplete, setElementComplete] = React.useState(false);
  const [payError, setPayError] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState(false);

  async function handlePay() {
    if (!stripe || !elements) return;
    setPaying(true);
    setPayError(null);
    try {
      // Submit the element's details (validation runs inside the iframe).
      const submitted = await elements.submit();
      if (submitted.error) {
        setPayError(submitted.error.message ?? "Please check your card details.");
        setPaying(false);
        return;
      }
      // Confirm (and, with test cards, capture) — no redirect: we stay to
      // place the order ourselves (the webhook backstop covers a tab death
      // between confirm and place).
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (error) {
        setPayError(error.message ?? "Your payment could not be completed. Please try again.");
        setPaying(false);
        return;
      }
      if (paymentIntent?.status !== "succeeded") {
        // Additional verification pending (e.g. 3DS redirect flow) — the
        // honest copy; the customer can retry once it settles.
        setPayError("Your payment needs more time to process. Please wait a moment and try again.");
        setPaying(false);
        return;
      }
      // Confirmed: hand the intent id to the parent's placement submit.
      onConfirmed(paymentIntent.id);
    } catch {
      setPayError("We could not process your payment. Please try again.");
      setPaying(false);
    }
  }

  const busy = paying || submitting;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <PaymentElement
          onChange={(e) => setElementComplete(e.complete)}
          options={{ layout: "tabs" }}
        />
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Payments are processed securely by Stripe — your card details never touch our servers.
        </p>
      </div>

      {children}

      {(payError ?? placementError) && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {payError ?? placementError}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button
          type="button"
          className={cn("font-semibold")}
          disabled={busy || !elementComplete || !stripe}
          onClick={() => void handlePay()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Lock className="h-4 w-4" aria-hidden />
          )}
          {paying ? "Paying…" : submitting ? "Placing Order…" : `Pay — ${formatMoney(amount)}`}
        </Button>
      </div>
    </div>
  );
}

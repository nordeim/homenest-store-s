/**
 * Admin payment-ops seams (the Stripe retrofit — ported from the reference
 * implementation's PAY-OPS/REFUND-ACTION family, compacted to this repo's
 * needs) — the pure derivations behind the admin payments surface and the
 * refund loop. Pure + SDK-free by design (unit-pinned in
 * tests/unit/admin-payments.test.ts).
 */

import { STRIPE_FAILURE_REASON } from "./stripe-payment";

// ---------------------------------------------------------------------------
// The outcome resolver — the payments surface's honest derivation
// ---------------------------------------------------------------------------

/** The two Stripe event types the payments surface treats specially. */
export const PAYMENT_INTENT_SUCCEEDED_TYPE = "payment_intent.succeeded";
export const PAYMENT_INTENT_FAILED_TYPE = "payment_intent.payment_failed";

export type PaymentOutcomeView = {
  /** The operator-facing outcome chip: "Placed", "Refund needed", "Failed",
   *  "Ignored", or "Recorded". */
  label: string;
  /** True for the refund-needed family — the deterministic-failure signal
   *  the webhook records + 200s (an operator must act on it). */
  refundNeeded: boolean;
};

/**
 * The outcome derives PURELY from DB state: a succeeded event with no
 * linked order is exactly the deterministic-failure family (amount
 * mismatch, stock-short, coupon-cap, unusable metadata, vanished cart —
 * the failureReason column enriches the WHY) — the refund-needed signal.
 * Everything else renders its calm state.
 */
export function paymentOutcomeView(
  event: { type: string; paymentIntentId: string | null },
  linkedOrderNumber: string | null,
): PaymentOutcomeView {
  if (event.type === PAYMENT_INTENT_SUCCEEDED_TYPE && linkedOrderNumber === null) {
    return { label: "Refund needed", refundNeeded: true };
  }
  if (event.type === PAYMENT_INTENT_SUCCEEDED_TYPE) {
    return { label: `Placed (${linkedOrderNumber})`, refundNeeded: false };
  }
  if (event.type === PAYMENT_INTENT_FAILED_TYPE) {
    return { label: "Failed", refundNeeded: false };
  }
  if (event.type === "charge.refunded") {
    return { label: "Refund", refundNeeded: false };
  }
  return { label: "Recorded", refundNeeded: false };
}

// ---------------------------------------------------------------------------
// The failure-reason view (REASON-TRAIL-1's read side)
// ---------------------------------------------------------------------------

export type PaymentFailureReasonView = {
  visible: boolean;
  label?: string;
};

/**
 * Maps the StripeEvent.failureReason code to operator copy. Shares the
 * canonical vocabulary with the webhook's write side (STRIPE_FAILURE_REASON
 * — the single source; no stringly-typed drift).
 */
export function paymentFailureReasonView(reason: string | null): PaymentFailureReasonView {
  if (!reason) return { visible: false };
  const labels: Record<string, string> = {
    [STRIPE_FAILURE_REASON.amountMismatch]: "Reason: amount mismatch vs cart total",
    [STRIPE_FAILURE_REASON.checkoutRejected]: "Reason: checkout rejected (stock / coupon / price)",
    [STRIPE_FAILURE_REASON.metadataUnusable]: "Reason: payment metadata unusable",
    [STRIPE_FAILURE_REASON.cartUnavailable]: "Reason: cart unavailable at placement",
  };
  return { visible: true, label: labels[reason] ?? `Reason: ${reason}` };
}

// ---------------------------------------------------------------------------
// refundEligibility (REFUND-ACTION-1)
// ---------------------------------------------------------------------------

export type RefundEligibility =
  | { eligible: true }
  | { eligible: false; reason: "no-stripe-payment" | "not-paid" | "already-refunded" };

/**
 * The shared refund gate — composed by BOTH the order dialog's render (the
 * Refund control) and refundOrderAction (the guard). The shared-seam rule:
 * the button and the action can never disagree because they derive from the
 * same function.
 *
 * Eligibility is MONEY-side only: a Stripe payment that was captured
 * (stripePaymentIntentId set, paymentStatus "paid") and has not been
 * refunded. Fulfillment status is orthogonal — a cancelled-but-paid order
 * is exactly the refund case.
 *
 * - no intent → `no-stripe-payment` (the demo path — nothing was ever
 *   charged).
 * - paymentStatus "refunded" → `already-refunded` (the post-reflection
 *   state — the control unmounts, the action refuses).
 * - paymentStatus not "paid" (null demo columns) → `not-paid`.
 */
export function refundEligibility(order: {
  stripePaymentIntentId: string | null;
  paymentStatus: string | null;
}): RefundEligibility {
  if (!order.stripePaymentIntentId) return { eligible: false, reason: "no-stripe-payment" };
  if (order.paymentStatus === "refunded") return { eligible: false, reason: "already-refunded" };
  if (order.paymentStatus !== "paid") return { eligible: false, reason: "not-paid" };
  return { eligible: true };
}

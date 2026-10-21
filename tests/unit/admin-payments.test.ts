import { describe, expect, it } from "vitest";

import {
  paymentFailureReasonView,
  paymentOutcomeView,
  refundEligibility,
} from "@/lib/admin-payments";

/**
 * The admin payment-ops seams (the Stripe retrofit's refund loop +
 * payments-surface derivations) — pure, SDK-free.
 */

describe("refundEligibility — the shared refund gate", () => {
  it("a captured Stripe payment that has not been refunded IS eligible", () => {
    expect(refundEligibility({ stripePaymentIntentId: "pi_1", paymentStatus: "paid" })).toEqual({
      eligible: true,
    });
  });

  it("no intent → no-stripe-payment (the demo path — nothing was ever charged)", () => {
    expect(refundEligibility({ stripePaymentIntentId: null, paymentStatus: null })).toEqual({
      eligible: false,
      reason: "no-stripe-payment",
    });
  });

  it("paymentStatus refunded → already-refunded (the post-reflection state)", () => {
    expect(refundEligibility({ stripePaymentIntentId: "pi_1", paymentStatus: "refunded" })).toEqual({
      eligible: false,
      reason: "already-refunded",
    });
  });

  it("any other paymentStatus → not-paid (null demo columns)", () => {
    expect(refundEligibility({ stripePaymentIntentId: "pi_1", paymentStatus: null })).toEqual({
      eligible: false,
      reason: "not-paid",
    });
  });
});

describe("paymentOutcomeView — the honest outcome derivation", () => {
  it("a succeeded event with NO linked order is the refund-needed signal", () => {
    expect(paymentOutcomeView({ type: "payment_intent.succeeded", paymentIntentId: "pi_1" }, null)).toEqual({
      label: "Refund needed",
      refundNeeded: true,
    });
  });

  it("a succeeded event WITH a linked order renders the order number", () => {
    expect(paymentOutcomeView({ type: "payment_intent.succeeded", paymentIntentId: "pi_1" }, "ORD-2026-001")).toEqual({
      label: "Placed (ORD-2026-001)",
      refundNeeded: false,
    });
  });

  it("failed / refunded / other events render their calm states", () => {
    expect(paymentOutcomeView({ type: "payment_intent.payment_failed", paymentIntentId: "pi_1" }, null)).toEqual({
      label: "Failed",
      refundNeeded: false,
    });
    expect(paymentOutcomeView({ type: "charge.refunded", paymentIntentId: "pi_1" }, "ORD-2026-001")).toEqual({
      label: "Refund",
      refundNeeded: false,
    });
    expect(paymentOutcomeView({ type: "customer.created", paymentIntentId: null }, null)).toEqual({
      label: "Recorded",
      refundNeeded: false,
    });
  });
});

describe("paymentFailureReasonView — the reason vocabulary's read side", () => {
  it("null → invisible (the calm state)", () => {
    expect(paymentFailureReasonView(null)).toEqual({ visible: false });
  });

  it("every canonical code maps to operator copy", () => {
    expect(paymentFailureReasonView("amount-mismatch")).toEqual({
      visible: true,
      label: "Reason: amount mismatch vs cart total",
    });
    expect(paymentFailureReasonView("checkout-rejected")).toEqual({
      visible: true,
      label: "Reason: checkout rejected (stock / coupon / price)",
    });
    expect(paymentFailureReasonView("metadata-unusable")).toEqual({
      visible: true,
      label: "Reason: payment metadata unusable",
    });
    expect(paymentFailureReasonView("cart-unavailable")).toEqual({
      visible: true,
      label: "Reason: cart unavailable at placement",
    });
  });

  it("an unknown code falls through honestly (never a crash)", () => {
    expect(paymentFailureReasonView("future-code")).toEqual({
      visible: true,
      label: "Reason: future-code",
    });
  });
});

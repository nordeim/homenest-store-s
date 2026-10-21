import { describe, expect, it } from "vitest";

import {
  buildPaymentIntentParams,
  chargeRefundedReflection,
  checkoutSnapshotHash,
  classifyStripeEvent,
  classifyWebhookPlacementError,
  isIntentAnchorP2002,
  parseStripeWebhookEvent,
  paymentIntentLast4,
  StripeAmountMismatchError,
  stripeEventIntentId,
  stripeIdempotencyKey,
  stripeRefundIdempotencyKey,
  STRIPE_FAILURE_REASON,
  verifyPaymentIntentForPlacement,
} from "@/lib/stripe-payment";

/**
 * The Stripe retrofit's pure seams (PAY-STRIPE-1/2) — SDK-free by design:
 * every contract here is unit-pinned without network or keys.
 */

const SNAPSHOT = {
  email: "guest@test.dev",
  customerName: "Guest Guest",
  shippingMethod: "standard" as const,
  couponCode: "WELCOME10",
  idempotencyKey: "key-1234567890abcdef",
  address: {
    label: "Home",
    fullName: "Guest Guest",
    phone: "+1 555 000 0000",
    line1: "1 Main Street",
    line2: "",
    city: "Testville",
    state: "TS",
    postalCode: "12345",
    country: "United States",
  },
};

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe("checkoutSnapshotHash + stripeIdempotencyKey", () => {
  it("the same inputs hash identically (re-mounts reuse the SAME intent)", () => {
    expect(checkoutSnapshotHash(SNAPSHOT)).toBe(checkoutSnapshotHash(SNAPSHOT));
    expect(stripeIdempotencyKey("cart1", 3129, checkoutSnapshotHash(SNAPSHOT))).toBe(
      stripeIdempotencyKey("cart1", 3129, checkoutSnapshotHash(SNAPSHOT)),
    );
  });

  it("any input change mints a fresh key (a fresh intent at the fresh amount)", () => {
    const base = stripeIdempotencyKey("cart1", 3129, checkoutSnapshotHash(SNAPSHOT));
    expect(stripeIdempotencyKey("cart2", 3129, checkoutSnapshotHash(SNAPSHOT))).not.toBe(base);
    expect(stripeIdempotencyKey("cart1", 3200, checkoutSnapshotHash(SNAPSHOT))).not.toBe(base);
    const changed = { ...SNAPSHOT, couponCode: "SAVE20" };
    expect(stripeIdempotencyKey("cart1", 3129, checkoutSnapshotHash(changed))).not.toBe(base);
  });

  it("the refund key is ONE full refund per intent (readable by design)", () => {
    expect(stripeRefundIdempotencyKey("pi_123")).toBe("refund:pi_123");
    expect(stripeRefundIdempotencyKey("pi_123")).toBe(stripeRefundIdempotencyKey("pi_123"));
    expect(stripeRefundIdempotencyKey("pi_456")).not.toBe(stripeRefundIdempotencyKey("pi_123"));
  });
});

// ---------------------------------------------------------------------------
// PaymentIntent params
// ---------------------------------------------------------------------------

describe("buildPaymentIntentParams", () => {
  it("carries the server-derived amount, USD, automatic payment methods, and the full rebuild metadata", () => {
    const params = buildPaymentIntentParams({
      snapshot: SNAPSHOT,
      totalCents: 3129,
      cartId: "cart_1",
      userId: "user_1",
      cartToken: "tok_1",
    });
    expect(params.amount).toBe(3129);
    expect(params.currency).toBe("usd");
    expect(params.automatic_payment_methods).toEqual({ enabled: true });
    expect(params.metadata.cartId).toBe("cart_1");
    expect(params.metadata.userId).toBe("user_1");
    expect(params.metadata.email).toBe("guest@test.dev");
    expect(params.metadata.customerName).toBe("Guest Guest");
    expect(params.metadata.shippingMethod).toBe("standard");
    expect(params.metadata.couponCode).toBe("WELCOME10");
    expect(params.metadata.cartToken).toBe("tok_1");
    expect(params.metadata.idempotencyKey).toBe("key-1234567890abcdef");
    // The shipping snapshot is the webhook's parse contract (addressSchema).
    expect(JSON.parse(params.metadata.shipping ?? "{}")).toEqual(SNAPSHOT.address);
  });

  it("guest shapes serialize empty userId/cartToken (the webhook's null branches)", () => {
    const params = buildPaymentIntentParams({
      snapshot: SNAPSHOT,
      totalCents: 100,
      cartId: "cart_1",
      userId: null,
      cartToken: null,
    });
    expect(params.metadata.userId).toBe("");
    expect(params.metadata.cartToken).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Placement verification
// ---------------------------------------------------------------------------

describe("verifyPaymentIntentForPlacement", () => {
  it("a succeeded intent at the exact total in USD passes", () => {
    expect(verifyPaymentIntentForPlacement({ status: "succeeded", amount: 3129, currency: "usd" }, 3129)).toEqual({ ok: true });
  });

  it("a non-succeeded status → customer-safe copy (never Stripe internals)", () => {
    const result = verifyPaymentIntentForPlacement({ status: "requires_action", amount: 3129, currency: "usd" }, 3129);
    expect(result).toEqual({
      ok: false,
      reason: "status",
      message: "Your payment could not be completed. Please try again.",
    });
  });

  it("an amount mismatch → the re-mint signal copy (the island's cart-changed branch)", () => {
    const result = verifyPaymentIntentForPlacement({ status: "succeeded", amount: 2500, currency: "usd" }, 3129);
    expect(result).toEqual({
      ok: false,
      reason: "amount",
      message: "Your cart changed since you started checkout. Please review your order and try again.",
    });
  });

  it("a non-USD currency → the contact-support copy", () => {
    const result = verifyPaymentIntentForPlacement({ status: "succeeded", amount: 3129, currency: "eur" }, 3129);
    expect(result).toEqual({
      ok: false,
      reason: "currency",
      message: "We could not verify your payment. Please contact support if you were charged.",
    });
  });

  it("currency matching is case-insensitive (Stripe sends lowercase)", () => {
    expect(verifyPaymentIntentForPlacement({ status: "succeeded", amount: 3129, currency: "USD" }, 3129)).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Event classification + the failure policy
// ---------------------------------------------------------------------------

describe("classifyStripeEvent", () => {
  it("maps the intent family and ignores everything else", () => {
    expect(classifyStripeEvent("payment_intent.succeeded")).toBe("succeeded");
    expect(classifyStripeEvent("payment_intent.payment_failed")).toBe("failed");
    expect(classifyStripeEvent("charge.refunded")).toBe("ignored");
    expect(classifyStripeEvent("customer.created")).toBe("ignored");
  });
});

/** A Prisma-shaped P2002 with the given target. */
function p2002(target: string[] | string) {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { target },
  });
}

describe("classifyWebhookPlacementError — the failure policy", () => {
  it("P2002 on the dedup row or the intent anchor → duplicate (never double-place)", () => {
    expect(classifyWebhookPlacementError(p2002(["eventId"]))).toBe("duplicate");
    expect(classifyWebhookPlacementError(p2002(["stripePaymentIntentId"]))).toBe("duplicate");
    // The constraint-NAME string shape (the tolerant matcher's contract).
    expect(classifyWebhookPlacementError(p2002("Order_stripePaymentIntentId_key"))).toBe("duplicate");
    expect(classifyWebhookPlacementError(p2002("StripeEvent_eventId_key"))).toBe("duplicate");
  });

  it("P2002 on the idempotency key → duplicate (the client path won the race)", () => {
    expect(classifyWebhookPlacementError(p2002(["idempotencyKey"]))).toBe("duplicate");
  });

  it("a CheckoutError-shaped 4xx → permanent (deterministic: retry cannot succeed)", () => {
    const stockShort = Object.assign(new Error("Only 2 left"), { status: 409 });
    expect(classifyWebhookPlacementError(stockShort)).toBe("permanent");
  });

  it("StripeAmountMismatchError → permanent (the in-tx amount guard)", () => {
    expect(classifyWebhookPlacementError(new StripeAmountMismatchError())).toBe("permanent");
  });

  it("a number-anchor P2002 → transient (retry with the next suffix; Stripe retries)", () => {
    expect(classifyWebhookPlacementError(p2002(["number"]))).toBe("transient");
  });

  it("everything else → transient (tx errors — the 500/Stripe-retry family)", () => {
    expect(classifyWebhookPlacementError(new Error("SQLITE_BUSY"))).toBe("transient");
    expect(classifyWebhookPlacementError(null)).toBe("transient");
    expect(classifyWebhookPlacementError({ code: "P2025" })).toBe("transient");
  });

  it("isIntentAnchorP2002 is the action path's already-placed gate", () => {
    expect(isIntentAnchorP2002(p2002(["stripePaymentIntentId"]))).toBe(true);
    expect(isIntentAnchorP2002(p2002(["number"]))).toBe(false);
    expect(isIntentAnchorP2002(new Error("not a prisma error"))).toBe(false);
  });
});

describe("STRIPE_FAILURE_REASON — the canonical vocabulary", () => {
  it("the write side and the read side share the single source", () => {
    expect(STRIPE_FAILURE_REASON).toEqual({
      metadataUnusable: "metadata-unusable",
      cartUnavailable: "cart-unavailable",
      amountMismatch: "amount-mismatch",
      checkoutRejected: "checkout-rejected",
    });
  });
});

// ---------------------------------------------------------------------------
// Envelope parsing
// ---------------------------------------------------------------------------

describe("parseStripeWebhookEvent", () => {
  it("accepts a well-formed event (id + data.object.id are the floor)", () => {
    const parsed = parseStripeWebhookEvent({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1", status: "succeeded", amount: 3129, currency: "usd" } },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts the charge family's shapes (payment_intent + refund fields optional)", () => {
    const parsed = parseStripeWebhookEvent({
      id: "evt_2",
      type: "charge.refunded",
      data: { object: { id: "ch_1", payment_intent: "pi_1", refunded: true, amount: 3129, amount_refunded: 3129 } },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing id, a missing data.object, and non-object shapes", () => {
    expect(parseStripeWebhookEvent({ type: "x", data: { object: { id: "pi" } } }).success).toBe(false);
    expect(parseStripeWebhookEvent({ id: "", type: "x", data: { object: { id: "pi" } } }).success).toBe(false);
    expect(parseStripeWebhookEvent({ id: "evt", type: "x", data: {} }).success).toBe(false);
    expect(parseStripeWebhookEvent("not an object").success).toBe(false);
    expect(parseStripeWebhookEvent(null).success).toBe(false);
  });
});

describe("stripeEventIntentId — the honest intent column", () => {
  it("prefers the charge's payment_intent reference; falls back to the object's own id", () => {
    expect(stripeEventIntentId({ id: "ch_1", payment_intent: "pi_9" })).toBe("pi_9");
    expect(stripeEventIntentId({ id: "pi_9" })).toBe("pi_9");
    expect(stripeEventIntentId({ id: "ch_1", payment_intent: "" })).toBe("ch_1");
  });
});

// ---------------------------------------------------------------------------
// chargeRefundedReflection
// ---------------------------------------------------------------------------

describe("chargeRefundedReflection", () => {
  it("a FULL refund of a paid order → paymentStatus refunded + the formatted note", () => {
    expect(chargeRefundedReflection({ paymentStatus: "paid" }, { refunded: true, amount: 3129, amount_refunded: 3129 })).toEqual({
      paymentStatus: "refunded",
      eventNote: "Refunded $31.29 via Stripe",
    });
  });

  it("a PARTIAL refund → the note only (the paid capture state stays honest)", () => {
    expect(chargeRefundedReflection({ paymentStatus: "paid" }, { refunded: false, amount: 3129, amount_refunded: 1000 })).toEqual({
      paymentStatus: null,
      eventNote: "Partially refunded $10.00 of $31.29 via Stripe",
    });
  });

  it("a non-paid order reflects NOTHING (demo columns, already refunded, re-delivery)", () => {
    expect(chargeRefundedReflection({ paymentStatus: null }, { refunded: true, amount: 100 })).toEqual({
      paymentStatus: null,
      eventNote: null,
    });
    expect(chargeRefundedReflection({ paymentStatus: "refunded" }, { refunded: true, amount: 100 })).toEqual({
      paymentStatus: null,
      eventNote: null,
    });
  });
});

// ---------------------------------------------------------------------------
// last4 extraction
// ---------------------------------------------------------------------------

describe("paymentIntentLast4 — defensive against every SDK shape", () => {
  it("reads the expanded payment method's card last4", () => {
    expect(paymentIntentLast4({ payment_method: { card: { last4: "4242" } } })).toBe("4242");
  });

  it("falls back to the expanded latest_charge's payment_method_details", () => {
    expect(
      paymentIntentLast4({ payment_method: "pm_123", latest_charge: { payment_method_details: { card: { last4: "1881" } } } }),
    ).toBe("1881");
  });

  it("un-expanded string references carry no last4 → null", () => {
    expect(paymentIntentLast4({ payment_method: "pm_123", latest_charge: "ch_123" })).toBeNull();
    expect(paymentIntentLast4({})).toBeNull();
    expect(paymentIntentLast4({ payment_method: null, latest_charge: null })).toBeNull();
  });
});

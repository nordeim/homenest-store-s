import { NextRequest, NextResponse } from "next/server";

import { getCartSummary } from "@/lib/cart";
import { applyCouponCode } from "@/lib/coupons";
import { db } from "@/lib/db";
import { computeOrderMoney } from "@/lib/order-money";
import { CheckoutError, placeOrderTx, type PlaceOrderArgs } from "@/lib/order-placement";
import { isUniqueViolation, uniqueTargetField } from "@/lib/prisma-errors";
import { getSettings } from "@/lib/settings";
import { getStripe, STRIPE_WEBHOOK_TOLERANCE_SECONDS } from "@/lib/stripe";
import {
  chargeRefundedReflection,
  classifyStripeEvent,
  classifyWebhookPlacementError,
  parseStripeWebhookEvent,
  STRIPE_FAILURE_REASON,
  stripeEventIntentId,
  StripeAmountMismatchError,
  verifyPaymentIntentForPlacement,
} from "@/lib/stripe-payment";
import { addressSchema, emailSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook — POST /api/stripe/webhook (PAY-STRIPE-1 retrofit, ported
 * from the reference implementation's session-22/23 design).
 *
 * Stripe delivers asynchronous payment events here — the backstop for the
 * one failure the synchronous client path cannot cover (the customer's
 * browser dies between the PaymentIntent confirmation and the placement
 * submit: payment captured, no order written).
 *
 * Design (the C8/R10-7/H4d lesson family from the reference, adapted to
 * this repo's transactional money authority):
 * - **Raw-body signature verification** (300s tolerance) BEFORE anything —
 *   `constructEvent` on the exact bytes; a bad signature is a 400 with
 *   customer-safe copy (never a 500, never internals).
 * - **The dedup row commits WITH the side effects (H4d/L9, PAY-STRIPE-2):**
 *   for `payment_intent.succeeded`, the `StripeEvent` insert happens INSIDE
 *   the placement transaction (placeOrderTx's stripeEvent arg). A TRANSIENT
 *   placement failure rolls the row back and answers 500 — Stripe retries
 *   (up to 3 days, exponential backoff), and the retry re-attempts the full
 *   placement. A row committed before the tx + a 200 on every failure would
 *   turn a transient blip into a permanently orphaned captured payment.
 * - **The failure policy (the classifyWebhookPlacementError seam):**
 *   duplicate (P2002 on eventId / stripePaymentIntentId / idempotencyKey —
 *   a concurrent delivery or the client path won the race) → 200 with the
 *   winner's order number; permanent (a CheckoutError 4xx business
 *   rejection — stock short, coupon cap — or the in-tx amount guard:
 *   deterministic, a retry cannot succeed) → record + 200 + the ops refund
 *   trail; transient (everything else, incl. a P2002 on `number` from a
 *   concurrent placement race) → 500, the row rolled back, Stripe retries.
 * - **payment_intent.payment_failed**: recorded + logged only.
 * - **charge.refunded**: the ORDER-side reflection (REFUND-ACTION-1) — the
 *   single writer of refund state; the admin refund action never writes it.
 * - Everything else: recorded, 200 ignored.
 *
 * The webhook answers 400 when Stripe is unconfigured: there is nothing to
 * verify a signature against (honest, safe, and the E2E contract).
 */

function safe400(message: string) {
  return NextResponse.json({ received: false, message }, { status: 400 });
}

/**
 * Record the delivery standalone (no side effects to couple): the
 * record-only classifications, the client-path-precedence no-op, and the
 * permanent-failure refund trails. Tolerates a concurrent recording of the
 * same event (P2002 → the delivery is already accounted for).
 *
 * The row persists the payload AMOUNT (minor units — the payments surface
 * renders the magnitude beside the outcome) and the HONEST intent id
 * (`payment_intent` for charge-family objects, the object's own id
 * otherwise). The optional `failureReason` persists the canonical
 * deterministic-failure code at the permanent-classification write sites —
 * the refund-needed family's WHY joins the row (the payments surface maps
 * it to operator copy).
 */
async function recordEvent(
  evt: {
    id: string;
    type: string;
    data: { object: { id: string; amount?: number; payment_intent?: string } };
  },
  failureReason?: string,
) {
  try {
    await db.stripeEvent.create({
      data: {
        eventId: evt.id,
        type: evt.type,
        paymentIntentId: stripeEventIntentId(evt.data.object),
        amount: evt.data.object.amount ?? null,
        failureReason: failureReason ?? null,
      },
    });
  } catch (error) {
    if (!uniqueTargetField(error, "eventId")) throw error;
  }
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    // Unconfigured: nothing to verify against — reject honestly, safely.
    return safe400("Webhook unavailable.");
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return safe400("Missing signature.");
  }

  // The EXACT raw bytes (constructEvent is byte-sensitive — request.json()
  // would re-serialize and break the HMAC).
  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret, STRIPE_WEBHOOK_TOLERANCE_SECONDS);
  } catch {
    return safe400("Invalid signature.");
  }

  // Defense in depth: constructEvent verified authenticity; the structural
  // parse verifies processability (a usable id + data.object).
  const parsed = parseStripeWebhookEvent(JSON.parse(JSON.stringify(event)));
  if (!parsed.success) {
    return safe400("Invalid event.");
  }
  const evt = parsed.data;
  const class_ = classifyStripeEvent(evt.type);

  if (class_ === "failed") {
    await recordEvent(evt);
    console.error("[stripe-webhook] payment failed", evt.data.object.id);
    return NextResponse.json({ received: true });
  }

  // ---- charge.refunded: the ORDER-side reflection (REFUND-ACTION-1). The
  // admin refund action never writes refund state — this branch is the
  // single writer. A FULL refund (Stripe's own `refunded` boolean)
  // transitions paymentStatus to "refunded" + a payment_refunded
  // OrderEvent; a partial refund writes the timeline note only. When there
  // ARE side effects to write, the dedup row commits INSIDE the same
  // transaction (the H4d/L9 rule — a transient failure rolls BOTH back and
  // the 500 makes Stripe retry the whole thing). The record-only paths (no
  // linked order / a non-paid order) keep the standalone recordEvent.
  if (evt.type === "charge.refunded") {
    // Fast duplicate short-circuit: a Stripe re-delivery of the same event
    // id reflects NOTHING twice.
    const alreadyRefundRecorded = await db.stripeEvent.findUnique({ where: { eventId: evt.id } });
    if (alreadyRefundRecorded) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const intentId = stripeEventIntentId(evt.data.object);
    const linked = await db.order.findUnique({
      where: { stripePaymentIntentId: intentId },
      select: { id: true, paymentStatus: true },
    });

    if (linked && linked.paymentStatus === "paid") {
      const reflection = chargeRefundedReflection(linked, evt.data.object);
      try {
        await db.$transaction(async (tx) => {
          await tx.stripeEvent.create({
            data: {
              eventId: evt.id,
              type: evt.type,
              paymentIntentId: intentId,
              amount: evt.data.object.amount ?? null,
            },
          });
          if (reflection.paymentStatus) {
            await tx.order.update({
              where: { id: linked.id },
              data: { paymentStatus: reflection.paymentStatus },
            });
          }
          await tx.orderEvent.create({
            data: { orderId: linked.id, type: "payment_refunded", note: reflection.eventNote },
          });
        });
      } catch (error) {
        if (classifyWebhookPlacementError(error) === "duplicate") {
          // A concurrent delivery won the race — its reflection committed
          // with its row; this one is accounted for.
          return NextResponse.json({ received: true, duplicate: true });
        }
        // Transient: the transaction rolled back INCLUDING the dedup row.
        // Answer 500 — Stripe retries, and the retry re-attempts the full
        // reflection.
        console.error("[stripe-webhook] refund reflection failure — answering 500 so Stripe retries", intentId, error);
        return NextResponse.json({ received: false }, { status: 500 });
      }
    } else {
      // No linked order or a non-paid order (nothing to reflect): record-only.
      await recordEvent(evt);
    }
    return NextResponse.json({ received: true });
  }

  if (class_ !== "succeeded") {
    await recordEvent(evt);
    return NextResponse.json({ received: true, ignored: true });
  }

  // ---- payment_intent.succeeded: the backstop.
  const intentView = evt.data.object;
  try {
    // Fast duplicate short-circuit (the common Stripe retry AFTER a
    // committed placement — the row exists, nothing to re-attempt).
    const alreadyRecorded = await db.stripeEvent.findUnique({ where: { eventId: evt.id } });
    if (alreadyRecorded) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // The client-path precedence (the normal case): an order already holds
    // the intent id — record the delivery, answer with the order.
    const placed = await db.order.findUnique({
      where: { stripePaymentIntentId: intentView.id },
      select: { number: true },
    });
    if (placed) {
      await recordEvent(evt);
      return NextResponse.json({ received: true, order: placed.number });
    }

    // The orphaned-payment case: rebuild the placement input from the
    // intent's OWN metadata (embedded at mint time).
    const meta = intentView.metadata ?? {};
    const shippingSnapshot = addressSchema.safeParse(
      meta.shipping ? JSON.parse(meta.shipping) : null,
    );
    const email = emailSchema.safeParse(meta.email ?? "");
    const cartId = typeof meta.cartId === "string" && meta.cartId.length > 0 ? meta.cartId : null;
    const userId = typeof meta.userId === "string" && meta.userId.length > 0 ? meta.userId : null;
    const customerName =
      typeof meta.customerName === "string" && meta.customerName.trim().length >= 2
        ? meta.customerName.trim()
        : null;
    const shippingMethod =
      meta.shippingMethod === "standard" || meta.shippingMethod === "express"
        ? meta.shippingMethod
        : null;
    const couponCode =
      typeof meta.couponCode === "string" && meta.couponCode.length > 0 ? meta.couponCode : null;
    const idempotencyKey =
      typeof meta.idempotencyKey === "string" && meta.idempotencyKey.length > 0
        ? meta.idempotencyKey
        : null;
    const cartToken =
      typeof meta.cartToken === "string" && meta.cartToken.length > 0 ? meta.cartToken : null;
    if (!shippingSnapshot.success || !email.success || !cartId || !customerName || !shippingMethod) {
      // Not our checkout intent (or metadata drifted) — deterministic: record
      // + the ops refund trail (never a 5xx; a retry could not succeed).
      await recordEvent(evt, STRIPE_FAILURE_REASON.metadataUnusable);
      console.error(
        "[stripe-webhook] orphaned payment without usable metadata — refund via dashboard",
        intentView.id,
        intentView.amount,
      );
      return NextResponse.json({ received: true });
    }

    // Re-load the cart BY ID (no cookie/session in a webhook) + re-derive
    // the money with the SAME seams the mint and the placement use.
    const summary = await getCartSummary(cartId);
    if (summary.lines.length === 0) {
      // A vanished/empty cart is deterministic (the conversion cleared it or
      // the cart was never ours): record + the refund trail.
      await recordEvent(evt, STRIPE_FAILURE_REASON.cartUnavailable);
      console.error(
        "[stripe-webhook] orphaned payment with empty/absent cart — refund via dashboard",
        intentView.id,
        intentView.amount,
      );
      return NextResponse.json({ received: true });
    }

    let discount = 0;
    let couponFreeShipping = false;
    if (couponCode) {
      const applied = await applyCouponCode(couponCode, summary.subtotal);
      if (!applied.ok) {
        // The coupon that shaped the paid amount is no longer redeemable —
        // deterministic: record + the refund trail.
        await recordEvent(evt, STRIPE_FAILURE_REASON.checkoutRejected);
        console.error(
          "[stripe-webhook] orphaned payment with unredeemable coupon — refund via dashboard",
          intentView.id,
          intentView.amount,
          couponCode,
        );
        return NextResponse.json({ received: true });
      }
      discount = applied.discount;
      couponFreeShipping = applied.freeShipping === true;
    }

    const settings = await getSettings();
    const money = computeOrderMoney({
      subtotal: summary.subtotal,
      discount,
      shippingMethod,
      freeShippingThresholdCents: settings.freeShippingThresholdCents,
      standardShippingCents: settings.standardShippingCents,
      expressShippingCents: settings.expressShippingCents,
      taxRatePercent: settings.taxRatePercent,
      couponFreeShipping,
    });

    // The SAME verification gate as the action path — the intent must have
    // paid exactly the server-re-derived total, in USD. A mismatch is
    // deterministic: record + the refund trail (the operator refunds from
    // the Stripe dashboard using the log line).
    const verification = verifyPaymentIntentForPlacement(intentView, money.total);
    if (!verification.ok) {
      await recordEvent(evt, STRIPE_FAILURE_REASON.amountMismatch);
      console.error(
        "[stripe-webhook] amount mismatch — refund via dashboard",
        intentView.id,
        `intent=${intentView.amount} cart=${money.total} reason=${verification.reason}`,
      );
      return NextResponse.json({ received: true });
    }

    // Placement: the same transactional contract as POST /api/checkout
    // (stock re-check inside the tx, coupon burn, decrement, cart clear,
    // events) with the paid-payment columns. THE H4d/L9 RULE: the
    // StripeEvent dedup row commits INSIDE this transaction (placeOrderTx's
    // stripeEvent arg) — a transient failure rolls it back WITH the
    // placement, and the 500 below makes Stripe retry the whole thing.
    const args: PlaceOrderArgs = {
      cartId,
      userId,
      email: email.data,
      customerName,
      lines: summary.lines,
      couponCode,
      shippingMethod,
      paymentMethod: "card",
      cardLast4: null,
      shippingAddressJson: JSON.stringify({
        fullName: shippingSnapshot.data.fullName,
        phone: shippingSnapshot.data.phone,
        line1: shippingSnapshot.data.line1,
        line2: shippingSnapshot.data.line2 || "",
        city: shippingSnapshot.data.city,
        state: shippingSnapshot.data.state,
        postalCode: shippingSnapshot.data.postalCode,
        country: shippingSnapshot.data.country,
      }),
      saveAddress: false,
      address: shippingSnapshot.data,
      idempotencyKey,
      cartToken,
      settings: {
        freeShippingThresholdCents: settings.freeShippingThresholdCents,
        standardShippingCents: settings.standardShippingCents,
        expressShippingCents: settings.expressShippingCents,
        taxRatePercent: settings.taxRatePercent,
      },
      stripePaymentIntentId: intentView.id,
      paidTotalCents: intentView.amount ?? null,
      stripeEvent: {
        eventId: evt.id,
        type: evt.type,
        paymentIntentId: intentView.id,
        amount: intentView.amount ?? null,
      },
    };
    const number = await placeBackstopWithRetry(args);
    return NextResponse.json({ received: true, order: number });
  } catch (error) {
    // The failure policy (the classifyWebhookPlacementError seam):
    // duplicate / permanent / transient — see the module doc.
    const cls = classifyWebhookPlacementError(error);
    if (cls === "duplicate") {
      const winner = await db.order.findUnique({
        where: { stripePaymentIntentId: intentView.id },
        select: { number: true },
      });
      return NextResponse.json({ received: true, duplicate: true, order: winner?.number });
    }
    if (cls === "permanent") {
      // A captured payment that cannot be fulfilled (stock short, coupon
      // cap, amount drift): the operator refunds from the dashboard using
      // this trail. The event is recorded — a Stripe re-delivery of the
      // same event no-ops. The reason code joins the row.
      const reason =
        error instanceof StripeAmountMismatchError
          ? STRIPE_FAILURE_REASON.amountMismatch
          : STRIPE_FAILURE_REASON.checkoutRejected;
      await recordEvent(evt, reason);
      console.error("[stripe-webhook] captured payment unfulfillable — refund via dashboard", intentView.id, error);
      return NextResponse.json({ received: true });
    }
    // Transient: the transaction rolled back INCLUDING the dedup row.
    // Answer 500 — Stripe retries with backoff (up to 3 days), and the
    // retry re-attempts the full placement (the H4d recovery).
    console.error("[stripe-webhook] transient placement failure — answering 500 so Stripe retries", intentView.id, error);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

/**
 * The webhook's ORD-YYYY-NNN allocation loop — the route's
 * placeOrderWithRetry contract with the webhook's P2002 policy: the three
 * DUPLICATE-class anchors (eventId — a concurrent delivery won the dedup
 * race; stripePaymentIntentId — the client path placed; idempotencyKey —
 * the client path placed under the same key) rethrow for the outer catch to
 * classify + resolve by intent; a `number` collision retries with the next
 * suffix; anything else propagates.
 */
async function placeBackstopWithRetry(args: PlaceOrderArgs): Promise<string> {
  const year = new Date().getFullYear();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.order.count({ where: { number: { startsWith: `ORD-${year}-` } } });
    const candidate = `ORD-${year}-${String(count + 1 + attempt).padStart(3, "0")}`;
    try {
      return await placeOrderTx(db, candidate, args);
    } catch (error) {
      if (
        uniqueTargetField(error, "eventId") ||
        uniqueTargetField(error, "stripePaymentIntentId") ||
        uniqueTargetField(error, "idempotencyKey")
      ) {
        throw error;
      }
      if (isUniqueViolation(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new CheckoutError(500, "Could not allocate an order number.");
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary, readCartToken } from "@/lib/cart";
import { applyCouponCode } from "@/lib/coupons";
import { computeOrderMoney } from "@/lib/order-money";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { getStripe, isStripeServerConfigured } from "@/lib/stripe";
import {
  buildPaymentIntentParams,
  checkoutSnapshotHash,
  stripeIdempotencyKey,
} from "@/lib/stripe-payment";
import { checkoutSchema, firstError } from "@/lib/validation";

export const dynamic = "force-dynamic";

// The mint body is the checkout input's placement subset (the same schema —
// single source — minus the fields the placement itself owns).
const mintBodySchema = checkoutSchema.pick({
  email: true,
  customerName: true,
  shippingMethod: true,
  couponCode: true,
  idempotencyKey: true,
  address: true,
});

type MintBody = z.infer<typeof mintBodySchema>;

type PaymentIntentSession = {
  clientSecret: string;
  paymentIntentId: string;
  /** Echoed for the island's own amount display — server truth, not client input. */
  amount: number;
};

/**
 * POST /api/stripe/payment-intent — the client island's entry point (the
 * Stripe retrofit's mint, PAY-STRIPE-1).
 *
 * Re-derives the cart + coupon + settings SERVER-SIDE (money is server
 * truth — nothing the client sends can move the amount), builds the
 * PaymentIntent params via the pure seam, and creates (or idempotently
 * reuses — the deterministic key) the intent. Returns the client secret the
 * Payment Element mounts with.
 *
 * Placement itself stays in POST /api/checkout — the same transactional seam
 * as the demo path; this route never writes orders. The intent's metadata
 * carries the full placement input so the webhook backstop can rebuild the
 * order if the customer's browser dies between confirmation and placement.
 */
export async function POST(request: NextRequest) {
  if (!isStripeServerConfigured()) {
    // Customer-safe: no operator vocabulary (the R10-2 rule).
    return NextResponse.json(
      { error: "Card payments are unavailable right now. Please try again later." },
      { status: 503 },
    );
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Card payments are unavailable right now. Please try again later." },
      { status: 503 },
    );
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = mintBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const snapshot = parsed.data;

  // Per-client budget keyed like the reference's mint (user id, else IP).
  const user = await getCurrentUser();
  const limit = rateLimit(`stripe-intent:${user?.id ?? clientIp(request.headers)}`, 10, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
    );
  }

  const cartId = await findCartId(user?.id ?? null);
  const summary = await getCartSummary(cartId);
  if (!cartId || summary.lines.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 409 });
  }

  // Fast-fail coupon check — the authoritative derivation reruns inside the
  // placement transaction (the same contract as POST /api/checkout).
  let discount = 0;
  let couponFreeShipping = false;
  if (snapshot.couponCode) {
    const applied = await applyCouponCode(snapshot.couponCode, summary.subtotal);
    if (!applied.ok) {
      return NextResponse.json({ error: applied.error }, { status: 409 });
    }
    discount = applied.discount;
    couponFreeShipping = applied.freeShipping === true;
  }

  const settings = await getSettings();
  const money = computeOrderMoney({
    subtotal: summary.subtotal,
    discount,
    shippingMethod: snapshot.shippingMethod,
    freeShippingThresholdCents: settings.freeShippingThresholdCents,
    standardShippingCents: settings.standardShippingCents,
    expressShippingCents: settings.expressShippingCents,
    taxRatePercent: settings.taxRatePercent,
    couponFreeShipping,
  });

  const cartToken = await readCartToken();
  const params = buildPaymentIntentParams({
    snapshot,
    totalCents: money.total,
    cartId,
    userId: user?.id ?? null,
    cartToken,
  });
  const idempotencyKey = stripeIdempotencyKey(cartId, money.total, checkoutSnapshotHash(snapshot));

  try {
    const intent = await stripe.paymentIntents.create(
      params as Parameters<typeof stripe.paymentIntents.create>[0],
      { idempotencyKey },
    );
    if (!intent.client_secret) {
      console.error("[api/stripe/payment-intent] intent without client_secret", intent.id);
      return NextResponse.json(
        { error: "We could not start your payment. Please try again." },
        { status: 502 },
      );
    }
    const session: PaymentIntentSession = {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: intent.amount,
    };
    return NextResponse.json(session);
  } catch (error) {
    console.error("[api/stripe/payment-intent] create failed", error);
    return NextResponse.json(
      { error: "We could not start your payment. Please try again." },
      { status: 502 },
    );
  }
}

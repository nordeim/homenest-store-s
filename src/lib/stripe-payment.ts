import { createHash } from "node:crypto";
import { z } from "zod";

import { formatMoney } from "./money";
import { isUniqueViolation, uniqueTargetField } from "./prisma-errors";
import { isPublishableKeyConfigured, isRealSecret, resolveStripeConfig } from "./stripe-config";
import type { StripeConfig } from "./stripe-config";
import type { checkoutSchema } from "./validation";

/**
 * PAY-STRIPE-1 (the Stripe retrofit — ported from the reference
 * implementation and adapted to this repo's money model) — the server-side
 * pure seams of the Stripe payment integration. SDK-FREE by design
 * (unit-pinnable in the node environment): every function here works on
 * plain objects, so the contract layer is fully tested without network or
 * keys. The SDK-touching code lives in `src/lib/stripe.ts` (the lazy server
 * client) and the two API routes.
 *
 * ⚠️ SERVER-ONLY: this module imports node:crypto (the hashing seams).
 * Client components and the proxy must import the client-safe config module
 * `src/lib/stripe-config.ts` instead (re-exported below for server-side
 * convenience).
 *
 * Design contracts (inherited from the reference):
 * - **Money is server truth**: the intent amount is derived from the live
 *   cart + coupon + settings on the SERVER; nothing the client sends can
 *   move it. Placement re-verifies the intent amount against the
 *   transaction-re-derived total.
 * - **Idempotency everywhere**: deterministic intent keys (cart + total +
 *   snapshot hash), the Order.stripePaymentIntentId unique anchor, and the
 *   StripeEvent.eventId dedup row committed WITH the placement side effects.
 * - **Customer-safe copy**: no operator vocabulary (env names, key formats,
 *   intent ids) in any message a customer can read.
 * - **The sentinel mirror**: server and client "configured" checks share one
 *   truth table — see stripe-config.ts.
 */

// Re-export the client-safe config seams for server-side callers (client
// components import @/lib/stripe-config directly — this module is
// server-only).
export { isPublishableKeyConfigured, isRealSecret, resolveStripeConfig };
export type { StripeConfig };

/** The checkout fields the PaymentIntent mint consumes (the placement
 *  input's subset — the intent metadata's payload, and the webhook
 *  backstop's rebuild source). */
export type StripeCheckoutSnapshot = Pick<
  z.infer<typeof checkoutSchema>,
  "email" | "customerName" | "shippingMethod" | "couponCode" | "idempotencyKey" | "address"
>;

// ---------------------------------------------------------------------------
// Idempotency — deterministic intent keys + checkout snapshots
// ---------------------------------------------------------------------------

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Canonical (key-order-independent) JSON — stable digests for the same data. */
function canonicalJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

/**
 * Stable digest of the checkout snapshot (drives the intent idempotency key).
 * Covers everything that shapes the placement EXCEPT the cart contents and
 * the total (which join the key separately).
 */
export function checkoutSnapshotHash(snapshot: StripeCheckoutSnapshot): string {
  return sha256(canonicalJson(snapshot as unknown as Record<string, unknown>));
}

/**
 * The `paymentIntents.create` idempotency key: the same cart + total +
 * checkout snapshot reuses the SAME intent (re-mounts, step re-entries); any
 * change mints a fresh key → a fresh intent with the fresh amount. Stripe
 * caches the first response per key for 24h, so the key must encode every
 * input that shapes the request (amount + metadata).
 */
export function stripeIdempotencyKey(
  cartId: string,
  totalCents: number,
  snapshotHash: string,
): string {
  return sha256(`${cartId}:${totalCents}:${snapshotHash}`);
}

/**
 * The `refunds.create` idempotency key: ONE full refund per payment intent.
 * A double-click, a retry, or a second operator hours later hits the same
 * key → Stripe replays the FIRST refund's response — never a second refund
 * of the same charge. Readable by design: intent ids are already bounded and
 * url-safe, and the key is the operator's artifact in Stripe's idempotency
 * log (the sha256 pattern above exists for user-shaped, unbounded inputs).
 */
export function stripeRefundIdempotencyKey(paymentIntentId: string): string {
  return `refund:${paymentIntentId}`;
}

// ---------------------------------------------------------------------------
// PaymentIntent params — server-re-derived money
// ---------------------------------------------------------------------------

export type PaymentIntentParams = {
  amount: number;
  currency: "usd";
  /** The Payment Element contract: Stripe renders the methods the account enables. */
  automatic_payment_methods: { enabled: boolean };
  /** The webhook backstop's rebuild input (cart anchor + checkout snapshot). */
  metadata: Record<string, string>;
};

/**
 * Build the PaymentIntent creation params. `totalCents` is ALWAYS the
 * server-derived total (live cart + coupon + settings through
 * computeOrderMoney) — never a client-sent amount. The metadata carries the
 * full placement input so the webhook backstop can rebuild the order when
 * the customer's browser dies between confirmation and placement.
 */
export function buildPaymentIntentParams(args: {
  snapshot: StripeCheckoutSnapshot;
  totalCents: number;
  cartId: string;
  userId: string | null;
  /** The placing client's cart token — binds the webhook-placed order to the
   *  same guest cookie so an idempotent replay still resolves (S6-8). */
  cartToken: string | null;
}): PaymentIntentParams {
  const { snapshot, totalCents, cartId, userId, cartToken } = args;
  return {
    amount: totalCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: {
      cartId,
      userId: userId ?? "",
      email: snapshot.email,
      customerName: snapshot.customerName,
      // The snapshot serialization order is the webhook's parse contract.
      shipping: JSON.stringify(snapshot.address),
      shippingMethod: snapshot.shippingMethod,
      couponCode: snapshot.couponCode ?? "",
      cartToken: cartToken ?? "",
      idempotencyKey: snapshot.idempotencyKey ?? "",
    },
  };
}

// ---------------------------------------------------------------------------
// Placement verification — the gate between a paid intent and an order
// ---------------------------------------------------------------------------

/** The structural view of a PaymentIntent the placement decision needs. */
export type PlacementIntentView = {
  status?: string;
  amount?: number;
  currency?: string;
};

export type PlacementVerification =
  | { ok: true }
  | { ok: false; reason: "status" | "amount" | "currency"; message: string };

/**
 * A PaymentIntent may only place an order when it SUCCEEDED, for the exact
 * server-re-derived total, in USD. Each failure maps to customer-safe copy
 * (never Stripe internals, never operator vocabulary).
 */
export function verifyPaymentIntentForPlacement(
  intent: PlacementIntentView,
  expectedTotalCents: number,
): PlacementVerification {
  if (intent.status !== "succeeded") {
    return {
      ok: false,
      reason: "status",
      message: "Your payment could not be completed. Please try again.",
    };
  }
  if (intent.amount !== expectedTotalCents) {
    return {
      ok: false,
      reason: "amount",
      message: "Your cart changed since you started checkout. Please review your order and try again.",
    };
  }
  if ((intent.currency ?? "").toLowerCase() !== "usd") {
    return {
      ok: false,
      reason: "currency",
      message: "We could not verify your payment. Please contact support if you were charged.",
    };
  }
  return { ok: true };
}

/**
 * Thrown by `placeOrderTx` when the Stripe path's transaction-re-derived
 * total does not match the verified intent amount — the residual TOCTOU
 * guard (a price/coupon/settings drift between the pre-tx verification and
 * the in-tx money authority). The /api/checkout path maps it to the same
 * customer-safe "cart changed" copy; the webhook maps it to the
 * amount-mismatch refund trail. Lives HERE (not in order-placement.ts) so
 * both routes can instanceof it without an import cycle.
 */
export class StripeAmountMismatchError extends Error {
  constructor() {
    super("PaymentIntent amount does not match the order total");
    this.name = "StripeAmountMismatchError";
  }
}

// ---------------------------------------------------------------------------
// Webhook classification + envelope parsing
// ---------------------------------------------------------------------------

export type StripeEventClass = "succeeded" | "failed" | "ignored";

export function classifyStripeEvent(type: string): StripeEventClass {
  if (type === "payment_intent.succeeded") return "succeeded";
  if (type === "payment_intent.payment_failed") return "failed";
  return "ignored";
}

// ---------------------------------------------------------------------------
// The placement failure policy (PAY-STRIPE-2 — the H4d/L9 rule)
// ---------------------------------------------------------------------------

export type WebhookFailureClass = "duplicate" | "permanent" | "transient";

/**
 * True when the error structurally carries an HTTP 4xx status — this repo's
 * `CheckoutError` shape (order-placement.ts). A structural check (not an
 * instanceof) keeps this seam import-cycle-free and unit-pinnable; the
 * placement path is the only error family that rides an HTTP status through
 * the transaction.
 */
function carries4xxStatus(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500;
}

/**
 * The webhook's placement-failure policy:
 * - **duplicate** — a P2002 on `StripeEvent.eventId` (a concurrent delivery
 *   won the dedup race), on `Order.stripePaymentIntentId` (the client path
 *   placed between our check and the tx), or on `Order.idempotencyKey`
 *   (THIS repo's webhook placement carries the client's checkout key in the
 *   intent metadata — a collision means the client path won under the same
 *   key): 200 with the winner's order number; never double-place, never a
 *   retry loop against a deterministic collision.
 * - **permanent** — a deterministic business rejection: a CheckoutError
 *   4xx (stock short, coupon cap, product gone) or the in-tx amount guard
 *   (StripeAmountMismatchError). A retry cannot succeed → record the event
 *   + 200 + the ops refund trail.
 * - **transient** — everything else (tx errors, a P2002 on `number` from a
 *   concurrent placement race): the tx rolled back INCLUDING the dedup row
 *   → answer 500 so Stripe retries and the retry re-attempts the placement
 *   (the recovery the backstop exists for).
 */
export function classifyWebhookPlacementError(error: unknown): WebhookFailureClass {
  if (
    uniqueTargetField(error, "eventId") ||
    uniqueTargetField(error, "stripePaymentIntentId") ||
    uniqueTargetField(error, "idempotencyKey")
  ) {
    return "duplicate";
  }
  if (error instanceof StripeAmountMismatchError || carries4xxStatus(error)) {
    return "permanent";
  }
  return "transient";
}

// ---------------------------------------------------------------------------
// The deterministic-failure reason vocabulary (REASON-TRAIL-1)
// ---------------------------------------------------------------------------

/**
 * The canonical reason CODES the webhook persists on the StripeEvent row at
 * its deterministic-failure write sites. The codes join the row as
 * `StripeEvent.failureReason` (nullable — null = no reason known: the
 * failed/ignored recordings, the client-path-precedence recording, and the
 * SUCCESSFUL in-tx insert, which writes none by construction). The write
 * side and the read side (src/lib/admin-payments.ts
 * `paymentFailureReasonView`) share this vocabulary as their single source —
 * no stringly-typed drift.
 */
export const STRIPE_FAILURE_REASON = {
  /** The succeeded intent carried no usable metadata (snapshot/cartId). */
  metadataUnusable: "metadata-unusable",
  /** The metadata's cartId resolved to no cart / an empty cart. */
  cartUnavailable: "cart-unavailable",
  /** The intent's amount did not match the server-re-derived total. */
  amountMismatch: "amount-mismatch",
  /** A deterministic checkout rejection (stock short, coupon cap, price drift). */
  checkoutRejected: "checkout-rejected",
} as const;

export type StripeFailureReasonCode =
  (typeof STRIPE_FAILURE_REASON)[keyof typeof STRIPE_FAILURE_REASON];

/**
 * The action path's already-placed resolution gate: a P2002 on
 * `stripePaymentIntentId` means a retried submit whose intent already placed
 * an order (the customer should see their confirmation). A P2002 on
 * `number` or `idempotencyKey` is a different race — NOT the anchor — and
 * must fall through to the caller's own recovery (retry / replay).
 */
export function isIntentAnchorP2002(error: unknown): boolean {
  return uniqueTargetField(error, "stripePaymentIntentId");
}

/** Re-exported for the route-level retry loops (the tolerant matcher). */
export { isUniqueViolation };

const metadataSchema = z.record(z.string());

/**
 * Structural parse of the webhook envelope — defense in depth AFTER
 * `constructEvent` verified authenticity (a well-formed event still needs a
 * usable id + data.object to be processable). `payment_intent` is the
 * charge-family's reference to its owning PaymentIntent —
 * `stripeEventIntentId` reads it to keep the StripeEvent intent column
 * honest for charge.* deliveries.
 */
export const stripeWebhookEventSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string(),
      status: z.string().optional(),
      amount: z.number().optional(),
      currency: z.string().optional(),
      payment_intent: z.string().optional(),
      metadata: metadataSchema.optional(),
      // The charge-object refund fields the reflection seam reads. ADDITIVE
      // optional fields — intent-family events carry neither; every existing
      // parse outcome is unchanged.
      refunded: z.boolean().optional(),
      amount_refunded: z.number().optional(),
    }),
  }),
});

export function parseStripeWebhookEvent(raw: unknown) {
  return stripeWebhookEventSchema.safeParse(raw);
}

export type StripeWebhookEvent = z.infer<typeof stripeWebhookEventSchema>;

// ---------------------------------------------------------------------------
// stripeEventIntentId — the honest intent column
// ---------------------------------------------------------------------------

/**
 * The intent id a StripeEvent row should record for this object:
 * `payment_intent` when the object carries one (charge-family events — a
 * charge is not an intent), else the object's own id (payment_intent.*
 * events ARE intents; other shapes keep their object id). The empty-string
 * guard exists only for honesty — Stripe never sends an empty
 * payment_intent.
 */
export function stripeEventIntentId(object: {
  id: string;
  payment_intent?: string;
}): string {
  return object.payment_intent && object.payment_intent.length > 0
    ? object.payment_intent
    : object.id;
}

// ---------------------------------------------------------------------------
// chargeRefundedReflection (REFUND-ACTION-1)
// ---------------------------------------------------------------------------

export type ChargeRefundedReflection = {
  /** "refunded" ONLY on a full refund of a paid order; null = no order-state change. */
  paymentStatus: "refunded" | null;
  /** The OrderEvent note; null = reflect nothing (a non-paid order / shape drift). */
  eventNote: string | null;
};

/**
 * The webhook's charge.refunded branch composes this seam to reflect a
 * refund on the linked ORDER — the missing half of the refund loop (the
 * action seam never writes refund state; this reflection is the single
 * writer).
 *
 * - A non-paid order (demo columns, already refunded, a re-delivery shape)
 *   reflects NOTHING — the parse family's fall-through philosophy.
 * - `refunded === true` (Stripe's own fully-refunded boolean) →
 *   paymentStatus "refunded" + the full-refund note. A partial refund
 *   → the note only: the order keeps its paid capture state (a partial
 *   refund does not zero the capture — honest).
 * - Money formats through formatMoney at the note boundary (integer cents
 *   everywhere, display formatting at the edge).
 */
export function chargeRefundedReflection(
  order: { paymentStatus: string | null },
  charge: { refunded?: boolean; amount?: number; amount_refunded?: number },
): ChargeRefundedReflection {
  if (order.paymentStatus !== "paid") return { paymentStatus: null, eventNote: null };
  const refundedAmount = charge.amount_refunded ?? charge.amount ?? 0;
  if (charge.refunded === true) {
    return {
      paymentStatus: "refunded",
      eventNote: `Refunded ${formatMoney(refundedAmount)} via Stripe`,
    };
  }
  return {
    paymentStatus: null,
    eventNote: `Partially refunded ${formatMoney(refundedAmount)} of ${formatMoney(charge.amount ?? 0)} via Stripe`,
  };
}

// ---------------------------------------------------------------------------
// last4 extraction — defensive against every SDK shape
// ---------------------------------------------------------------------------

type CardHoldingMethod = { card?: { last4?: string | null } | null } | string | null | undefined;
type ChargeView = { payment_method_details?: { card?: { last4?: string | null } | null } | null } | string | null | undefined;

/**
 * Reads the card last4 from a PaymentIntent's expanded shapes. The caller
 * retrieves intents with `expand: ["payment_method", "latest_charge"]`;
 * un-expanded string references carry no last4 → null (the admin surfaces
 * render the existing "—" fallback).
 */
export function paymentIntentLast4(intent: {
  payment_method?: CardHoldingMethod;
  latest_charge?: ChargeView;
}): string | null {
  const pm = intent.payment_method;
  if (pm && typeof pm === "object" && pm.card?.last4) return pm.card.last4;
  const charge = intent.latest_charge;
  if (charge && typeof charge === "object" && charge.payment_method_details?.card?.last4) {
    return charge.payment_method_details.card.last4;
  }
  return null;
}

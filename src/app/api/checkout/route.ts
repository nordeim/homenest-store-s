import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { assertAddressCap, AddressCapError } from "@/lib/addresses";
import { findCartId, getCartSummary, readCartToken, type CartLine } from "@/lib/cart";
import { applyCouponCode, couponDiscount, couponRedemptionWhere, isCouponRedeemable } from "@/lib/coupons";
import { db } from "@/lib/db";
import { computeOrderMoney } from "@/lib/order-money";
import { orderAccessToken, replayAuthorized, resolveReplay, ReplayDeniedError } from "@/lib/order-access";
import { isUniqueViolation, uniqueTargetField } from "@/lib/prisma-errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { checkoutSchema, firstError } from "@/lib/validation";

/** Error carrying an HTTP status through the order transaction. */
class CheckoutError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// checkoutSchema + the last-4 card digits (the client never sends full card
// numbers to the server — only the final four for the receipt).
const checkoutBodySchema = checkoutSchema.extend({
  cardLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Card number must end in 4 digits")
    .optional()
    .or(z.literal("")),
});

type CheckoutBody = z.infer<typeof checkoutBodySchema>;

type OrderItemCreate = {
  productId: string;
  nameSnapshot: string;
  imageSnapshot: string;
  unitPrice: number;
  quantity: number;
};

type PlaceOrderArgs = {
  cartId: string;
  userId: string | null;
  email: string;
  customerName: string;
  lines: CartLine[];
  couponCode: string | null;
  shippingMethod: "standard" | "express";
  paymentMethod: string;
  cardLast4: string | null;
  shippingAddressJson: string;
  saveAddress: boolean;
  address: CheckoutBody["address"];
  idempotencyKey: string | null;
  /** Cart token that placed the order — binds replays to this client (S6-8). */
  cartToken: string | null;
  settings: {
    freeShippingThresholdCents: number;
    standardShippingCents: number;
    expressShippingCents: number;
    taxRatePercent: number;
  };
};

type PlacedOrder = { orderNumber: string; token: string };

function respond(orderNumber: string): NextResponse {
  return NextResponse.json({ orderNumber, token: orderAccessToken(orderNumber) });
}

/**
 * POST /api/checkout — THE critical path. Every monetary amount is re-derived
 * server-side INSIDE the order transaction from the live product rows and
 * settings (client totals are never trusted), stock is reserved via
 * conditional atomic decrements, and the order + items + "placed" event +
 * stock decrement + cart clear all commit atomically.
 *
 * Idempotency: the body may carry a client-generated `idempotencyKey`. A retry
 * (lost response, double click) with the same key returns the ALREADY-placed
 * order's `{ orderNumber, token }` instead of double-ordering.
 */
export async function POST(request: NextRequest) {
  try {
    // Malformed payloads are a client error (400), not a 500.
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = checkoutBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }
    const data = parsed.data;

    if (data.paymentMethod === "card" && !/^\d{4}$/.test(data.cardLast4 ?? "")) {
      return NextResponse.json({ error: "Card details are required for card payment." }, { status: 400 });
    }

    // Per-client budget (x-forwarded-for when behind a proxy, shared bucket
    // for direct connections). Generous: blocks scripted spam, not shoppers.
    
    const limit = rateLimit(`checkout:${clientIp(request.headers)}`, 20, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
      );
    }

    const user = await getCurrentUser();
    const requestCartToken = await readCartToken();

    // Idempotent replay: the order already committed on an earlier attempt —
    // hand back its receipt without touching stock or the cart again. The
    // replay is OWNERSHIP-BOUND (session-6 S6-8): user orders replay only for
    // the same session, guest orders only with the same cart-token cookie.
    // A leaked key alone reveals nothing.
    if (data.idempotencyKey) {
      const existing = await db.order.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (existing && replayAuthorized(existing.userId, existing.cartToken, user?.id ?? null, requestCartToken)) {
        return respond(existing.number);
      }
    }

    const cartId = await findCartId(user?.id ?? null);
    const summary = await getCartSummary(cartId);
    if (!cartId || summary.lines.length === 0) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 409 });
    }

    // Defensive: a quantity-0 line must never become an order item (it would
    // be a $0 line that still accrues shipping/tax). The cart PATCH deletes
    // such lines — this guard backstops stale summaries and races.
    if (summary.lines.some((line) => line.quantity <= 0)) {
      return NextResponse.json(
        { error: "Your cart needs attention — please update item quantities and try again." },
        { status: 409 },
      );
    }

    // Fast-fail coupon check for good UX only — the AUTHORITATIVE validation
    // and discount derivation happen inside the transaction below.
    if (data.couponCode) {
      const applied = await applyCouponCode(data.couponCode, summary.subtotal);
      if (!applied.ok) {
        return NextResponse.json({ error: applied.error }, { status: 409 });
      }
    }

    const settings = await getSettings();
    const shippingAddressJson = JSON.stringify({
      fullName: data.address.fullName,
      phone: data.address.phone,
      line1: data.address.line1,
      line2: data.address.line2 || "",
      city: data.address.city,
      state: data.address.state,
      postalCode: data.address.postalCode,
      country: data.address.country,
    });

    const args: PlaceOrderArgs = {
      cartId,
      userId: user?.id ?? null,
      email: data.email,
      customerName: data.customerName,
      lines: summary.lines,
      couponCode: data.couponCode ? data.couponCode.trim().toUpperCase() : null,
      shippingMethod: data.shippingMethod,
      paymentMethod: data.paymentMethod,
      cardLast4: data.paymentMethod === "card" ? (data.cardLast4 ?? null) : null,
      shippingAddressJson,
      saveAddress: Boolean(user) && data.saveAddress === true,
      address: data.address,
      idempotencyKey: data.idempotencyKey ?? null,
      cartToken: requestCartToken,
      settings: {
        freeShippingThresholdCents: settings.freeShippingThresholdCents,
        standardShippingCents: settings.standardShippingCents,
        expressShippingCents: settings.expressShippingCents,
        taxRatePercent: settings.taxRatePercent,
      },
    };

    const orderNumber = await placeOrderWithRetry(args);
    return respond(orderNumber);
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Something went wrong placing your order." }, { status: 500 });
  }
}

/**
 * ORD-YYYY-NNN allocation. The counter is derived from existing rows; a unique
 * violation on the NUMBER (concurrent order) retries with the next suffix. A
 * unique violation on the IDEMPOTENCY KEY (two racing first-attempts with the
 * same key) resolves to the winning order instead. The whole transaction
 * retries, so a failed attempt never leaves partial writes.
 */
async function placeOrderWithRetry(args: PlaceOrderArgs): Promise<string> {
  const year = new Date().getFullYear();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.order.count({ where: { number: { startsWith: `ORD-${year}-` } } });
    const candidate = `ORD-${year}-${String(count + 1 + attempt).padStart(3, "0")}`;
    try {
      return await placeOrderTx(candidate, args);
    } catch (error) {
      // Session-8 S8-3: tolerant matching — the engine may report the P2002
      // target as a field array (today's SQLite shape) or as the constraint
      // NAME string ("Order_idempotencyKey_key"); matching only the field
      // shape would silently disable this recovery branch.
      if (uniqueTargetField(error, "idempotencyKey")) {
        const winner = args.idempotencyKey
          ? await db.order.findUnique({ where: { idempotencyKey: args.idempotencyKey } })
          : null;
        // Session-7 S7-2: the recovery path is ownership-bound too. A genuine
        // double-submit shares the same cookies and passes; a caller who only
        // KNOWS the key (log/XSS leak) gets a 409 instead of the receipt.
        try {
          const resolved = resolveReplay(winner, args.userId, args.cartToken);
          if (resolved) return resolved;
        } catch (denied) {
          if (denied instanceof ReplayDeniedError) {
            throw new CheckoutError(409, "We couldn't verify this checkout retry belongs to you. Please review your cart and try again.");
          }
          throw denied;
        }
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


async function placeOrderTx(orderNumber: string, args: PlaceOrderArgs): Promise<string> {
  // NOTE: cookies() can never be touched inside this transaction — the cart
  // ROW is intentionally left in place (harmless); only its items are cleared.
  return db.$transaction(async (tx) => {
    // Snapshot the products inside the transaction — these reads are the
    // source of truth for both the line items and ALL money math below.
    const orderItems: OrderItemCreate[] = [];
    for (const line of args.lines) {
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (!product || !product.isActive) {
        throw new CheckoutError(409, `"${line.name}" is no longer available.`);
      }
      if (product.stock < line.quantity) {
        throw new CheckoutError(409, `Only ${product.stock} left of "${product.name}" — please update your cart.`);
      }
      orderItems.push({
        productId: product.id,
        nameSnapshot: product.name,
        imageSnapshot: line.image,
        unitPrice: product.price,
        quantity: line.quantity,
      });
    }

    // ---- Re-derive ALL money server-side, inside the tx (the tested seam) ----
    // Deriving here (not from the pre-tx cart summary) closes the TOCTOU
    // window: a concurrent price edit can no longer desync `total` from
    // Σ(unitPrice × qty) or skew tax/shipping.
    const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    let discount = 0;
    if (args.couponCode) {
      const couponRow = await tx.coupon.findUnique({ where: { code: args.couponCode } });
      if (!couponRow || !isCouponRedeemable(couponRow)) {
        throw new CheckoutError(409, "This coupon code is not valid.");
      }
      const applied = couponDiscount(
        {
          code: couponRow.code,
          type: couponRow.type,
          value: couponRow.value,
          minSubtotal: couponRow.minSubtotal,
          description: couponRow.description,
        },
        subtotal,
      );
      if (!applied.ok) {
        throw new CheckoutError(409, applied.error);
      }
      discount = applied.discount;
      // Redemption bookkeeping commits with the order — a lost order can
      // never burn a coupon use, and a placed order always does. The guard
      // is ATOMIC: `updateMany` only fires while `timesUsed < maxRedemptions`,
      // so a concurrent checkout that hits the cap first makes `count === 0`
      // and rolls this whole transaction back (closes the read-then-write
      // TOCTOU window that `isCouponRedeemable` alone leaves open).
      const redeemed = await tx.coupon.updateMany({
        where: { code: couponRow.code, ...couponRedemptionWhere(couponRow.maxRedemptions) },
        data: { timesUsed: { increment: 1 } },
      });
      if (redeemed.count === 0) {
        throw new CheckoutError(409, "This coupon has just reached its redemption limit.");
      }
    }

    const money = computeOrderMoney({
      subtotal,
      discount,
      shippingMethod: args.shippingMethod,
      freeShippingThresholdCents: args.settings.freeShippingThresholdCents,
      standardShippingCents: args.settings.standardShippingCents,
      expressShippingCents: args.settings.expressShippingCents,
      taxRatePercent: args.settings.taxRatePercent,
    });

    const order = await tx.order.create({
      data: {
        number: orderNumber,
        userId: args.userId,
        email: args.email,
        customerName: args.customerName,
        status: "pending",
        subtotal,
        shipping: money.shipping,
        tax: money.tax,
        discount,
        total: money.total,
        couponCode: args.couponCode,
        shippingMethod: args.shippingMethod,
        shippingAddress: args.shippingAddressJson,
        paymentMethod: args.paymentMethod,
        cardLast4: args.cardLast4,
        idempotencyKey: args.idempotencyKey,
        cartToken: args.cartToken,
        items: { create: orderItems },
        events: {
          create: { type: "placed", status: "pending", note: "Order placed" },
        },
      },
    });

    // Atomic guard: if the stock moved below `quantity` between the read and
    // this write, `count === 0` and the whole transaction rolls back.
    for (const item of orderItems) {
      const reserved = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (reserved.count === 0) {
        throw new CheckoutError(409, `Stock just ran out for "${item.nameSnapshot}" — please update your cart.`);
      }
    }

    // Clear the cart's items (the cart row itself stays — cookies can't be
    // set inside a transaction, and an empty cart is harmless).
    await tx.cartItem.deleteMany({ where: { cartId: args.cartId } });

    if (args.saveAddress && args.userId) {
      // Session-7 S7-8: the save is best-effort relative to the ORDER — at the
      // address-book cap the order still places (the address rides on it in
      // shippingAddressJson) and only the bookkeeping save is skipped. When it
      // DOES save, previous defaults are unset in the same transaction so
      // `findFirst({ isDefault: true })` stays deterministic (the latest save).
      try {
        await assertAddressCap(tx, args.userId);
        await tx.address.updateMany({
          where: { userId: args.userId, isDefault: true },
          data: { isDefault: false },
        });
        await tx.address.create({
          data: {
            userId: args.userId,
            label: args.address.label || "Home",
            fullName: args.address.fullName,
            phone: args.address.phone,
            line1: args.address.line1,
            line2: args.address.line2 ? args.address.line2 : null,
            city: args.address.city,
            state: args.address.state,
            postalCode: args.address.postalCode,
            country: args.address.country,
            isDefault: true,
          },
        });
      } catch (error) {
        if (!(error instanceof AddressCapError)) throw error;
        // At cap: keep the order, skip the address-book save.
      }
    }

    return order.number;
  });
}



import type { Prisma } from "@prisma/client";
import type { z } from "zod";

import { saveCheckoutAddressInTx } from "@/lib/addresses";
import { cartClearFilter, type CartLine } from "@/lib/cart";
import {
  couponDiscount,
  couponRedemptionFilter,
  isCouponRedeemable,
} from "@/lib/coupons";
import { computeOrderMoney } from "@/lib/order-money";
import { checkoutSchema } from "@/lib/validation";

/** Error carrying an HTTP status through the order transaction. */
export class CheckoutError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type CheckoutAddress = z.infer<typeof checkoutSchema>["address"];

export type OrderItemCreate = {
  productId: string;
  nameSnapshot: string;
  imageSnapshot: string;
  unitPrice: number;
  quantity: number;
};

export type PlaceOrderArgs = {
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
  address: CheckoutAddress;
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

/**
 * The transaction carrier + the tx models `placeOrderTx` touches. A
 * structural subset of PrismaClient — the route passes the real singleton,
 * and the integration harness (tests/unit/place-order-integration.test.ts,
 * S26-3) passes a temp-SQLite engine, so the money authority runs against
 * the REAL database engine in tests without process-env gymnastics.
 */
export type OrderTxClient = Pick<
  Prisma.TransactionClient,
  "product" | "coupon" | "order" | "cartItem" | "address"
>;

export type OrderDbClient = {
  $transaction<T>(fn: (tx: OrderTxClient) => Promise<T>): Promise<T>;
};

export async function placeOrderTx(
  db: OrderDbClient,
  orderNumber: string,
  args: PlaceOrderArgs,
): Promise<string> {
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
    let couponFreeShipping = false;
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
      couponFreeShipping = applied.freeShipping === true;
      // Redemption bookkeeping commits with the order — a lost order can
      // never burn a coupon use, and a placed order always does. The guard
      // is ATOMIC (session-20 S20-6: `couponRedemptionFilter` adds the
      // always-on `isActive` guard to the cap clause — a coupon deactivated
      // between the in-tx read and this increment also makes `count === 0`),
      // so a concurrent checkout that hits the cap (or an admin who just
      // deactivated the code) rolls this whole transaction back (closes the
      // read-then-write TOCTOU window that `isCouponRedeemable` alone
      // leaves open).
      const redeemed = await tx.coupon.updateMany({
        where: couponRedemptionFilter(couponRow.code, couponRow.maxRedemptions),
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
      couponFreeShipping,
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

    // Clear ONLY the ordered lines (session-12 S12-1 — cartClearFilter): the
    // cart row itself stays (cookies can't be set inside a transaction), and a
    // line a concurrent tab added after the summary read survives checkout
    // instead of silently vanishing (unordered, unrestocked, off the receipt).
    await tx.cartItem.deleteMany({ where: cartClearFilter(args.cartId, args.lines) });

    if (args.saveAddress && args.userId) {
      // Session-7 S7-8: the save is best-effort relative to the ORDER — at the
      // address-book cap the order still places (the address rides on it in
      // shippingAddressJson) and only the bookkeeping save is skipped. When it
      // DOES save, previous defaults are unset in the same transaction so
      // `findFirst({ isDefault: true })` stays deterministic (the latest save).
      // Session-18 S18-1: the block is the lib-level `saveCheckoutAddressInTx`
      // (unit-pinned contract); the cap gate stays the PRE-create fast-fail —
      // deliberately NOT the S11-6/S16-1 post-create throw, which here would
      // roll back the whole order transaction (no savepoints in Prisma
      // interactive transactions). The residual bounded race is recorded in
      // AGENTS.md (the S17-3 accepted-debt pattern).
      await saveCheckoutAddressInTx(tx, args.userId, args.address);
    }

    return order.number;
  });
}

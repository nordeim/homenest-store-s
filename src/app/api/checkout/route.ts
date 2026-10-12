import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary, type CartLine } from "@/lib/cart";
import { applyCouponCode } from "@/lib/coupons";
import { db } from "@/lib/db";
import { computeOrderMoney } from "@/lib/order-money";
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
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
  shippingMethod: string;
  paymentMethod: string;
  cardLast4: string | null;
  shippingAddressJson: string;
  saveAddress: boolean;
  address: CheckoutBody["address"];
};

/**
 * POST /api/checkout — THE critical path. Every monetary amount is re-derived
 * server-side from the live cart + settings (client totals are never trusted),
 * stock is re-validated inside the transaction, and the order + items +
 * "placed" event + stock decrement + cart clear all commit atomically.
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = checkoutBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }
    const data = parsed.data;

    if (data.paymentMethod === "card" && !/^\d{4}$/.test(data.cardLast4 ?? "")) {
      return NextResponse.json({ error: "Card details are required for card payment." }, { status: 400 });
    }

    const settings = await getSettings();
    const user = await getCurrentUser();
    const cartId = await findCartId(user?.id ?? null);
    const summary = await getCartSummary(cartId);
    if (!cartId || summary.lines.length === 0) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 409 });
    }

    // ---- Re-derive ALL money server-side (the tested seam) ----
    const subtotal = summary.subtotal;
    let discount = 0;
    let couponCode: string | null = null;
    if (data.couponCode) {
      const applied = await applyCouponCode(data.couponCode, subtotal);
      if (!applied.ok) {
        return NextResponse.json({ error: applied.error }, { status: 409 });
      }
      discount = applied.discount;
      couponCode = applied.code;
    }

    const money = computeOrderMoney({
      subtotal,
      discount,
      shippingMethod: data.shippingMethod,
      freeShippingThresholdCents: settings.freeShippingThresholdCents,
      standardShippingCents: settings.standardShippingCents,
      expressShippingCents: settings.expressShippingCents,
      taxRatePercent: settings.taxRatePercent,
    });
    const shipping = money.shipping;
    const tax = money.tax;
    const total = money.total;

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
      subtotal,
      discount,
      shipping,
      tax,
      total,
      couponCode,
      shippingMethod: data.shippingMethod,
      paymentMethod: data.paymentMethod,
      cardLast4: data.paymentMethod === "card" ? (data.cardLast4 ?? null) : null,
      shippingAddressJson,
      saveAddress: Boolean(user) && data.saveAddress === true,
      address: data.address,
    };

    const orderNumber = await placeOrderWithRetry(args);
    return NextResponse.json({ orderNumber });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Something went wrong placing your order." }, { status: 500 });
  }
}

/**
 * ORD-YYYY-NNN allocation. The counter is derived from existing rows; a unique
 * violation (concurrent order) retries with the next suffix. The whole
 * transaction retries, so a failed attempt never leaves partial writes.
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
    // Fresh stock validation inside the transaction (no races).
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

    const order = await tx.order.create({
      data: {
        number: orderNumber,
        userId: args.userId,
        email: args.email,
        customerName: args.customerName,
        status: "pending",
        subtotal: args.subtotal,
        shipping: args.shipping,
        tax: args.tax,
        discount: args.discount,
        total: args.total,
        couponCode: args.couponCode,
        shippingMethod: args.shippingMethod,
        shippingAddress: args.shippingAddressJson,
        paymentMethod: args.paymentMethod,
        cardLast4: args.cardLast4,
        items: { create: orderItems },
        events: {
          create: { type: "placed", status: "pending", note: "Order placed" },
        },
      },
    });

    for (const item of orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Clear the cart's items (the cart row itself stays — cookies can't be
    // set inside a transaction, and an empty cart is harmless).
    await tx.cartItem.deleteMany({ where: { cartId: args.cartId } });

    if (args.saveAddress && args.userId) {
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
    }

    return order.number;
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

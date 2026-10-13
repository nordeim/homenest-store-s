import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { clampPurchaseQuantity } from "@/lib/cart-quantity";
import { findCartId, getOrCreateCart, getCartSummary } from "@/lib/cart";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cartLinePatchSchema, cartMutateSchema, firstError } from "@/lib/validation";

/** Parse a JSON body — malformed payloads are a client error (400), not a 500. */
async function parseJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** POST /api/cart — add a product (or bump quantity of an existing line). */
export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request);
    if (body === null) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    const parsed = cartMutateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }
    const { productId, quantity } = parsed.data;

    // Guest-reachable row creation — metered like the other unauthenticated
    // writes, or a scripted client that ignores cookies mints a Cart row per
    // request (DB-growth spam).
    const ipLimit = rateLimit(`cart:${clientIp(request.headers)}`, 60, 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec ?? 60) } });
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    if (product.stock <= 0) {
      return NextResponse.json({ error: "This product is out of stock." }, { status: 409 });
    }

    const user = await getCurrentUser();
    const cartId = await getOrCreateCart(user?.id ?? null);

    // Read + upsert in ONE transaction: two concurrent add-to-carts must not
    // lose an increment (lost-update race). The quantity routes through the
    // SAME clamp as PATCH (stock ceiling + 99 cap) so POST and PATCH can
    // never disagree about what a line can hold.
    const nextQty = await db.$transaction(async (tx) => {
      const existing = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId, productId } },
      });
      const requested = (existing?.quantity ?? 0) + quantity;
      const clamped = clampPurchaseQuantity(requested, product.stock);
      if (clamped === 0) {
        // Product sold out under the click — no purchasable line.
        return 0;
      }
      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId, productId } },
        create: { cartId, productId, quantity: clamped },
        update: { quantity: clamped },
      });
      return clamped;
    });
    if (nextQty === 0) {
      return NextResponse.json({ error: "This product is out of stock." }, { status: 409 });
    }

    const summary = await getCartSummary(cartId);
    return NextResponse.json({ itemCount: summary.itemCount });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

/** PATCH /api/cart — set a line's quantity. */
export async function PATCH(request: NextRequest) {
  try {
    // Same metering as POST — the mutation surface is symmetric (session-5 S5-8).
    const ipLimit = rateLimit(`cart:${clientIp(request.headers)}`, 60, 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec ?? 60) } });
    }

    const body = await parseJsonBody(request);
    if (body === null) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    const parsed = cartLinePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }
    const user = await getCurrentUser();
    const cartId = await findCartId(user?.id ?? null);
    if (!cartId) return NextResponse.json({ error: "Cart not found." }, { status: 404 });

    const line = await db.cartItem.findUnique({ where: { id: parsed.data.lineId } });
    if (!line || line.cartId !== cartId) {
      return NextResponse.json({ error: "Cart line not found." }, { status: 404 });
    }

    const requested = parsed.data.quantity;
    let finalQuantity = 0; // deletion (explicit 0 or clamp-to-0) is the fallback
    // Session-10 S10-2: every write is a scoped conditional write
    // (`{ id, cartId }`) whose `count === 0` maps to the same 404 — a line
    // deleted by a concurrent tab/window between the read above and this
    // write surfaces as "not found" instead of a P2025 500 (the S8-4
    // wishlist / S9-3 addresses race pattern, applied to the cart).
    if (requested === 0) {
      const gone = await db.cartItem.deleteMany({ where: { id: line.id, cartId } });
      if (gone.count === 0) {
        return NextResponse.json({ error: "Cart line not found." }, { status: 404 });
      }
    } else {
      const product = await db.product.findUnique({ where: { id: line.productId } });
      const qty = clampPurchaseQuantity(requested, product?.stock ?? null);
      if (qty === 0) {
        // Out of stock (or product gone) — the line is not purchasable, so it
        // must not survive as a quantity-0 ghost that checkout can "buy".
        const gone = await db.cartItem.deleteMany({ where: { id: line.id, cartId } });
        if (gone.count === 0) {
          return NextResponse.json({ error: "Cart line not found." }, { status: 404 });
        }
      } else {
        const updated = await db.cartItem.updateMany({
          where: { id: line.id, cartId },
          data: { quantity: qty },
        });
        if (updated.count === 0) {
          return NextResponse.json({ error: "Cart line not found." }, { status: 404 });
        }
        finalQuantity = qty;
      }
    }

    const summary = await getCartSummary(cartId);
    // `quantity` mirrors the SERVER clamp back to optimistic islands (the
    // drawer) so their local state can never disagree with the cart's truth.
    return NextResponse.json({ itemCount: summary.itemCount, quantity: finalQuantity });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

/** DELETE /api/cart?line=<id> — remove a line. ?all=1 empties the cart. */
export async function DELETE(request: NextRequest) {
  try {
    const ipLimit = rateLimit(`cart:${clientIp(request.headers)}`, 60, 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec ?? 60) } });
    }

    const params = request.nextUrl.searchParams;
    const user = await getCurrentUser();
    const cartId = await findCartId(user?.id ?? null);
    if (!cartId) return NextResponse.json({ itemCount: 0 });

    if (params.get("all") === "1") {
      await db.cartItem.deleteMany({ where: { cartId } });
    } else {
      const lineId = params.get("line");
      if (!lineId) return NextResponse.json({ error: "Missing line id." }, { status: 400 });
      await db.cartItem.deleteMany({ where: { id: lineId, cartId } });
    }
    const summary = await getCartSummary(cartId);
    return NextResponse.json({ itemCount: summary.itemCount });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

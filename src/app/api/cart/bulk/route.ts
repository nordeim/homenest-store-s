import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { clampPurchaseQuantity } from "@/lib/cart-quantity";
import { getOrCreateCart, getCartSummary } from "@/lib/cart";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cartBulkSchema, firstError } from "@/lib/validation";

/**
 * POST /api/cart/bulk — add every wishlist item in ONE request (session-8
 * S8-6). The per-item loop in add-all-button fought the shared 60/min cart
 * limiter on large wishlists (hard failures mid-loop, a misleading
 * "out of stock" toast); a single bounded request cannot trip it.
 *
 * Each line routes through the SAME clamp (stock ceiling + 99 cap) and the
 * same read+upsert pattern as POST /api/cart, all inside ONE transaction —
 * a mid-list failure rolls the whole batch back rather than leaving a
 * half-added wishlist. Lines for products that are gone/inactive are skipped
 * and reported; only an unexpected error 500s.
 */
export async function POST(request: NextRequest) {
  try {
    // Generous per-line ceiling (schema caps at 100) but a tight request
    // budget — the bulk path does up to 100 writes per call.
    const limit = rateLimit(`cart-bulk:${clientIp(request.headers)}`, 10, 60_000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = cartBulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }

    // Dedupe repeated product ids (sum their quantities) so a duplicated
    // wishlist payload cannot double-count lines.
    const wanted = new Map<string, number>();
    for (const item of parsed.data.items) {
      wanted.set(item.productId, Math.min((wanted.get(item.productId) ?? 0) + item.quantity, 99));
    }

    const products = await db.product.findMany({
      where: { id: { in: Array.from(wanted.keys()) }, isActive: true },
      select: { id: true, stock: true },
    });
    const stockById = new Map(products.map((p) => [p.id, p.stock]));
    const skipped = wanted.size - products.length;

    const user = await getCurrentUser();
    const cartId = await getOrCreateCart(user?.id ?? null);

    const added = await db.$transaction(async (tx) => {
      let count = 0;
      for (const [productId, quantity] of wanted) {
        const stock = stockById.get(productId);
        if (stock === undefined) continue; // gone/inactive — reported as skipped
        const existing = await tx.cartItem.findUnique({
          where: { cartId_productId: { cartId, productId } },
        });
        const clamped = clampPurchaseQuantity((existing?.quantity ?? 0) + quantity, stock);
        if (clamped === 0) continue; // sold out under the click
        await tx.cartItem.upsert({
          where: { cartId_productId: { cartId, productId } },
          create: { cartId, productId, quantity: clamped },
          update: { quantity: clamped },
        });
        count += 1;
      }
      return count;
    });

    const summary = await getCartSummary(cartId);
    return NextResponse.json({ itemCount: summary.itemCount, added, skipped: Math.max(skipped, 0) });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

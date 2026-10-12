import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getOrCreateCart, getCartSummary } from "@/lib/cart";
import { db } from "@/lib/db";
import { cartMutateSchema, firstError } from "@/lib/validation";

/** POST /api/cart — add a product (or bump quantity of an existing line). */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = cartMutateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }
    const { productId, quantity } = parsed.data;

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    if (product.stock <= 0) {
      return NextResponse.json({ error: "This product is out of stock." }, { status: 409 });
    }

    const user = await getCurrentUser();
    const cartId = await getOrCreateCart(user?.id ?? null);

    const existing = await db.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });
    const nextQty = Math.min(product.stock, (existing?.quantity ?? 0) + quantity);
    await db.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      create: { cartId, productId, quantity: nextQty },
      update: { quantity: nextQty },
    });

    const summary = await getCartSummary(cartId);
    return NextResponse.json({ itemCount: summary.itemCount });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

/** PATCH /api/cart — set a line's quantity. */
export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = z
      .object({ lineId: z.string().min(1), quantity: z.number().int().min(0).max(99) })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }
    const user = await getCurrentUser();
    const cartId = await findCartSafe(user?.id ?? null);
    if (!cartId) return NextResponse.json({ error: "Cart not found." }, { status: 404 });

    const line = await db.cartItem.findUnique({ where: { id: parsed.data.lineId } });
    if (!line || line.cartId !== cartId) {
      return NextResponse.json({ error: "Cart line not found." }, { status: 404 });
    }

    if (parsed.data.quantity === 0) {
      await db.cartItem.delete({ where: { id: line.id } });
    } else {
      const product = await db.product.findUnique({ where: { id: line.productId } });
      const qty = Math.min(parsed.data.quantity, product?.stock ?? 99);
      await db.cartItem.update({ where: { id: line.id }, data: { quantity: qty } });
    }

    const summary = await getCartSummary(cartId);
    return NextResponse.json({ itemCount: summary.itemCount });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

/** DELETE /api/cart?line=<id> — remove a line. ?all=1 empties the cart. */
export async function DELETE(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const user = await getCurrentUser();
    const cartId = await findCartSafe(user?.id ?? null);
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

async function findCartSafe(userId: string | null): Promise<string | null> {
  if (userId) {
    const own = await db.cart.findUnique({ where: { userId } });
    if (own) return own.id;
  }
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get("homenest_cart")?.value;
  if (!token) return null;
  const guest = await db.cart.findUnique({ where: { token } });
  return guest?.id ?? null;
}

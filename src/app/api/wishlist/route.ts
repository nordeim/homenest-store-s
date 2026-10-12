import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateWishlist } from "@/lib/wishlist";

const wishlistToggleSchema = z.object({
  productId: z.string().min(1),
});

/** POST /api/wishlist — toggle a product in the caller's wishlist. */
export async function POST(request: NextRequest) {
  try {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = wishlistToggleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing productId." }, { status: 400 });
    }
    const { productId } = parsed.data;

    const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, isActive: true } });
    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const user = await getCurrentUser();
    const wishlistId = await getOrCreateWishlist(user?.id ?? null);
    const existing = await db.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId, productId } },
    });

    if (existing) {
      await db.wishlistItem.delete({ where: { id: existing.id } });
      return NextResponse.json({ inWishlist: false });
    }
    await db.wishlistItem.create({ data: { wishlistId, productId } });
    return NextResponse.json({ inWishlist: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

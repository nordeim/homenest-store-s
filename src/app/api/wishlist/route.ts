import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { assertWishlistCap, WishlistCapError, createWishlistItemInTx, getOrCreateWishlist } from "@/lib/wishlist";
import { wishlistToggleSchema } from "@/lib/validation";

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

    // Guest-reachable row creation — metered like the cart POST (a scripted
    // client that ignores cookies would mint a Wishlist row per request).
    const ipLimit = rateLimit(`wishlist:${clientIp(request.headers)}`, 60, 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec ?? 60) } });
    }

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
      // Session-8 S8-4: a genuine double-click interleaves two toggles — the
      // concurrent request may have already deleted the row between our read
      // and our write. `delete` would throw P2025 into the generic catch and
      // surface a 500 for a click that conceptually succeeded; `deleteMany`
      // never throws on zero rows, and the end state is the same.
      await db.wishlistItem.deleteMany({ where: { id: existing.id, wishlistId } });
      return NextResponse.json({ inWishlist: false });
    }
    // Session-8 S8-6: the wishlist is a bounded surface (mirrors the address
    // book cap) — the pre-create check is the fast-fail UX path (friendly 409
    // before doing work). The AUTHORITATIVE gate (session-16 S16-1, the S11-6
    // shape) runs inside the create transaction below: on SQLite the write
    // lock lands at the first WRITE, so concurrent POSTs at cap − 1 serialize
    // past this read — the tx creates first, counts under the lock, and rolls
    // the create back when over.
    try {
      await assertWishlistCap(db, wishlistId);
    } catch (error) {
      if (error instanceof WishlistCapError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
    try {
      await db.$transaction((tx) => createWishlistItemInTx(tx, wishlistId, productId));
    } catch (error) {
      if (error instanceof WishlistCapError) {
        // The post-create count under the write lock caught a concurrent
        // creator — our create rolled back with the transaction.
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      // A double-click races the create: the concurrent request already
      // created the item (P2002 rolls OUR create back). That IS the desired
      // end state — the item exists, answer inWishlist: true.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ inWishlist: true });
      }
      throw error;
    }
    return NextResponse.json({ inWishlist: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

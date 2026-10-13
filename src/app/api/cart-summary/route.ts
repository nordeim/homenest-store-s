import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary } from "@/lib/cart";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/cart-summary — the cart drawer's line payload.
 * Session-9 S9-6: the last unauthenticated endpoint without a meter —
 * read-only, but the S5-8 grid now covers every public route (120/min per
 * IP, the same budget as search).
 */
export async function GET(request: NextRequest) {
  try {
    const limit = rateLimit(`cart-summary:${clientIp(request.headers)}`, 120, 60_000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    const user = await getCurrentUser();
    const cartId = await findCartId(user?.id ?? null);
    const summary = await getCartSummary(cartId);
    return NextResponse.json({ lines: summary.lines, itemCount: summary.itemCount, subtotal: summary.subtotal });
  } catch {
    // Sibling-consistent error shape (session-7 S7-11): a failed read is a
    // JSON { error } 500, never Next's generic error page.
    return NextResponse.json({ error: "Could not load your cart. Please try again." }, { status: 500 });
  }
}

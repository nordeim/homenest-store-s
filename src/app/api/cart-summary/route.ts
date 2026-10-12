import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary } from "@/lib/cart";

/** GET /api/cart-summary — the cart drawer's line payload. */
export async function GET() {
  try {
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

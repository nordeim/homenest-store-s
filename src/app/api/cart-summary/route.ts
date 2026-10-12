import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary } from "@/lib/cart";

/** GET /api/cart-summary — the cart drawer's line payload. */
export async function GET() {
  const user = await getCurrentUser();
  const cartId = await findCartId(user?.id ?? null);
  const summary = await getCartSummary(cartId);
  return NextResponse.json({ lines: summary.lines, itemCount: summary.itemCount, subtotal: summary.subtotal });
}

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findCartId, getCartSummary } from "@/lib/cart";
import { applyCouponCode, findActiveCoupon } from "@/lib/coupons";
import { couponApplySchema, firstError } from "@/lib/validation";

/** The payload CouponBox / checkout render from. */
export type CouponApplyResponse =
  | { ok: true; code: string; discount: number; label: string; description: string; freeShipping?: true }
  | { ok: false, error: string };

/**
 * POST /api/coupon/apply — validate a coupon code against the caller's cart.
 * The discount is always derived server-side from the live cart subtotal
 * (client-sent amounts are never trusted) and returned with the coupon's
 * label + description for inline display.
 */
export async function POST(request: NextRequest) {
  // Malformed payloads are a client error (400), not a 500 — the L3 pattern
  // split applies to EVERY JSON route (this one was missed in sessions 2-3).
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<CouponApplyResponse>({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const parsed = couponApplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<CouponApplyResponse>({ ok: false, error: firstError(parsed.error) });
    }

    
    const limit = rateLimit(`coupon:${clientIp(request.headers)}`, 30, 60_000);
    if (!limit.ok) {
      return NextResponse.json<CouponApplyResponse>(
        { ok: false, error: "Too many attempts. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
      );
    }

    const user = await getCurrentUser();
    const cartId = await findCartId(user?.id ?? null);
    const summary = await getCartSummary(cartId);
    if (summary.lines.length === 0) {
      return NextResponse.json<CouponApplyResponse>({ ok: false, error: "Your cart is empty." });
    }

    const applied = await applyCouponCode(parsed.data.code, summary.subtotal);
    if (!applied.ok) {
      return NextResponse.json<CouponApplyResponse>({ ok: false, error: applied.error });
    }

    // Second lookup only to carry the marketing description alongside the math.
    const coupon = await findActiveCoupon(applied.code);
    return NextResponse.json<CouponApplyResponse>({
      ok: true,
      code: applied.code,
      discount: applied.discount,
      label: applied.label,
      description: coupon?.description ?? "",
      // Session-20 S20-6: the checkout mirror needs the shipping override.
      ...(applied.freeShipping ? { freeShipping: true } : {}),
    });
  } catch {
    return NextResponse.json<CouponApplyResponse>(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

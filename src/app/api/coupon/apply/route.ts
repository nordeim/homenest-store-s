import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary } from "@/lib/cart";
import { applyCouponCode, findActiveCoupon } from "@/lib/coupons";
import { firstError } from "@/lib/validation";

/** The payload CouponBox / checkout render from. */
export type CouponApplyResponse =
  | { ok: true; code: string; discount: number; label: string; description: string }
  | { ok: false; error: string };

const applySchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code").max(40, "That code is too long"),
});

/**
 * POST /api/coupon/apply — validate a coupon code against the caller's cart.
 * The discount is always derived server-side from the live cart subtotal
 * (client-sent amounts are never trusted) and returned with the coupon's
 * label + description for inline display.
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<CouponApplyResponse>({ ok: false, error: firstError(parsed.error) });
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
    });
  } catch {
    return NextResponse.json<CouponApplyResponse>(
      { ok: false, error: "Something went wrong. Please try again." },
    );
  }
}

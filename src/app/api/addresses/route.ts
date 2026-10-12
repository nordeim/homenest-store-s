import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { addressSchema, firstError } from "@/lib/validation";

/**
 * POST /api/addresses — create a saved address for the signed-in user.
 * Body: addressSchema JSON. Returns { ok: true, id }.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in to save addresses." }, { status: 401 });
    }

    // Metered like every other mutation (session-6 S6-10): 60/min per client.
    const limit = rateLimit(`addresses:${clientIp(request.headers)}`, 60, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
      );
    }

    // Malformed payloads are a client error (400), not a 500 — same pattern as
    // the cart/checkout/wishlist routes.
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = addressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }

    const address = await db.address.create({
      data: {
        userId: user.id,
        label: parsed.data.label || "Home",
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        line1: parsed.data.line1,
        line2: parsed.data.line2 ? parsed.data.line2 : null,
        city: parsed.data.city,
        state: parsed.data.state,
        postalCode: parsed.data.postalCode,
        country: parsed.data.country || "United States",
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: address.id });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/**
 * DELETE /api/addresses?id=... — delete one of the current user's addresses.
 * Ownership-checked: a matching id owned by someone else reads as "not found".
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const limit = rateLimit(`addresses:${clientIp(request.headers)}`, 60, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
      );
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing address id." }, { status: 400 });
    }

    const existing = await db.address.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    await db.address.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

import { AddressCapError, AddressGoneError, assertAddressCap, promoteAddressInTx, reassignDefaultAfterDeleteInTx } from "@/lib/addresses";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { addressDefaultSchema, addressSchema, firstError } from "@/lib/validation";

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

    // Session-7 S7-8: the address book is a bounded surface — the cap is
    // enforced on the direct write path with a friendly, actionable 409.
    // Session-10 S10-3: the check runs INSIDE the create transaction, so two
    // concurrent POSTs at (cap − 1) can no longer both pass a pre-tx read and
    // overshoot the cap — the in-tx count is the authoritative gate, and the
    // S8-1 single-default invariant (first address auto-defaults, count +
    // create + unset pass in ONE transaction) is unchanged.
    const address = await db.$transaction(async (tx) => {
      await assertAddressCap(tx, user.id);
      const count = await tx.address.count({ where: { userId: user.id } });
      const created = await tx.address.create({
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
          isDefault: count === 0,
        },
        select: { id: true },
      });
      if (count === 0) {
        // Converging unset pass — guarantees "exactly one default" even if a
        // legacy row or odd interleaving left another flag set.
        await tx.address.updateMany({
          where: { userId: user.id, NOT: { id: created.id } },
          data: { isDefault: false },
        });
      }
      return created;
    });

    return NextResponse.json({ ok: true, id: address.id });
  } catch (error) {
    if (error instanceof AddressCapError) {
      // The in-tx cap gate (S10-3) rejects the full book with the same
      // friendly, actionable 409 the pre-tx check used to return.
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/**
 * PATCH /api/addresses — set one of the current user's addresses as the
 * default (session-8 S8-1). Body: { id, isDefault: true }. The previous
 * defaults are unset inside the same transaction, so the checkout page's
 * `findFirst({ isDefault: true })` stays deterministic.
 */
export async function PATCH(request: NextRequest) {
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

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = addressDefaultSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }

    const existing = await db.address.findFirst({
      where: { id: parsed.data.id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    // The PROMOTE is scoped and conditional and runs FIRST (session-9 S9-3):
    // if a concurrent delete removed the row, count === 0 aborts the tx with
    // AddressGoneError and the previous defaults are never cleared. The old
    // unset-all-then-update order could strand a user with zero defaults.
    try {
      await db.$transaction(async (tx) => {
        await promoteAddressInTx(tx, user.id, existing.id);
      });
    } catch (error) {
      if (error instanceof AddressGoneError) {
        return NextResponse.json({ error: "Address not found." }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
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
      select: { id: true, isDefault: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    // Scoped deleteMany (session-9 S9-3, the S8-4 wishlist pattern): a
    // concurrent double-delete reports count === 0 as a 404 instead of
    // surfacing P2025 as a 500. Session-10 S10-1: when the deleted row was
    // the DEFAULT, the newest remaining address is re-promoted inside the
    // SAME transaction — otherwise the book strands at zero defaults,
    // checkout prefill silently dies, and nothing ever re-promotes.
    await db.$transaction(async (tx) => {
      const deleted = await tx.address.deleteMany({ where: { id: existing.id, userId: user.id } });
      if (deleted.count === 0) {
        // Lost the delete race — nothing to reassign; the pre-read row was
        // already gone, which is the same 404 the scoped write used to map.
        throw new AddressGoneError();
      }
      await reassignDefaultAfterDeleteInTx(tx, user.id, existing.isDefault);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AddressGoneError) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

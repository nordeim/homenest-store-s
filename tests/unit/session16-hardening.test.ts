// Session-16 S16-1 / C3 / C4 — the wishlist cap's AUTHORITATIVE gate.
//
// The S8-6 cap used to be a pre-create count on `db` followed by a bare
// create (check-then-create): on SQLite the write lock lands at the first
// WRITE, so two concurrent POSTs at cap − 1 both read 99 and both create —
// the loser's P2002 mapped to `{ inWishlist: true }`, and the wishlist
// permanently overshot MAX_WISHLIST_ITEMS. Session-16 moves the gate into
// the create transaction (the S11-6 address-cap shape): create FIRST (taking
// the lock), count UNDER the lock, roll the create back when over.
//
// The route handler is import-safe in the Vitest node env (the session-12
// convention, re-verified for this route). The DB layer is mocked — the
// boundary under test is the HTTP mapping + gate ordering, not the data
// layer. Rate-limit budgets are isolated per-test via the `clientIp`
// contract: a single-hop `x-forwarded-for` names the client, so each test
// posts from its own unique IP.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    // The void session sweep fires on the first getCurrentUser — stay quiet.
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    product: { findUnique: vi.fn() },
    wishlist: { findUnique: vi.fn() },
    wishlistItem: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === "homenest_wishlist" ? { value: "guest-wl-token" } : undefined),
  })),
}));

import { POST as wishlistPOST } from "@/app/api/wishlist/route";
import { db } from "@/lib/db";
import {
  MAX_WISHLIST_ITEMS,
  WishlistCapError,
  createWishlistItemInTx,
} from "@/lib/wishlist";

const ORIGIN = "http://localhost:3000";

/** A wishlist POST from its own rate-limit bucket (unique rightmost XFF hop). */
function post(productId: string, ip: string) {
  return new Request(`${ORIGIN}/api/wishlist`, {
    method: "POST",
    body: JSON.stringify({ productId }),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
  }) as NextRequest;
}

beforeEach(() => {
  vi.mocked(db.$transaction).mockReset();
  vi.mocked(db.product.findUnique).mockReset();
  vi.mocked(db.product.findUnique).mockResolvedValue({ id: "p1", isActive: true } as never);
  vi.mocked(db.wishlist.findUnique).mockReset();
  vi.mocked(db.wishlist.findUnique).mockResolvedValue({ id: "w1" } as never);
  vi.mocked(db.wishlistItem.findUnique).mockReset();
  vi.mocked(db.wishlistItem.findUnique).mockResolvedValue(null);
  vi.mocked(db.wishlistItem.count).mockReset();
  vi.mocked(db.wishlistItem.create).mockReset();
});

describe("createWishlistItemInTx (C4 — create-first ordering)", () => {
  function fakeTx(countValue: number) {
    const order: string[] = [];
    return {
      order,
      client: {
        wishlistItem: {
          create: vi.fn(async () => {
            order.push("create");
            return {};
          }),
          count: vi.fn(async () => {
            order.push("count");
            return countValue;
          }),
        },
      },
    } as const;
  }

  it("creates first, then counts under the lock; at the cap it resolves", async () => {
    const tx = fakeTx(MAX_WISHLIST_ITEMS);
    await expect(createWishlistItemInTx(tx.client, "w1", "p1")).resolves.toBeUndefined();
    expect(tx.order).toEqual(["create", "count"]);
  });

  it("resolves when the post-create count equals the cap", async () => {
    const tx = fakeTx(MAX_WISHLIST_ITEMS - 1);
    await expect(createWishlistItemInTx(tx.client, "w1", "p1")).resolves.toBeUndefined();
  });

  it("throws WishlistCapError AFTER the create when over the cap (create rolls back)", async () => {
    const tx = fakeTx(MAX_WISHLIST_ITEMS + 1);
    try {
      await createWishlistItemInTx(tx.client, "w1", "p1");
      expect.unreachable("expected WishlistCapError");
    } catch (error) {
      expect(error).toBeInstanceOf(WishlistCapError);
      expect((error as WishlistCapError).message).toContain("full (100 items maximum)");
    }
    expect(tx.order).toEqual(["create", "count"]);
  });
});

describe("POST /api/wishlist (C3 — route boundary)", () => {
  it("creates normally under the cap", async () => {
    vi.mocked(db.wishlistItem.count).mockResolvedValue(0);
    vi.mocked(db.$transaction).mockImplementation(async (cb) =>
      (cb as (tx: unknown) => Promise<void>)({
        wishlistItem: {
          create: vi.fn(async () => undefined),
          count: vi.fn(async () => 1),
        },
      }),
    );
    const res = await wishlistPOST(post("p1", "10.16.0.1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ inWishlist: true });
  });

  it("at-cap overflow inside the tx rolls back with the friendly 409 (S16-1)", async () => {
    // The pre-create fast-fail check passes at 99 — the AUTHORITATIVE gate
    // must catch the overflow inside the transaction (concurrent creator).
    vi.mocked(db.wishlistItem.count).mockResolvedValue(MAX_WISHLIST_ITEMS - 1);
    vi.mocked(db.$transaction).mockImplementation(async (cb) =>
      (cb as (tx: unknown) => Promise<void>)({
        wishlistItem: {
          create: vi.fn(async () => undefined),
          count: vi.fn(async () => MAX_WISHLIST_ITEMS + 1),
        },
      }),
    );
    // RED pre-fix: the route created straight on `db` (no $transaction at all)
    // and answered 200 { inWishlist: true } — the 101st row landed silently.
    const res = await wishlistPOST(post("p1", "10.16.0.2"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("full (100 items maximum)");
  });

  it("a P2002 inside the tx is the double-click win — inWishlist: true", async () => {
    vi.mocked(db.wishlistItem.count).mockResolvedValue(0);
    // The route discriminates the double-click race with
    // `instanceof PrismaClientKnownRequestError` (the S8-4 semantics) — the
    // mock must raise the REAL Prisma error class, not a code-stamped Error.
    const doubleClick = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`wishlistId`,`productId`)",
      { code: "P2002", clientVersion: "6.11.0" },
    );
    vi.mocked(db.$transaction).mockImplementation(async (cb) =>
      (cb as (tx: unknown) => Promise<void>)({
        wishlistItem: {
          create: vi.fn(async () => {
            throw doubleClick;
          }),
          count: vi.fn(async () => 0),
        },
      }),
    );
    const res = await wishlistPOST(post("p1", "10.16.0.3"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ inWishlist: true });
  });
});
